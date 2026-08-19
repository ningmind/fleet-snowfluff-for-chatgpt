[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 9229,
  [string]$ChatGPTExe = $env:CHATGPT_EXE,
  [switch]$DiagnoseOnly
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$InjectorPath = Join-Path $ProjectRoot 'src\injector.mjs'
$ThemePath = Join-Path $ProjectRoot 'src\theme.css'
$WallpaperPath = Join-Path $ProjectRoot 'assets\wallpaper.jpg'

function Stop-WithMessage {
  param([string]$Message, [int]$Code = 1)
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  Write-Host ''
  Write-Host 'Press Enter to close this window.' -ForegroundColor DarkGray
  [void](Read-Host)
  exit $Code
}

function Resolve-ChatGPTExecutable {
  param([string]$ExplicitPath)

  if ($ExplicitPath) {
    $resolved = [Environment]::ExpandEnvironmentVariables($ExplicitPath)
    if (Test-Path -LiteralPath $resolved -PathType Leaf) {
      return (Resolve-Path -LiteralPath $resolved).Path
    }
    throw "CHATGPT_EXE does not exist: $resolved"
  }

  $desktopCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\ChatGPT\ChatGPT.exe'),
    (Join-Path $env:LOCALAPPDATA 'ChatGPT\ChatGPT.exe'),
    (Join-Path $env:ProgramFiles 'ChatGPT\ChatGPT.exe')
  )
  foreach ($candidate in $desktopCandidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  if (-not (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue)) {
    throw 'Get-AppxPackage is unavailable, so the Microsoft Store installation could not be inspected.'
  }

  $packages = @(Get-AppxPackage | Where-Object {
    $_.Name -match 'ChatGPT|OpenAI' -or $_.PackageFamilyName -match 'ChatGPT|OpenAI'
  })

  foreach ($package in $packages) {
    try {
      $manifest = Get-AppxPackageManifest -Package $package.PackageFullName
      $applications = @($manifest.Package.Applications.Application)
      foreach ($application in $applications) {
        $relativeExecutable = [string]$application.Executable
        if (-not $relativeExecutable -or $relativeExecutable -notmatch '\.exe$') { continue }

        $candidate = Join-Path $package.InstallLocation $relativeExecutable
        if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and
            ((Split-Path -Leaf $candidate) -match 'ChatGPT|OpenAI' -or $packages.Count -eq 1)) {
          return $candidate
        }
      }
    } catch {
      Write-Verbose "Could not inspect package $($package.Name): $($_.Exception.Message)"
    }
  }

  throw 'ChatGPT was not found. Install the official Microsoft Store app, or pass -ChatGPTExe "C:\path\to\ChatGPT.exe".'
}

function Test-DevToolsEndpoint {
  param([int]$EndpointPort)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$EndpointPort/json" -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  foreach ($requiredFile in @($InjectorPath, $ThemePath, $WallpaperPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
      throw "Missing required file: $requiredFile"
    }
  }

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
  if (-not $node) {
    throw 'Node.js 22 or newer is required. Install it from https://nodejs.org/ and open this launcher again.'
  }

  $nodeVersionText = (& $node.Source --version).TrimStart('v')
  $nodeMajor = [int]($nodeVersionText.Split('.')[0])
  if ($nodeMajor -lt 22) {
    throw "Node.js 22 or newer is required; found v$nodeVersionText."
  }

  $resolvedChatGPTExe = Resolve-ChatGPTExecutable -ExplicitPath $ChatGPTExe
  Write-Host "ChatGPT executable: $resolvedChatGPTExe"
  Write-Host "Node.js: v$nodeVersionText"
  Write-Host "Theme port: $Port"

  if ($DiagnoseOnly) {
    Write-Host 'Windows launcher diagnostics passed.' -ForegroundColor Green
    exit 0
  }

  $runningChatGPT = Get-Process -Name ChatGPT -ErrorAction SilentlyContinue
  if ($runningChatGPT) {
    throw 'ChatGPT is already running. Quit it completely from the system tray or Task Manager, then try again.'
  }
  if (Test-DevToolsEndpoint -EndpointPort $Port) {
    throw "Port $Port already hosts a DevTools endpoint. Choose another port with -Port 9230."
  }

  $env:CHATGPT_THEME_PORT = [string]$Port
  $injectorArguments = @(
    ('"' + $InjectorPath + '"'),
    ('"' + $ThemePath + '"'),
    ('"' + $WallpaperPath + '"')
  )
  $injector = Start-Process -FilePath $node.Source -ArgumentList $injectorArguments `
    -WorkingDirectory $ProjectRoot -NoNewWindow -PassThru

  try {
    $chatGPTArguments = @(
      '--remote-debugging-address=127.0.0.1',
      "--remote-debugging-port=$Port"
    )
    Start-Process -FilePath $resolvedChatGPTExe -ArgumentList $chatGPTArguments `
      -WorkingDirectory (Split-Path -Parent $resolvedChatGPTExe) | Out-Null

    $portReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Milliseconds 750
      if (Test-DevToolsEndpoint -EndpointPort $Port) {
        $portReady = $true
        break
      }
    }

    if (-not $portReady) {
      throw @"
ChatGPT opened without the local theme port. This Microsoft Store build may block direct command-line flags.
Run .\start-windows.ps1 -DiagnoseOnly and include its output, Windows version, and ChatGPT version in an Issue.
"@
    }

    Write-Host ''
    Write-Host 'Fleet Snowfluff is connected. Keep this window open while using ChatGPT.' -ForegroundColor Green
    Write-Host 'Press Ctrl+C to stop the injector. A normal ChatGPT launch remains unchanged.' -ForegroundColor DarkGray
    Wait-Process -Id $injector.Id
  } finally {
    if ($injector -and -not $injector.HasExited) {
      Stop-Process -Id $injector.Id -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Stop-WithMessage -Message $_.Exception.Message
}
