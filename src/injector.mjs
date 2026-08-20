import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const themePath = resolve(process.argv[2] || new URL('./theme.css', import.meta.url).pathname)
const wallpaperPath = resolve(process.argv[3] || new URL('../assets/wallpaper.jpg', import.meta.url).pathname)
const petCssPath = resolve(new URL('./pet.css', import.meta.url).pathname)
const petScriptPath = resolve(new URL('./pet.js', import.meta.url).pathname)
const petSpritePath = resolve(new URL('../assets/spritesheet-crisp.png', import.meta.url).pathname)
const petLightSpritePath = resolve(new URL('../assets/spritesheet-crisp-light.png', import.meta.url).pathname)
const taskDirectory = resolve(process.env.FLEET_SNOWFLUFF_TASKS_DIR || join(homedir(), 'Documents', 'Fleet Snowfluff'))
const taskJsonPath = join(taskDirectory, 'daily-tasks.json')
const taskMarkdownPath = join(taskDirectory, 'daily-tasks.md')

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
const taskSyncTimes = new Map()
let persistedTaskSignature = ''

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

const emptyTaskNotebook = () => ({ version: 1, updatedAt: '', settings: { carryIncomplete: true }, days: {} })

function normalizeTaskNotebook(value) {
  const normalized = emptyTaskNotebook()
  if (!value || typeof value !== 'object') return normalized
  normalized.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
  normalized.settings.carryIncomplete = value.settings?.carryIncomplete !== false
  const days = value.days && typeof value.days === 'object' ? value.days : {}
  for (const [date, entry] of Object.entries(days).sort().slice(-120)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entry?.tasks)) continue
    normalized.days[date] = {
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      carriedFrom: typeof entry.carriedFrom === 'string' ? entry.carriedFrom : '',
      tasks: entry.tasks.slice(0, 300).flatMap((task) => {
        if (!task || typeof task !== 'object' || typeof task.text !== 'string') return []
        const text = task.text.trim().replace(/\s+/g, ' ').slice(0, 240)
        if (!text) return []
        return [{
          id: typeof task.id === 'string' ? task.id.slice(0, 100) : `${date}-${Math.random().toString(36).slice(2)}`,
          text,
          done: task.done === true,
          createdAt: typeof task.createdAt === 'string' ? task.createdAt : '',
          completedAt: typeof task.completedAt === 'string' ? task.completedAt : '',
          carriedFrom: typeof task.carriedFrom === 'string' ? task.carriedFrom : '',
        }]
      }),
    }
  }
  return normalized
}

async function readTaskNotebook() {
  try {
    return normalizeTaskNotebook(JSON.parse(await readFile(taskJsonPath, 'utf8')))
  } catch {
    return emptyTaskNotebook()
  }
}

function renderTaskMarkdown(notebook) {
  const lines = [
    '# 雪绒任务簿',
    '',
    '> 由 Fleet Snowfluff 桌宠自动维护。JSON 文件是结构化数据源；此文件便于阅读和供 Codex 使用。',
    '',
    `最后更新：${notebook.updatedAt || '尚未记录'}`,
    '',
  ]
  const dates = Object.keys(notebook.days).sort().reverse()
  if (!dates.length) lines.push('今天还没有任务。', '')
  dates.forEach((date, index) => {
    const day = notebook.days[date]
    lines.push(`${index === 0 ? '## 今日' : '## 历史'} · ${date}`, '')
    if (day.carriedFrom) lines.push(`> 未完成任务结转自 ${day.carriedFrom}`, '')
    if (!day.tasks.length) lines.push('暂无任务。', '')
    else {
      for (const task of day.tasks) {
        const text = task.text.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\')
        lines.push(`- [${task.done ? 'x' : ' '}] ${text}`)
      }
      lines.push('')
    }
  })
  return `${lines.join('\n').trim()}\n`
}

async function persistTaskNotebook(value) {
  const notebook = normalizeTaskNotebook(value)
  const signature = JSON.stringify(notebook)
  if (signature === persistedTaskSignature) return
  if (signature.length > 1_000_000) throw new Error('Task notebook is unexpectedly large')
  await mkdir(taskDirectory, { recursive: true })
  const jsonTemporaryPath = `${taskJsonPath}.tmp-${process.pid}`
  const markdownTemporaryPath = `${taskMarkdownPath}.tmp-${process.pid}`
  await Promise.all([
    writeFile(jsonTemporaryPath, `${JSON.stringify(notebook, null, 2)}\n`, 'utf8'),
    writeFile(markdownTemporaryPath, renderTaskMarkdown(notebook), 'utf8'),
  ])
  await Promise.all([
    rename(jsonTemporaryPath, taskJsonPath),
    rename(markdownTemporaryPath, taskMarkdownPath),
  ])
  persistedTaskSignature = signature
}

async function getTargets() {
  const response = await fetch(`http://127.0.0.1:${port}/json`)
  if (!response.ok) throw new Error(`DevTools endpoint returned ${response.status}`)
  return response.json()
}

const isMainRenderer = (target) => target.type === 'page' && target.url === 'app://-/index.html'

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

function readTasksFromTarget(target) {
  return new Promise((resolveTasks, rejectTasks) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    const timer = setTimeout(() => {
      socket.close()
      rejectTasks(new Error('Task synchronization timed out'))
    }, 4000)
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.__codexSnowfluffExportTasks?.() ?? null',
          returnByValue: true,
        },
      }))
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== 1) return
      clearTimeout(timer)
      socket.close()
      if (message.result?.exceptionDetails) rejectTasks(new Error('Could not read desktop pet tasks'))
      else resolveTasks(message.result?.result?.value || null)
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      rejectTasks(new Error('Task synchronization connection failed'))
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
      const [cssTemplate, petCss, petTemplate, petSprite, petLightSprite, taskNotebook] = await Promise.all([
        readFile(themePath, 'utf8'),
        readFile(petCssPath, 'utf8'),
        readFile(petScriptPath, 'utf8'),
        readFile(petSpritePath),
        readFile(petLightSpritePath),
        readTaskNotebook(),
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
        .replaceAll('__CODEX_TASKS_JSON__', JSON.stringify(taskNotebook))
        .replaceAll('__CODEX_TASKS_MARKDOWN_PATH_JSON__', JSON.stringify(taskMarkdownPath))
      themeVersion = nextVersion
      console.log('Theme and desktop pet loaded')
    }

    const targets = await getTargets()
    for (const target of targets) {
      if (!isMainRenderer(target) || !target.webSocketDebuggerUrl || injectedTargets.get(target.id) === themeVersion) continue
      try {
        const label = await inject(target)
        injectedTargets.set(target.id, themeVersion)
        console.log(`Theme injected: ${label}`)
      } catch (error) {
        console.error(`Could not inject target ${target.id}: ${error.message}`)
      }
      taskSyncTimes.set(target.id, 0)
    }
    for (const target of targets) {
      if (!isMainRenderer(target) || !target.webSocketDebuggerUrl || injectedTargets.get(target.id) !== themeVersion) continue
      if (Date.now() - (taskSyncTimes.get(target.id) || 0) < 2500) continue
      taskSyncTimes.set(target.id, Date.now())
      try {
        const notebook = await readTasksFromTarget(target)
        if (notebook) await persistTaskNotebook(notebook)
      } catch (error) {
        console.error(`Could not synchronize tasks from ${target.id}: ${error.message}`)
      }
    }
    const liveIds = new Set(targets.filter(isMainRenderer).map((target) => target.id))
    for (const id of injectedTargets.keys()) {
      if (liveIds.has(id)) continue
      injectedTargets.delete(id)
      taskSyncTimes.delete(id)
    }
  } catch (_) {
    // ChatGPT is still launching or has been closed.
  }
  await sleep(1500)
}
