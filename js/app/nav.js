// Разделите в горната лента: Табло · Управление · Графики · Настройка · Записи · Система.
// Видимият раздел е в ctx.tab; main.js обновява само неговите изгледи.
export const TABS = [
  ['dash', 'Табло'], ['ctl', 'Управление'], ['plot', 'Графики'], ['set', 'Настройка'], ['log', 'Записи'], ['sys', 'Система'],
];
const IDS = TABS.map((t) => t[0]);
let current = 'dash';
const listeners = [];

export const currentTab = () => current;
export const onTab = (fn) => listeners.push(fn);

export function showTab(t, remember = true) {
  if (IDS.indexOf(t) < 0) t = 'dash';
  const prev = current;
  current = t;
  for (const id of IDS) {
    const pane = document.getElementById('tab-' + id);
    if (pane) pane.hidden = id !== t;
  }
  document.querySelectorAll('#tabs .tab-btn').forEach((b) => {
    const on = b.dataset.tab === t;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  document.body.dataset.tab = t;
  if (remember) { try { localStorage.setItem('monitor.tab', t); } catch (e) { /* без памет */ } }
  for (const f of listeners) { try { f(t, prev); } catch (e) { console.error('[tab]', e); } }
  window.scrollTo(0, 0);
}

export function initNav(startTab) {
  const nav = document.getElementById('tabs');
  if (nav) {
    nav.innerHTML = TABS.map(([id, name]) => `<button class="tab-btn" type="button" data-tab="${id}">${name}</button>`).join('');
    nav.addEventListener('click', (ev) => {
      const b = ev.target.closest('.tab-btn');
      if (b) showTab(b.dataset.tab);
    });
  }
  showTab(startTab, false);
}
