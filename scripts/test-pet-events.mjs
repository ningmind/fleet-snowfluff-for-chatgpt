const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const duration = Number(process.argv[2] || 8000)
const requestedState = process.argv[3] || ''
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
const target = targets.find((entry) => entry.url === 'app://-/index.html' && entry.webSocketDebuggerUrl)
if (!target) throw new Error('ChatGPT main renderer was not found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', () => reject(new Error('Could not connect to Codex renderer')), { once: true })
})

let requestId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  const callback = pending.get(message.id)
  if (!callback) return
  pending.delete(message.id)
  callback(message)
})
const evaluate = (expression) => new Promise((resolve) => {
  const id = ++requestId
  pending.set(id, resolve)
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
})

if (requestedState) {
  const bubbles = {
    idle: '',
    chatting: '正在组织回复…',
    running: '正在工作…',
    waiting: '等待你的指示…',
    failed: '好像遇到问题了…',
    celebrating: '完成啦！',
  }
  await evaluate(`window.__codexAemeathSetState?.(
    ${JSON.stringify(requestedState)},
    ${JSON.stringify(bubbles[requestedState] || '')}
  )`)
}

const started = Date.now()
let previous = ''
while (Date.now() - started < duration) {
  const response = await evaluate(`(() => {
    const pet = document.querySelector('#codex-aemeath-pet');
    const sprite = pet?.querySelector('.codex-pet-sprite');
    return pet ? {
      animation: pet.dataset.animation || '',
      bubble: pet.querySelector('.codex-pet-bubble')?.textContent || '',
      backgroundPosition: sprite?.style.backgroundPosition || '',
      backgroundSize: getComputedStyle(sprite).backgroundSize,
    } : null;
  })()`)
  const state = response.result?.result?.value
  const serialized = JSON.stringify(state)
  if (serialized !== previous) {
    console.log(`${Date.now() - started}ms ${serialized}`)
    previous = serialized
  }
  await new Promise((resolve) => setTimeout(resolve, 120))
}
socket.close()
