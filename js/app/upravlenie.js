// Частите на „Управление“, които са и плочки на Табло: джойстикът за движение, джойстикът за главата, режимите,
// профилът. Един код за двете места; командите са едни (net_ws.js). Всяко make*() връща { el, destroy() }.
// Стрелките карат, докато се вижда джойстик за движение: в Управление, или плочка на Табло, видима поне наполовина и
// не в „Подреди“. Иначе стрелките превъртат страницата. Space е СТОП (stopbar.js).
import { net, on, sendOrWarn, driveSet, driveRelease, headSet, onStop, cancelPendingStop } from '../net_ws.js';
import { stick } from './joystick.js';
import { fx } from './ui.js';
import { isLive } from './api.js';
import { lockDemo } from './lock.js';
import { initNrav } from './nrav.js';
import { initChasti } from './chasti.js';

const VMAX = 400, WMAX = 2000;             // mm/s, mrad/s; таваните на профила са в тялото
const KEY_V = 240, KEY_W = 1200;           // стрелките (около 60% от хода на джойстика)
const curve = (a) => Math.sign(a) * Math.pow(Math.abs(a), 1.6);
const r1 = (v) => Math.round(v * 10) / 10;

const drives = new Set(), heads = new Set();
let srvCap = [7.5, 7.5];                   // ходът на главата от h.cap (±7.5° за първите тестове)
let lastH = {};

export const servoAllOn = (h) => !!(h && h.sm === 'on' && !(h.cut || []).some(Boolean));
// Таванът на хода като текст: „±7.5°“ (зададеният, ако го има)
export function capText(h) {
  return '±' + fx(h.capset !== undefined ? h.capset : Math.max(srvCap[0], srvCap[1]), 1) + '°';
}

on('st', (s) => {
  const h = s.h || {};
  lastH = h;
  if (Array.isArray(h.cap) && h.cap.length === 2 && h.cap.every((v) => v > 0)) srvCap = h.cap;
  for (const x of heads) x.render(h);
});

// ── клавиатура: само докато се вижда джойстик за движение ──
const keys = new Set();
const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
// джойстикът взима стрелките: показан е; плочката на Табло освен това е видима наполовина и не е в „Подреди“
const vzima = (d) => d.el.offsetParent !== null && (!d.plocha || (d.vidim && !d.el.closest('.podredi')));
const shown = () => [...drives].filter(vzima);
function applyKeys() {
  let v = 0, w = 0;
  if (keys.has('ArrowUp')) v += KEY_V;
  if (keys.has('ArrowDown')) v -= KEY_V;
  if (keys.has('ArrowLeft')) w += KEY_W;      // + е наляво
  if (keys.has('ArrowRight')) w -= KEY_W;
  if (v || w) driveSet(v, w); else driveRelease();
  for (const d of drives) { d.s.place(v || w ? -w / WMAX : 0, v || w ? -v / VMAX : 0); d.stick.classList.toggle('held', !!(v || w)); }
}
// Пуска движението: стрелките и хванатия джойстик (скрит раздел, махната плочка)
export function releaseDrive() {
  keys.clear();
  for (const d of drives) { d.s.release(); d.s.place(0, 0); d.stick.classList.remove('held'); }
  driveRelease();
}
document.addEventListener('keydown', (ev) => {
  if (!net.live || typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.code === 'Space') return;        // СТОП: stopbar.js, на всеки раздел (onStop изчиства стрелките)
  if (!/^Arrow(Up|Down|Left|Right)$/.test(ev.key)) return;
  // задържан клавиш, който още не кара, превърта страницата: не тръгва насред превъртането, когато джойстикът
  // стане видим (иначе ↓ за превъртане завършва с каране назад)
  if (ev.repeat && !keys.has(ev.key)) return;
  if (!shown().length) return;
  ev.preventDefault();
  if (!keys.has(ev.key)) { keys.add(ev.key); applyKeys(); }
});
document.addEventListener('keyup', (ev) => { if (keys.delete(ev.key)) applyKeys(); });
window.addEventListener('blur', () => { if (keys.size) { keys.clear(); applyKeys(); } });
onStop(() => {
  keys.clear();
  for (const d of drives) { d.s.release(); d.s.place(0, 0); d.stick.classList.remove('held'); }
  for (const x of heads) x.s.release();
});

function wrap(cls, lbl) {
  const el = document.createElement('div');
  el.className = 'stick-wrap';
  el.innerHTML = `<div class="stick ${cls}"><div class="knob"></div></div><div class="stick-lbl">${lbl}</div>`;
  return el;
}

// Джойстик за движение: пуснат, спира (връща се в средата). plocha: на Табло (виж vzima)
export function makeDrive(plocha) {
  const el = wrap('', 'движение'), st = el.querySelector('.stick');
  const d = { el, stick: st, plocha: !!plocha, vidim: false, io: null };
  d.s = stick(st, (x, y) => { driveSet(Math.round(-curve(y) * VMAX), Math.round(-curve(x) * WMAX)); }, () => driveRelease(), true);
  if (d.plocha) {
    // видимата част се мери под горната лента (тя е залепена и закрива); под половината движението спира
    const top = (document.getElementById('topbar') || {}).offsetHeight || 0;
    d.io = new IntersectionObserver((en) => {
      d.vidim = en[en.length - 1].intersectionRatio >= 0.5;
      if (!d.vidim && (keys.size || d.s.held())) releaseDrive();
    }, { threshold: [0, 0.5, 1], rootMargin: `-${top}px 0px 0px 0px` });
    d.io.observe(st);
  }
  drives.add(d);
  // махнат джойстик винаги спира движението (стрелки или пръст), дори да има друг в Управление
  return { el, destroy() { if (d.io) d.io.disconnect(); d.s.release(); drives.delete(d); releaseDrive(); el.remove(); } };
}

/* Главата: целият ход на джойстика е таванът (h.cap от главата). Таванът и плавността (до 20°/s) са в драйвера на P4;
 * тук само се мащабира, за да стига ръката точно до тавана. Пуснат, остава където е. Блед, докато сервата са изкл. */
export function makeHead() {
  const el = wrap('headst dim', 'глава'), st = el.querySelector('.stick'), lbl = el.querySelector('.stick-lbl');
  const x = { el, stick: st };
  x.s = stick(st, (a, b) => { headSet(r1(-a * srvCap[0]), r1(-b * srvCap[1])); }, () => {}, false);
  x.render = (h) => {
    st.classList.toggle('dim', !servoAllOn(h));
    const t = 'глава ' + capText(h);
    if (lbl.textContent !== t) lbl.textContent = t;
  };
  x.render(lastH);
  heads.add(x);
  return { el, destroy() { x.s.release(); heads.delete(x); el.remove(); } };
}
// „Глава в центъра“: джойстиците за главата отиват в средата
export function centerHeads() { for (const x of heads) x.s.place(0, 0); }

// Режимите: Баланс, Паркирай, Изправи, Покой
export function makeRezhimi() {
  const el = document.createElement('div');
  el.className = 'modes';
  el.innerHTML = `
    <button class="btn go big" type="button" data-mode="balance">Баланс</button>
    <button class="btn big" type="button" data-mode="park">Паркирай</button>
    <button class="btn big" type="button" data-mode="standup">Изправи</button>
    <button class="btn big" type="button" data-mode="idle">Покой</button>`;
  el.addEventListener('click', (ev) => {
    const t = ev.target.closest('button[data-mode]');
    if (!t) return;
    if (t.dataset.mode !== 'idle') cancelPendingStop();     // нов режим отменя чакащия СТОП
    sendOrWarn({ mode: t.dataset.mode });
  });
  return { el, destroy() { el.remove(); } };
}

// Профилът на движението: Бавен, Нормален, Пъргав (избраният от телеметрията)
export function makeProfil() {
  const el = document.createElement('div');
  el.className = 'seg';
  el.innerHTML = '<button type="button" data-p="0" title="Бавно и меко: за първи проби и тесни места">Бавен</button><button type="button" data-p="1">Нормален</button><button type="button" data-p="2">Пъргав</button>';
  el.addEventListener('click', (ev) => {
    const t = ev.target.closest('button[data-p]');
    if (t) sendOrWarn({ prof: +t.dataset.p });
  });
  const off = on('st', (s) => {
    const p = (s.d || {}).prof;
    for (const x of el.children) x.classList.toggle('on', +x.dataset.p === p);
  });
  return { el, destroy() { off(); el.remove(); } };
}

// ── плочките на Табло (js/dash/plochki.js): init(host) → { update?, show?, hide?, destroy } ──
function plocha(host, part) {
  host.appendChild(part.el);
  lockDemo(host, !isLive());
  return { destroy: part.destroy };
}
export const plDvizh = (host) => ({ ...plocha(host, makeDrive(true)), hide: releaseDrive });
export const plGlava = (host) => plocha(host, makeHead());
export const plRezhimi = (host) => plocha(host, makeRezhimi());
export const plProfil = (host) => plocha(host, makeProfil());
export function plNrav(host) {
  const n = initNrav(host);
  n.show();
  return { update: n.update, show: n.show };
}
export function plChasti(host) {
  const c = initChasti(host);
  c.show();
  return { update: c.update, show: c.show, destroy: c.destroy };
}
