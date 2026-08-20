(() => {
  window.__codexAemeathCleanup?.()

  const PET_CSS = __CODEX_PET_CSS_JSON__
  const SPRITE_URL = __CODEX_PET_SPRITE_DATA_URL_JSON__
  const LIGHT_SPRITE_URL = __CODEX_PET_LIGHT_SPRITE_DATA_URL_JSON__
  const FILE_TASKS = typeof __CODEX_TASKS_JSON__ === 'undefined' ? null : __CODEX_TASKS_JSON__
  const TASKS_MARKDOWN_PATH = typeof __CODEX_TASKS_MARKDOWN_PATH_JSON__ === 'undefined'
    ? '~/Documents/Fleet Snowfluff/daily-tasks.md' : __CODEX_TASKS_MARKDOWN_PATH_JSON__
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
  const localDateKey = (date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const cloneValue = (value) => JSON.parse(JSON.stringify(value))
  const emptyNotebook = () => ({ version: 1, updatedAt: '', settings: { carryIncomplete: true }, days: {} })
  const normalizeNotebook = (value) => {
    const result = emptyNotebook()
    if (!value || typeof value !== 'object') return result
    result.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
    result.settings.carryIncomplete = value.settings?.carryIncomplete !== false
    const days = value.days && typeof value.days === 'object' ? value.days : {}
    for (const [date, entry] of Object.entries(days).sort().slice(-120)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entry?.tasks)) continue
      result.days[date] = {
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
        carriedFrom: typeof entry.carriedFrom === 'string' ? entry.carriedFrom : '',
        tasks: entry.tasks.slice(0, 300).flatMap((task) => {
          if (!task || typeof task.text !== 'string') return []
          const text = task.text.trim().replace(/\s+/g, ' ').slice(0, 240)
          if (!text) return []
          return [{
            id: typeof task.id === 'string' ? task.id : `${date}-${Math.random().toString(36).slice(2)}`,
            text,
            done: task.done === true,
            createdAt: typeof task.createdAt === 'string' ? task.createdAt : '',
            completedAt: typeof task.completedAt === 'string' ? task.completedAt : '',
            carriedFrom: typeof task.carriedFrom === 'string' ? task.carriedFrom : '',
          }]
        }),
      }
    }
    return result
  }
  const storedNotebook = (() => {
    try { return normalizeNotebook(JSON.parse(readStorage('task-notebook.v1', 'null'))) } catch { return emptyNotebook() }
  })()
  const fileNotebook = normalizeNotebook(FILE_TASKS)
  let taskNotebook = Date.parse(fileNotebook.updatedAt || 0) > Date.parse(storedNotebook.updatedAt || 0)
    ? fileNotebook : storedNotebook
  let taskDate = localDateKey()
  const saveTaskNotebook = () => {
    taskNotebook.updatedAt = new Date().toISOString()
    writeStorage('task-notebook.v1', JSON.stringify(taskNotebook))
  }
  const newTaskId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ensureTodayTasks = () => {
    taskDate = localDateKey()
    if (taskNotebook.days[taskDate]) return 0
    const previousDate = Object.keys(taskNotebook.days).filter((date) => date < taskDate).sort().at(-1) || ''
    const previousTasks = previousDate && taskNotebook.settings.carryIncomplete
      ? taskNotebook.days[previousDate].tasks.filter((task) => !task.done) : []
    const now = new Date().toISOString()
    taskNotebook.days[taskDate] = {
      createdAt: now,
      carriedFrom: previousTasks.length ? previousDate : '',
      tasks: previousTasks.map((task) => ({
        ...task,
        id: newTaskId(),
        done: false,
        createdAt: now,
        completedAt: '',
        carriedFrom: previousDate,
      })),
    }
    for (const oldDate of Object.keys(taskNotebook.days).sort().slice(0, -90)) delete taskNotebook.days[oldDate]
    saveTaskNotebook()
    return previousTasks.length
  }
  const initialCarryCount = ensureTodayTasks()
  writeStorage('task-notebook.v1', JSON.stringify(taskNotebook))
  const todayTasks = () => taskNotebook.days[taskDate]?.tasks || []
  const incompleteTaskCount = () => todayTasks().filter((task) => !task.done).length
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
  let bubble = initialCarryCount ? `已结转 ${initialCarryCount} 项未完成任务～` : '你好呀，我是爱弥斯～'
  let bubbleTimer = 0
  let menuOpen = false
  let notebookOpen = false
  let editingTaskId = ''
  let newTaskDraft = ''
  let editingTaskDraft = ''
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
    if (duration) bubbleTimer = setTimeout(() => {
      bubble = ''
      if (!notebookOpen) render()
    }, duration)
    if (!notebookOpen) render()
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

  const commitTaskChange = () => {
    saveTaskNotebook()
    render()
  }
  const addTask = (text) => {
    const normalized = text.trim().replace(/\s+/g, ' ').slice(0, 240)
    if (!normalized) return false
    ensureTodayTasks()
    const now = new Date().toISOString()
    todayTasks().push({ id: newTaskId(), text: normalized, done: false, createdAt: now, completedAt: '', carriedFrom: '' })
    commitTaskChange()
    playTemporary('waving', `记下啦：${normalized}`, 1800)
    return true
  }
  const updateTask = (id, text) => {
    const task = todayTasks().find((entry) => entry.id === id)
    const normalized = text.trim().replace(/\s+/g, ' ').slice(0, 240)
    if (!task || !normalized) return false
    task.text = normalized
    editingTaskId = ''
    editingTaskDraft = ''
    commitTaskChange()
    return true
  }
  const toggleTask = (id) => {
    const task = todayTasks().find((entry) => entry.id === id)
    if (!task) return
    task.done = !task.done
    task.completedAt = task.done ? new Date().toISOString() : ''
    saveTaskNotebook()
    render()
    if (task.done && incompleteTaskCount() === 0) playTemporary('celebrating', '今天的任务都完成啦！', 2600)
    else if (task.done) playTemporary('jumping', '完成一项，真棒！', 1800)
    else playTemporary('waving', '已恢复这项任务～', 1600)
  }
  const removeTask = (id) => {
    const day = taskNotebook.days[taskDate]
    if (!day) return
    day.tasks = day.tasks.filter((task) => task.id !== id)
    if (editingTaskId === id) editingTaskId = ''
    commitTaskChange()
  }
  const clearCompletedTasks = () => {
    const day = taskNotebook.days[taskDate]
    if (!day) return
    day.tasks = day.tasks.filter((task) => !task.done)
    commitTaskChange()
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

  const renderTaskNotebookPanel = (animate = false) => {
    ensureTodayTasks()
    const panel = document.createElement('section')
    panel.className = `codex-task-panel${animate ? ' is-opening' : ''}`
    panel.setAttribute('aria-label', '雪绒任务簿')

    const header = document.createElement('div')
    header.className = 'codex-task-header'
    const heading = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = '雪绒任务簿 ❄️'
    const date = document.createElement('span')
    date.textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
      .format(new Date(`${taskDate}T12:00:00`))
    heading.append(title, date)
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'codex-task-icon-button'
    close.title = '关闭任务簿'
    close.textContent = '×'
    close.addEventListener('click', () => { notebookOpen = false; editingTaskId = ''; render() })
    header.append(heading, close)

    const form = document.createElement('form')
    form.className = 'codex-task-add'
    const input = document.createElement('input')
    input.type = 'text'
    input.maxLength = 240
    input.placeholder = '速记一项今日任务…'
    input.setAttribute('aria-label', '新增今日任务')
    input.value = newTaskDraft
    input.addEventListener('input', () => { newTaskDraft = input.value })
    const add = document.createElement('button')
    add.type = 'submit'
    add.textContent = '添加'
    form.append(input, add)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const value = input.value
      newTaskDraft = ''
      if (addTask(value)) {
        setTimeout(() => root.querySelector('.codex-task-add input')?.focus(), 0)
      } else newTaskDraft = value
    })

    const summary = document.createElement('div')
    summary.className = 'codex-task-summary'
    const remaining = incompleteTaskCount()
    const completed = todayTasks().length - remaining
    summary.textContent = `待完成 ${remaining} · 已完成 ${completed}`

    const list = document.createElement('div')
    list.className = 'codex-task-list'
    if (!todayTasks().length) {
      const empty = document.createElement('div')
      empty.className = 'codex-task-empty'
      empty.textContent = '今天还没有任务，先记下一件小事吧。'
      list.appendChild(empty)
    }
    for (const task of todayTasks()) {
      const row = document.createElement('div')
      row.className = `codex-task-row${task.done ? ' is-done' : ''}`
      row.dataset.taskId = task.id
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = task.done
      checkbox.setAttribute('aria-label', task.done ? `恢复任务：${task.text}` : `完成任务：${task.text}`)
      checkbox.addEventListener('change', () => toggleTask(task.id))
      row.appendChild(checkbox)

      if (editingTaskId === task.id) {
        const editForm = document.createElement('form')
        editForm.className = 'codex-task-edit'
        const editInput = document.createElement('input')
        editInput.type = 'text'
        editInput.maxLength = 240
        editInput.value = editingTaskDraft || task.text
        editInput.addEventListener('input', () => { editingTaskDraft = editInput.value })
        const save = document.createElement('button')
        save.type = 'submit'
        save.textContent = '保存'
        const cancel = document.createElement('button')
        cancel.type = 'button'
        cancel.textContent = '取消'
        cancel.addEventListener('click', () => { editingTaskId = ''; editingTaskDraft = ''; render() })
        editForm.append(editInput, save, cancel)
        editForm.addEventListener('submit', (event) => { event.preventDefault(); updateTask(task.id, editInput.value) })
        row.appendChild(editForm)
        setTimeout(() => { editInput.focus(); editInput.select() }, 0)
      } else {
        const text = document.createElement('span')
        text.className = 'codex-task-text'
        text.textContent = task.text
        text.title = task.carriedFrom ? `结转自 ${task.carriedFrom}` : task.text
        const actions = document.createElement('div')
        actions.className = 'codex-task-actions'
        const edit = document.createElement('button')
        edit.type = 'button'
        edit.title = '编辑任务'
        edit.textContent = '✎'
        edit.addEventListener('click', () => { editingTaskId = task.id; editingTaskDraft = task.text; render() })
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.title = '删除任务'
        remove.textContent = '×'
        remove.addEventListener('click', () => removeTask(task.id))
        actions.append(edit, remove)
        row.append(text, actions)
      }
      list.appendChild(row)
    }

    const controls = document.createElement('div')
    controls.className = 'codex-task-controls'
    const carryLabel = document.createElement('label')
    const carry = document.createElement('input')
    carry.type = 'checkbox'
    carry.checked = taskNotebook.settings.carryIncomplete
    carry.addEventListener('change', () => {
      taskNotebook.settings.carryIncomplete = carry.checked
      commitTaskChange()
    })
    const carryText = document.createElement('span')
    carryText.textContent = '自动结转未完成'
    carryLabel.append(carry, carryText)
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.textContent = '清除已完成'
    clear.disabled = completed === 0
    clear.addEventListener('click', clearCompletedTasks)
    controls.append(carryLabel, clear)

    const sync = document.createElement('div')
    sync.className = 'codex-task-sync'
    sync.textContent = '本机同步：daily-tasks.md'
    sync.title = TASKS_MARKDOWN_PATH
    panel.append(header, form, summary, list, controls, sync)
    requestAnimationFrame(() => {
      if (!panel.isConnected) return
      const panelWidth = panel.offsetWidth
      const rootLeft = innerWidth - position.right - 144
      const ideal = (144 - panelWidth) / 2
      const minimum = 12 - rootLeft
      const maximum = innerWidth - 12 - panelWidth - rootLeft
      panel.style.left = `${Math.max(minimum, Math.min(ideal, maximum))}px`
    })
    return panel
  }

  function render() {
    const panelWasOpen = Boolean(root.querySelector('.codex-task-panel'))
    root.replaceChildren()
    root.dataset.animation = animation
    applyPosition()
    const carried = ensureTodayTasks()
    if (carried && !bubble) bubble = `已结转 ${carried} 项未完成任务～`
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
    if (bubble && !menuOpen && !notebookOpen) {
      const bubbleElement = document.createElement('div')
      bubbleElement.className = 'codex-pet-bubble'
      bubbleElement.textContent = bubble
      root.appendChild(bubbleElement)
    }
    if (menuOpen) {
      const menu = document.createElement('div')
      menu.className = 'codex-pet-menu'
      menu.append(
        makeMenuButton(`📝 雪绒任务簿${incompleteTaskCount() ? ` (${incompleteTaskCount()})` : ''}`, () => {
          notebookOpen = true
          editingTaskId = ''
          setTimeout(() => root.querySelector('.codex-task-add input')?.focus(), 0)
        }),
        makeMenuButton('🧪 状态演示', runStateDemo),
        makeMenuButton('🐾 换个表情', reactRandomly),
        makeMenuButton('💬 打个招呼', () => playTemporary('waving', '你好呀～今天也一起加油！')),
        makeMenuButton('✕ 隐藏桌宠', () => {
          hidden = true
          writeStorage('hidden', '1')
        }),
      )
      root.appendChild(menu)
    }
    if (notebookOpen) root.appendChild(renderTaskNotebookPanel(!panelWasOpen))
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
    const taskCount = incompleteTaskCount()
    if (taskCount) {
      const badge = document.createElement('div')
      badge.className = 'codex-pet-task-badge'
      badge.textContent = taskCount > 99 ? '99+' : String(taskCount)
      badge.title = `${taskCount} 项今日任务待完成`
      root.appendChild(badge)
    }
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
    if (event.key === 'Escape' && (notebookOpen || menuOpen)) {
      notebookOpen = false
      menuOpen = false
      editingTaskId = ''
      render()
      return
    }
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
    delete window.__codexSnowfluffExportTasks
    delete window.__codexSnowfluffTasks
  }

  window.__codexAemeathSetState = (name, text = '') => {
    overrideUntil = Date.now() + 60_000
    setAnimation(name)
    setBubble(text)
    return { animation, bubble }
  }

  window.__codexSnowfluffExportTasks = () => cloneValue(taskNotebook)
  window.__codexSnowfluffTasks = {
    open: () => { notebookOpen = true; menuOpen = false; render(); return true },
    close: () => { notebookOpen = false; editingTaskId = ''; editingTaskDraft = ''; render(); return true },
    add: (text) => addTask(String(text || '')),
    update: (id, text) => updateTask(String(id || ''), String(text || '')),
    toggle: (id) => { toggleTask(String(id || '')); return true },
    remove: (id) => { removeTask(String(id || '')); return true },
    clearCompleted: () => { clearCompletedTasks(); return true },
    import: (value) => {
      taskNotebook = normalizeNotebook(value)
      taskDate = localDateKey()
      ensureTodayTasks()
      writeStorage('task-notebook.v1', JSON.stringify(taskNotebook))
      editingTaskId = ''
      editingTaskDraft = ''
      render()
      return cloneValue(taskNotebook)
    },
  }

  render()
  scheduleIdleReaction()
  setTimeout(() => setBubble('', 0), 4200)
})()
