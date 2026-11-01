// Общи помощници за приложните раздели (управление, графики, настройка, записи, система).
// Преведено от телефонното приложение (firmware/p4-head/main/www/index.html): същите текстове и етикети.

export const $ = (id) => document.getElementById(id);
export const q = (sel, root) => (root || document).querySelector(sel);
export const qa = (sel, root) => [...(root || document).querySelectorAll(sel)];

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fx = (v, d = 1) => (v === undefined || v === null || !isFinite(v)) ? '—' : (+v).toFixed(d);
export const num = (v) => (v === undefined || v === null || !isFinite(v)) ? '—' : String(+(+v).toPrecision(6));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const fmtUp = (s) => s >= 3600 ? Math.floor(s / 3600) + ' ч ' + Math.floor(s % 3600 / 60) + ' мин' : Math.floor(s / 60) + ' мин ' + (s % 60) + ' s';
export const kb = (b) => (b / 1024).toFixed(0) + ' KB';
export const mb = (b) => (b / 1048576).toFixed(0) + ' MB';

export const STATE_BG = {
  BOOT: 'Старт', IDLE: 'Покой', BALANCING: 'Балансира', PARKED: 'Паркиран', STANDING_UP: 'Изправя се',
  FALLEN: 'Паднал', LOW_BATTERY: 'Слаба батерия', SHUTDOWN: 'Изключва се', OTA: 'Нов фърмуер', CALIBRATING: 'Калибровка',
};
export const FLAGS = [[0x0001, 'насищане'], [0x0002, 'завой орязан'], [0x0010, 'без команда'], [0x0020, 'boost'],
  [0x0040, 'намалено'], [0x0100, 'IMU изпуска'], [0x0400, 'плъзга'], [0x1000, 'записва'], [0x2000, 'батерия!']];
export const OTA_ST = ['—', 'подготвя', 'праща', 'проверява', 'рестартира', 'готово', 'неуспех'];

// „runaway“ е очаквано, когато роботът е вдигнат (колелата бързат без команда): информация, не тревога
export function faultInfo(f) {
  if (!f || f === 'none' || f === '—' || f === 'няма') return null;
  if (f === 'runaway') return { text: 'вдигнат', cls: 'accent', info: true, hint: 'колелата бързат без команда: роботът е вдигнат (очаквано)' };
  return { text: f, cls: 'bad', info: false, hint: '' };
}

// ── съобщения (като в телефона: същото съобщение не се трупа на всеки опит) ──
let box = null;
const toastAt = {};
export function toast(msg, bad) {
  const now = Date.now();
  if (toastAt[msg] && now - toastAt[msg] < 2500) return;
  toastAt[msg] = now;
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3500);
}

// Съобщение с едно действие (↶ Върни след обратимо действие, 02_DIZAYN 1.3): само бутонът хваща пръста
export function toastAct(msg, label, fn, ms = 6000) {
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast toast-act';
  t.innerHTML = '<span></span><button class="btn mini" type="button"></button>';
  t.firstChild.textContent = msg;
  const b = t.lastChild;
  b.textContent = label;
  const tm = setTimeout(() => t.remove(), ms);
  b.addEventListener('click', () => { clearTimeout(tm); t.remove(); fn(); });
  box.appendChild(t);
}

// бележка „Демо“ в началото на раздел
export const DEMO_NOTE = '<div class="demo-note needs-live-note" hidden>Демо: няма робот. Бутоните са изключени.</div>';

// Записва текст само ако се е променил (за честите обновявания)
export function setT(node, s) { if (node && node._s !== s) { node._s = s; node.textContent = s; } }
export function setH(node, s) { if (node && node._h !== s) { node._h = s; node.innerHTML = s; } }
export function setC(node, c) { if (node && node._c !== c) { node._c = c; node.className = c; } }
export function setW(node, p) { if (node) { const v = p.toFixed(1) + '%'; if (node._w !== v) { node._w = v; node.style.width = v; } } }
