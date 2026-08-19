import { writeFile } from 'node:fs/promises'

const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const output = process.argv[2] || '/private/tmp/codex-theme-page.png'
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
const target = targets.find((entry) => entry.url === 'app://-/index.html' && entry.webSocketDebuggerUrl)
if (!target) throw new Error('ChatGPT main renderer was not found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})
const result = await new Promise((resolve, reject) => {
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id !== 1) return
    if (message.result?.data) resolve(message.result.data)
    else reject(new Error(message.error?.message || 'Screenshot failed'))
  })
  socket.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
})
socket.close()
await writeFile(output, Buffer.from(result, 'base64'))
console.log(output)
