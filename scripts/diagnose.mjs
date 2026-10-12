const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
const target = targets.find((item) => item.type === 'page' && item.url === 'app://-/index.html')
if (!target) throw new Error('ChatGPT renderer target not found')

const expression = `(() => {
  const points = [
    ['main-center', innerWidth * 0.55, innerHeight * 0.5],
    ['main-top', innerWidth * 0.55, 120],
    ['inspector', innerWidth * 0.88, innerHeight * 0.5],
    ['sidebar', 160, innerHeight * 0.5],
    ['composer', innerWidth * 0.55, innerHeight - 72],
  ];
  const describe = (element) => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      id: element.id,
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      class: String(element.className).slice(0, 500),
      testid: element.getAttribute('data-testid'),
      backgroundColor: style.backgroundColor,
      hasBackgroundImage: style.backgroundImage !== 'none',
      backgroundImagePrefix: style.backgroundImage === 'none' ? 'none' : style.backgroundImage.slice(0, 90),
      opacity: style.opacity,
      backdropFilter: style.backdropFilter,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
      position: style.position,
      zIndex: style.zIndex,
    };
  };
  return {
    viewport: [innerWidth, innerHeight],
    htmlTheme: document.documentElement.dataset.theme || null,
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    themePresent: Boolean(document.getElementById('codex-custom-wallpaper')),
    roots: [document.documentElement, document.body, document.getElementById('root')].filter(Boolean).map((element) => ({
      ...describe(element),
      before: (() => { const s = getComputedStyle(element, '::before'); return { content: s.content, backgroundColor: s.backgroundColor, hasBackgroundImage: s.backgroundImage !== 'none', zIndex: s.zIndex }; })(),
      after: (() => { const s = getComputedStyle(element, '::after'); return { content: s.content, backgroundColor: s.backgroundColor, hasBackgroundImage: s.backgroundImage !== 'none', zIndex: s.zIndex }; })(),
    })),
    coveringElements: [...document.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const bg = getComputedStyle(element).backgroundColor;
      return rect.width >= innerWidth * 0.72 && rect.height >= innerHeight * 0.72 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    }).slice(0, 40).map(describe),
    suspectedDividers: [...document.querySelectorAll('*')].filter((element) => {
      const label = [element.className, element.id, element.getAttribute('data-testid'), element.getAttribute('aria-label')].join(' ');
      return /resize|divider|split|handle|gutter/i.test(label);
    }).slice(0, 80).map((element) => ({
      ...describe(element),
      ariaLabel: element.getAttribute('aria-label'),
      rect: (() => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
    })),
    pinnedSummaryControls: [...document.querySelectorAll('*')].filter((element) => {
      const label = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent].join(' ');
      return /toggle pinned summary/i.test(label);
    }).slice(0, 20).map(describe),
    desktopPet: (() => {
      const pet = document.querySelector('#codex-aemeath-pet')
      if (!pet) return null
      return {
        ...describe(pet),
        animation: pet.dataset.animation || '',
        rect: pet.getBoundingClientRect().toJSON(),
        sprite: pet.querySelector('.codex-pet-sprite') ? describe(pet.querySelector('.codex-pet-sprite')) : null,
        bubble: pet.querySelector('.codex-pet-bubble')?.textContent || '',
      }
    })(),
    petDebug: {
      cleanupType: typeof window.__codexAemeathCleanup,
      stylePresent: Boolean(document.querySelector('#codex-aemeath-pet-style')),
      bodyReady: Boolean(document.body),
    },
    composerAncestors: (() => {
      const composer = document.querySelector('[class*="_ComposerLayoutRoot_"]')
      if (!composer) return []
      const result = []
      let element = composer
      while (element && result.length < 18) {
        const style = getComputedStyle(element)
        const before = getComputedStyle(element, '::before')
        const after = getComputedStyle(element, '::after')
        const rect = element.getBoundingClientRect()
        result.push({
          ...describe(element),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          before: { content: before.content, background: before.backgroundColor, image: before.backgroundImage },
          after: { content: after.content, background: after.backgroundColor, image: after.backgroundImage },
        })
        element = element.parentElement
      }
      return result
    })(),
    activitySignals: [...document.querySelectorAll(
      '[aria-busy="true"], [data-state="loading"], [data-status="running"], .animate-spin, button',
    )].filter((element) => {
      const text = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent].join(' ')
      return element.matches('[aria-busy="true"], [data-state="loading"], [data-status="running"], .animate-spin') ||
        /stop|interrupt|停止|中断/i.test(text)
    }).slice(-30).map((element) => ({
      ...describe(element),
      text: (element.textContent || '').trim().slice(0, 240),
      parentText: (element.parentElement?.textContent || '').trim().slice(0, 400),
    })),
    samples: points.map(([name, x, y]) => ({
      name,
      x: Math.round(x),
      y: Math.round(y),
      stack: document.elementsFromPoint(x, y).slice(0, 30).map(describe),
    })),
  };
})()`

const result = await new Promise((resolve, reject) => {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const timer = setTimeout(() => reject(new Error('CDP timeout')), 5000)
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
