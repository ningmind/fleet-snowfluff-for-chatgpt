const port = Number(process.env.CHATGPT_THEME_PORT || process.env.CODEX_THEME_PORT || 9229)
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
const target = targets.find((entry) => entry.url === 'app://-/index.html' && entry.webSocketDebuggerUrl)
if (!target) throw new Error('ChatGPT main renderer was not found')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', () => reject(new Error('Could not connect to ChatGPT renderer')), { once: true })
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

const response = await evaluate(`(() => {
  const api = window.__codexSnowfluffTasks;
  if (!api) return { ok: false, reason: 'Task notebook API is unavailable' };
  const backup = window.__codexSnowfluffExportTasks();
  try {
    api.add('Fleet Snowfluff task test one');
    api.add('Fleet Snowfluff task test two');
    const current = window.__codexSnowfluffExportTasks();
    const date = Object.keys(current.days).sort().at(-1);
    const tasks = current.days[date].tasks.filter(task => task.text.startsWith('Fleet Snowfluff task test'));
    api.toggle(tasks[0].id);
    api.update(tasks[1].id, 'Fleet Snowfluff task edit passed');
    api.open();
    let panel = document.querySelector('.codex-task-panel');
    const draftInput = panel?.querySelector('.codex-task-add input');
    if (draftInput) {
      draftInput.value = 'unsaved draft survives render';
      draftInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    api.import(window.__codexSnowfluffExportTasks());
    panel = document.querySelector('.codex-task-panel');
    const closeButton = panel?.querySelector('.codex-task-icon-button');
    const addInput = panel?.querySelector('.codex-task-add input');
    const addButton = panel?.querySelector('.codex-task-add button');
    const interaction = {
      ok: !!panel && tasks.length === 2,
      heading: panel?.querySelector('.codex-task-header strong')?.textContent || '',
      completedRows: panel?.querySelectorAll('.codex-task-row.is-done').length || 0,
      edited: [...panel?.querySelectorAll('.codex-task-text') || []]
        .some(element => element.textContent === 'Fleet Snowfluff task edit passed'),
      badge: document.querySelector('.codex-pet-task-badge')?.textContent || '',
      draftPreserved: panel?.querySelector('.codex-task-add input')?.value === 'unsaved draft survives render',
      closeButtonWidth: closeButton ? closeButton.getBoundingClientRect().width : 0,
      addInputHeight: addInput ? addInput.getBoundingClientRect().height : 0,
      addButtonHeight: addButton ? addButton.getBoundingClientRect().height : 0,
      repeatedOpeningAnimation: panel?.classList.contains('is-opening') || false,
    };
    document.querySelector('.codex-pet-sprite')?.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, button: 2,
    }));
    interaction.rightClickClosed = !document.querySelector('.codex-task-panel');
    api.open();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
    const yesterdayKey = dateKey(yesterday);
    const todayKey = dateKey(new Date());
    api.import({
      version: 1,
      updatedAt: new Date().toISOString(),
      settings: { carryIncomplete: true },
      days: {
        [yesterdayKey]: {
          createdAt: new Date().toISOString(),
          carriedFrom: '',
          tasks: [
            { id: 'carry-me', text: 'unfinished rollover test', done: false, createdAt: '', completedAt: '', carriedFrom: '' },
            { id: 'do-not-carry', text: 'finished rollover test', done: true, createdAt: '', completedAt: '', carriedFrom: '' },
          ],
        },
      },
    });
    const rolled = window.__codexSnowfluffExportTasks().days[todayKey];
    return {
      ...interaction,
      rolloverCount: rolled?.tasks.length || 0,
      rolloverSource: rolled?.tasks[0]?.carriedFrom || '',
    };
  } finally {
    api.import(backup);
    api.close();
  }
})()`)
socket.close()
const result = response.result?.result?.value
console.log(JSON.stringify(result, null, 2))
if (!result?.ok || result.heading !== '雪绒任务簿 ❄️' || result.completedRows < 1 || !result.edited ||
  !result.draftPreserved || result.closeButtonWidth < 34 || result.addInputHeight > 30 || result.addButtonHeight > 28 ||
  result.repeatedOpeningAnimation || !result.rightClickClosed || result.rolloverCount !== 1) {
  process.exitCode = 1
}
