const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
const target = targets.find((entry) => entry.url === 'app://-/index.html' && entry.webSocketDebuggerUrl)
if (!target) throw new Error('ChatGPT main renderer was not found')

const expression = `(() => {
  const xs = [900, 1000, 1080, 1120, 1140, 1160, 1200, 1280, 1360];
  const ys = [260, 420, 620, 760, 820];
  const describe = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const pseudo = (name) => {
      const value = getComputedStyle(element, name);
      return {
        content: value.content,
        background: value.backgroundColor,
        image: value.backgroundImage.slice(0, 120),
        position: value.position,
      };
    };
    return {
      tag: element.tagName,
      class: String(element.className).slice(0, 300),
      testid: element.getAttribute('data-testid'),
      footer: element.getAttribute('data-thread-scroll-footer'),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      background: style.backgroundColor,
      image: style.backgroundImage.slice(0, 120),
      opacity: style.opacity,
      backdrop: style.backdropFilter,
      before: pseudo('::before'),
      after: pseudo('::after'),
    };
  };
  return ys.flatMap((y) => xs.map((x) => ({
    x, y,
    stack: document.elementsFromPoint(x, y).slice(0, 16).map(describe),
  })));
})()`

const result = await new Promise((resolve, reject) => {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const timer = setTimeout(() => reject(new Error('CDP timeout')), 8000)
  socket.addEventListener('open', () => socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true },
  })))
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id !== 1) return
    clearTimeout(timer)
    socket.close()
    if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text))
    else resolve(message.result.result.value)
  })
  socket.addEventListener('error', () => reject(new Error('CDP WebSocket failed')))
})

console.log(JSON.stringify(result, null, 2))
