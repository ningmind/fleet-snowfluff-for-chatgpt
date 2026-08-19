(() => {
  window.__codexAemeathCleanup?.()

  const PET_CSS = __CODEX_PET_CSS_JSON__
  const SPRITE_URL = __CODEX_PET_SPRITE_DATA_URL_JSON__
  const LIGHT_SPRITE_URL = __CODEX_PET_LIGHT_SPRITE_DATA_URL_JSON__
  const STORAGE_PREFIX = 'codex.aemeath.'
  const FRAME_MS = 180
  const FRAMES = {
    idle: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]],
    'running-right': [[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[1,7]],
    'running-left': [[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7]],
    waving: [[3,0],[3,1],[3,2],[3,3]],
    jumping: [[4,0],[4,1],[4,2],[4,3],[4,4]],
    /* Preserve the source pack's one-row-per-state semantics. */
    failed: [[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7]],
    waiting: [[6,0],[6,1],[6,2],[6,3],[6,4],[6,5]],
    running: [[7,0],[7,1],[7,2],[7,3],[7,4],[7,5]],
    review: [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5]],
    chatting: [[9,0],[9,1],[9,2],[9,3],[9,4],[9,5],[9,6],[9,7]],
    fetching: [[10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7]],
    searching: [[11,0],[11,1],[11,2],[11,3],[11,4],[11,5],[11,6],[11,7]],
    analyzing: [[12,0],[12,1],[12,2],[12,3],[12,4],[12,5],[12,6],[12,7]],
    building: [[13,0],[13,1],[13,2],[13,3],[13,4],[13,5],[13,6],[13,7]],
    celebrating: [[4,0],[4,1],[4,2],[4,3],[4,4]],
  }
  const REACTIONS = [
    ['waving', '嗨～我在呢！'],
    ['jumping', '嘿嘿，怎么啦？'],
    ['chatting', '一起加油吧！'],
    ['waving', '有什么我可以帮忙的吗？'],
  ]

  const readStorage = (key, fallback) => {
    try { return localStorage.getItem(STORAGE_PREFIX + key) ?? fallback } catch { return fallback }
  }
  const writeStorage = (key, value) => {
    try { localStorage.setItem(STORAGE_PREFIX + key, value) } catch {}
  }
  const savedPosition = (() => {
    try { return JSON.parse(readStorage('position', 'null')) } catch { return null }
  })()
  const position = {
    right: Number.isFinite(savedPosition?.right) ? savedPosition.right : 34,
    bottom: Number.isFinite(savedPosition?.bottom) ? savedPosition.bottom : 30,
  }

  const style = document.createElement('style')
  style.id = 'codex-aemeath-pet-style'
  style.textContent = PET_CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'codex-aemeath-pet'
  document.body.appendChild(root)

  let hidden = readStorage('hidden', '0') === '1'
  let animation = 'idle'
  let frame = 0
  let bubble = '你好呀，我是爱弥斯～'
  let bubbleTimer = 0
  let menuOpen = false
  let overrideUntil = 0
  let lastBusy = false
  let idleTimer = 0
  const demoTimers = new Set()
  const drag = { active: false, moved: false, startX: 0, startY: 0, right: 0, bottom: 0 }

  const clampPosition = () => {
    position.right = Math.max(4, Math.min(position.right, Math.max(4, innerWidth - 52)))
    position.bottom = Math.max(4, Math.min(position.bottom, Math.max(4, innerHeight - 52)))
  }
  const applyPosition = () => {
    clampPosition()
    root.style.right = `${position.right}px`
    root.style.bottom = `${position.bottom}px`
  }
  const setBubble = (text, duration = 0) => {
    bubble = text
    clearTimeout(bubbleTimer)
    if (duration) bubbleTimer = setTimeout(() => { bubble = ''; render() }, duration)
    render()
  }
  const setAnimation = (name) => {
    const next = FRAMES[name] ? name : 'idle'
    if (animation === next) return
    animation = next
    root.dataset.animation = animation
    frame = 0
    renderSprite()
    scheduleIdleReaction()
  }
  const playTemporary = (name, text = '', duration = 2300) => {
    overrideUntil = Date.now() + duration
    setAnimation(name)
    if (text) setBubble(text, 4200)
    setTimeout(() => {
      if (Date.now() >= overrideUntil) setAnimation('idle')
    }, duration + 30)
  }

  const renderSprite = () => {
    const sprite = root.querySelector('.codex-pet-sprite')
    if (!sprite) return
    const frames = FRAMES[animation] || FRAMES.idle
    const [row, column] = frames[frame % frames.length]
    sprite.style.backgroundPosition = `${-column * 144}px ${-row * 156}px`
    const lightTheme = document.documentElement.classList.contains('electron-light')
    const activeSpriteUrl = lightTheme ? LIGHT_SPRITE_URL : SPRITE_URL
    sprite.style.backgroundImage = `url(${JSON.stringify(activeSpriteUrl)})`
  }

  const makeMenuButton = (label, action) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      menuOpen = false
      action()
      render()
    })
    return button
  }

  const reactRandomly = () => {
    const [name, text] = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
    playTemporary(name, text)
  }

  const runStateDemo = () => {
    const states = [
      ['chatting', '正在组织回复…'],
      ['running', '正在工作…'],
      ['waiting', '等待你的指示…'],
      ['failed', '好像遇到问题了…'],
      ['celebrating', '完成啦！'],
      ['idle', ''],
    ]
    const stepDuration = 3000
    overrideUntil = Date.now() + states.length * stepDuration + 300
    for (const timer of demoTimers) clearTimeout(timer)
    demoTimers.clear()
    states.forEach(([name, text], index) => {
      const timer = setTimeout(() => {
        demoTimers.delete(timer)
        setAnimation(name)
        setBubble(text)
      }, index * stepDuration)
      demoTimers.add(timer)
    })
    const finishTimer = setTimeout(() => {
      demoTimers.delete(finishTimer)
      overrideUntil = 0
      lastBusy = false
      inferCodexState()
    }, states.length * stepDuration + 350)
    demoTimers.add(finishTimer)
  }

  const onPointerMove = (event) => {
    if (!drag.active) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true
    if (!drag.moved) return
    position.right = drag.right - dx
    position.bottom = drag.bottom - dy
    menuOpen = false
    applyPosition()
    root.querySelector('.codex-pet-sprite')?.classList.add('is-dragging')
  }
  const onPointerUp = () => {
    if (!drag.active) return
    const moved = drag.moved
    drag.active = false
    root.querySelector('.codex-pet-sprite')?.classList.remove('is-dragging')
    if (moved) writeStorage('position', JSON.stringify(position))
    else reactRandomly()
  }

  function render() {
    root.replaceChildren()
    root.dataset.animation = animation
    applyPosition()
    if (hidden) {
      const summon = document.createElement('button')
      summon.className = 'codex-pet-summon'
      summon.title = '召唤爱弥斯'
      summon.textContent = '🪄'
      summon.addEventListener('click', () => {
        hidden = false
        writeStorage('hidden', '0')
        setBubble('我回来啦～', 3200)
      })
      root.appendChild(summon)
      return
    }
    if (bubble) {
      const bubbleElement = document.createElement('div')
      bubbleElement.className = 'codex-pet-bubble'
      bubbleElement.textContent = bubble
      root.appendChild(bubbleElement)
    }
    if (menuOpen) {
      const menu = document.createElement('div')
      menu.className = 'codex-pet-menu'
      menu.append(
        makeMenuButton('🧪 依次演示六种状态', runStateDemo),
        makeMenuButton('🐾 换个表情', reactRandomly),
        makeMenuButton('💬 打个招呼', () => playTemporary('waving', '你好呀～今天也一起加油！')),
        makeMenuButton('✕ 隐藏桌宠', () => {
          hidden = true
          writeStorage('hidden', '1')
        }),
      )
      root.appendChild(menu)
    }
    const sprite = document.createElement('div')
    sprite.className = 'codex-pet-sprite'
    sprite.title = '左键互动或拖动；右键打开菜单'
    sprite.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      drag.active = true
      drag.moved = false
      drag.startX = event.clientX
      drag.startY = event.clientY
      drag.right = position.right
      drag.bottom = position.bottom
    })
    sprite.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      menuOpen = !menuOpen
      render()
    })
    root.appendChild(sprite)
    renderSprite()
  }

  const visibleText = (element) => {
    if (!(element instanceof HTMLElement)) return ''
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return ''
    return `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.textContent || ''}`.toLowerCase()
  }
  const inferCodexState = () => {
    if (Date.now() < overrideUntil) return
    const controls = [...document.querySelectorAll('button,[role="button"]')].map(visibleText).filter(Boolean)
    const approval = controls.some((text) =>
      !/approve for me/.test(text) && /^(approve|allow|confirm|批准|允许|确认)(\s|$)/.test(text.trim()))
    const stop = controls.some((text) => {
      const normalized = text.trim()
      return /^(stop|interrupt|停止|中断)$/.test(normalized) ||
        /(stop generating|stop response|停止生成|停止回复)/.test(normalized)
    })
    const alerts = [...document.querySelectorAll('[role="alert"], [data-state="error"]')]
      .map(visibleText).filter(Boolean).join('\n')
    const failed = /(error|failed|try again|retry|错误|失败|重试)/.test(alerts)

    if (approval) {
      setAnimation('waiting')
      if (!lastBusy) setBubble('等待你的指示…')
      lastBusy = true
    } else if (failed) {
      setAnimation('failed')
      if (!lastBusy) setBubble('好像遇到问题了…')
      lastBusy = true
    } else if (stop) {
      setAnimation('running')
      if (!lastBusy) setBubble('正在工作…')
      lastBusy = true
    } else if (lastBusy) {
      lastBusy = false
      setAnimation('celebrating')
      setBubble('完成啦！', 2600)
      overrideUntil = Date.now() + 1700
      setTimeout(() => { if (Date.now() >= overrideUntil) setAnimation('idle') }, 1750)
    }
  }

  function scheduleIdleReaction() {
    clearTimeout(idleTimer)
    if (animation !== 'idle') return
    idleTimer = setTimeout(() => {
      if (animation === 'idle' && Date.now() >= overrideUntil) reactRandomly()
    }, 12000 + Math.random() * 26000)
  }

  const markMessageSubmitted = () => {
    overrideUntil = Date.now() + 1800
    setAnimation('chatting')
    setBubble('正在组织回复…')
    lastBusy = true
  }

  const onDocumentClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button) return
    const label = [button.getAttribute('aria-label'), button.getAttribute('title')].join(' ').toLowerCase()
    if (/(send|submit|发送|提交)/.test(label) && !/(stop|停止)/.test(label)) markMessageSubmitted()
  }
  const onDocumentKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.matches('[contenteditable="true"], textarea') || target.closest('[contenteditable="true"]')) {
      markMessageSubmitted()
    }
  }

  const frameTimer = setInterval(() => {
    const frames = FRAMES[animation] || FRAMES.idle
    frame = (frame + 1) % frames.length
    renderSprite()
  }, FRAME_MS)
  const stateTimer = setInterval(inferCodexState, 850)
  const observer = new MutationObserver(() => inferCodexState())
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'title', 'data-state'] })
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKeyDown, true)
  addEventListener('pointermove', onPointerMove)
  addEventListener('pointerup', onPointerUp)
  addEventListener('resize', applyPosition)

  window.__codexAemeathCleanup = () => {
    clearInterval(frameTimer)
    clearInterval(stateTimer)
    clearTimeout(idleTimer)
    clearTimeout(bubbleTimer)
    for (const timer of demoTimers) clearTimeout(timer)
    observer.disconnect()
    document.removeEventListener('click', onDocumentClick, true)
    document.removeEventListener('keydown', onDocumentKeyDown, true)
    removeEventListener('pointermove', onPointerMove)
    removeEventListener('pointerup', onPointerUp)
    removeEventListener('resize', applyPosition)
    root.remove()
    style.remove()
    delete window.__codexAemeathCleanup
    delete window.__codexAemeathSetState
  }

  window.__codexAemeathSetState = (name, text = '') => {
    overrideUntil = Date.now() + 60_000
    setAnimation(name)
    setBubble(text)
    return { animation, bubble }
  }

  render()
  scheduleIdleReaction()
  setTimeout(() => setBubble('', 0), 4200)
})()
