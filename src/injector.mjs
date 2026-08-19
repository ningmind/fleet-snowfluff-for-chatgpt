import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const themePath = resolve(process.argv[2] || new URL('./theme.css', import.meta.url).pathname)
const wallpaperPath = resolve(process.argv[3] || new URL('../assets/wallpaper.jpg', import.meta.url).pathname)
const petCssPath = resolve(new URL('./pet.css', import.meta.url).pathname)
const petScriptPath = resolve(new URL('./pet.js', import.meta.url).pathname)
const petSpritePath = resolve(new URL('../assets/spritesheet-crisp.png', import.meta.url).pathname)
const petLightSpritePath = resolve(new URL('../assets/spritesheet-crisp-light.png', import.meta.url).pathname)

const mimeTypes = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const mime = mimeTypes[extname(wallpaperPath).toLowerCase()]
if (!mime) throw new Error(`Unsupported wallpaper type: ${extname(wallpaperPath)}`)

const wallpaper = await readFile(wallpaperPath)
const dataUrl = `data:${mime};base64,${wallpaper.toString('base64')}`
let css = ''
let petScript = ''
let themeVersion = ''
const injectedTargets = new Map()

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

async function getTargets() {
  const response = await fetch(`http://127.0.0.1:${port}/json`)
  if (!response.ok) throw new Error(`DevTools endpoint returned ${response.status}`)
  return response.json()
}

function inject(target) {
  return new Promise((resolveInject, rejectInject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    const timer = setTimeout(() => {
      socket.close()
      rejectInject(new Error('WebSocket injection timed out'))
    }, 5000)

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const id = 'codex-custom-wallpaper';
            let style = document.getElementById(id);
            if (!style) {
              style = document.createElement('style');
              style.id = id;
              document.head.appendChild(style);
            }
            style.textContent = ${JSON.stringify(css)};
            document.documentElement.dataset.codexWallpaper = 'enabled';
            return document.title || location.href;
          })();\n${petScript}`,
          returnByValue: true,
        },
      }))
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== 1) return
      clearTimeout(timer)
      socket.close()
      if (message.result?.exceptionDetails) {
        rejectInject(new Error(message.result.exceptionDetails.text || 'Injection failed'))
      } else {
        resolveInject(message.result?.result?.value || target.title || target.id)
      }
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      rejectInject(new Error('WebSocket connection failed'))
    })
  })
}

console.log(`Watching ChatGPT DevTools on 127.0.0.1:${port}`)
for (;;) {
  try {
    const [themeStat, petCssStat, petScriptStat, petSpriteStat, petLightSpriteStat] = await Promise.all([
      stat(themePath), stat(petCssPath), stat(petScriptPath), stat(petSpritePath), stat(petLightSpritePath),
    ])
    const nextVersion = [themeStat, petCssStat, petScriptStat, petSpriteStat, petLightSpriteStat]
      .map((entry) => `${entry.mtimeMs}:${entry.size}`).join('|')
    if (nextVersion !== themeVersion) {
      const [cssTemplate, petCss, petTemplate, petSprite, petLightSprite] = await Promise.all([
        readFile(themePath, 'utf8'),
        readFile(petCssPath, 'utf8'),
        readFile(petScriptPath, 'utf8'),
        readFile(petSpritePath),
        readFile(petLightSpritePath),
      ])
      css = cssTemplate.replaceAll('__CODEX_WALLPAPER_DATA_URL__', dataUrl)
      const petSpriteMime = mimeTypes[extname(petSpritePath).toLowerCase()]
      if (!petSpriteMime) throw new Error(`Unsupported pet sprite type: ${extname(petSpritePath)}`)
      const petSpriteUrl = `data:${petSpriteMime};base64,${petSprite.toString('base64')}`
      const petLightSpriteUrl = `data:image/png;base64,${petLightSprite.toString('base64')}`
      petScript = petTemplate
        .replace('__CODEX_PET_CSS_JSON__', JSON.stringify(petCss))
        .replace('__CODEX_PET_SPRITE_DATA_URL_JSON__', JSON.stringify(petSpriteUrl))
        .replace('__CODEX_PET_LIGHT_SPRITE_DATA_URL_JSON__', JSON.stringify(petLightSpriteUrl))
      themeVersion = nextVersion
      console.log('Theme and desktop pet loaded')
    }

    const targets = await getTargets()
    for (const target of targets) {
      if (!target.webSocketDebuggerUrl || injectedTargets.get(target.id) === themeVersion) continue
      try {
        const label = await inject(target)
        injectedTargets.set(target.id, themeVersion)
        console.log(`Theme injected: ${label}`)
      } catch (error) {
        console.error(`Could not inject target ${target.id}: ${error.message}`)
      }
    }
    const liveIds = new Set(targets.map((target) => target.id))
    for (const id of injectedTargets.keys()) if (!liveIds.has(id)) injectedTargets.delete(id)
  } catch (_) {
    // ChatGPT is still launching or has been closed.
  }
  await sleep(1500)
}
