// Сетовете на Табло: табла с име и плочки с място и размер (24 колони, ред 30 px; 05_TABLA).
// Пазят се в браузъра (localStorage, само на това устройство), изнасят се и се внасят като JSON файл.
// Готовите („Табло“, „Каране“, „Камера“) могат да се пренареждат и се връщат с „Върни“; своите се трият.
import { PLOCHKI } from './plochki.js';

const KEY = 'monitor.tabla';
const FORMAT = 'robot-tabla';

const P = (t, x, y, w, h) => ({ t, x, y, w, h });
// „Табло“ е сегашната подредба по зоните от 02_DIZAYN 2.1, на 1600×1000 без превъртане (30 реда):
// здравето горе; вляво уредите на главата (4 колони); в средата камерата и 8×8 до 3D (15); вдясно тялото (5); графиките долу.
const TABLO = [
  P('zdrave', 0, 0, 24, 2),
  P('adi', 0, 2, 4, 7), P('hsi', 0, 9, 4, 7), P('turn', 0, 16, 4, 5), P('raw', 0, 21, 4, 5),
  P('kam', 4, 2, 6, 10), P('tof', 4, 12, 6, 14), P('3d', 10, 2, 9, 24),
  P('bat', 19, 2, 5, 3), P('tyalo', 19, 5, 5, 12), P('servo', 19, 17, 5, 7), P('zvuk', 19, 24, 5, 2),
  P('gr-naklon', 0, 26, 6, 4), P('gr-skorost', 6, 26, 6, 4), P('gr-tok', 12, 26, 6, 4), P('gr-zhiro', 18, 26, 6, 4),
];
// „Каране“: камерата голяма, под нея режимите; вдясно 3D, батерията и двата джойстика
const KARANE = [
  P('zdrave', 0, 0, 24, 2),
  P('kam', 0, 2, 15, 25), P('rezhimi', 0, 27, 15, 3),
  P('3d', 15, 2, 9, 12), P('bat', 15, 14, 9, 3), P('dvizh', 15, 17, 5, 13), P('glava', 20, 17, 4, 13),
];
// „Камера“: камерата почти на цял екран (4:3 на цялата височина), вдясно хоризонтът и батерията
const KAMERA = [
  P('kam', 0, 0, 18, 30), P('adi', 18, 0, 6, 10), P('bat', 18, 10, 6, 3),
];
const GOTOVI = [['tablo', 'Табло', TABLO], ['karane', 'Каране', KARANE], ['kamera', 'Камера', KAMERA]];

let live = false;
const m = { tek: 'tablo', setove: [] };

const copy = (list) => list.map((p) => ({ t: p.t, x: p.x, y: p.y, w: p.w, h: p.h }));
// Голямото в „Табло“: камерата или 3D (камерата и 3D си разменят местата, както ⇄)
export function razmeni(list, a, b) {
  const pa = list.find((p) => p.t === a), pb = list.find((p) => p.t === b);
  if (!pa || !pb) return list;
  for (const k of ['x', 'y', 'w', 'h']) { const v = pa[k]; pa[k] = pb[k]; pb[k] = v; }
  return list;
}
function gotovIzgled(id) {
  const g = GOTOVI.find((x) => x[0] === id);
  if (!g) return [];
  const list = copy(g[2]);
  if (id === 'tablo') {
    // както досега: с робот камерата е голяма, в демото 3D; изборът с ⇄ отпреди сетовете се зачита
    let big = live ? 'cam' : '3d';
    try { big = localStorage.getItem('monitor.big') || big; } catch (e) { /* без памет */ }
    if (big === 'cam') razmeni(list, 'kam', '3d');
  }
  return list;
}

// Каквото идва отвън (браузърът, файл), се проверява: лош сет не бива да замрази или заключи страницата
const COLS = 24, MAX_H = 40, MAX_Y = 200, MAX_PL = 60, MAX_SET = 50;
const lim = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d; };
// Името: изрязано, до 40 знака, не празно
const imeOk = (ime, d) => (typeof ime === 'string' && ime.trim() ? ime.trim().slice(0, 40) : d);
// Само познати плочки (собствено поле в каталога, не „constructor“ или „__proto__“), в мрежата, до 60;
// и по една от тези, които са само по една
function chisti(list) {
  const out = [], seen = {};
  for (const p of Array.isArray(list) ? list : []) {
    if (out.length >= MAX_PL) break;
    const t = p && typeof p.t === 'string' ? p.t : '';
    if (!Object.prototype.hasOwnProperty.call(PLOCHKI, t)) continue;     // и по-стар Safari (без Object.hasOwn)
    const def = PLOCHKI[t];
    if (def.edna && seen[t]) continue;
    seen[t] = true;
    const w = lim(p.w, 1, COLS, def.w), h = lim(p.h, 1, MAX_H, def.h);
    out.push({ t, x: lim(p.x, 0, COLS - w, 0), y: lim(p.y, 0, MAX_Y, 0), w, h });
  }
  return out;
}

// Готов сет, който не е пипан, не се пази: така „Табло“ следва робота (камерата голяма) или демото (3D)
function zapishi() {
  const list = m.setove.filter((s) => !s.gotov || s.izmenen).map((s) => ({ id: s.id, ime: s.ime, gotov: s.gotov, plochki: s.plochki }));
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, tek: m.tek, setove: list })); } catch (e) { /* без памет: до презареждане */ }
}

export function nachalo(isLive) {
  live = !!isLive;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  m.setove = GOTOVI.map(([id, ime]) => ({ id, ime, gotov: true, plochki: gotovIzgled(id) }));
  if (saved && Array.isArray(saved.setove)) {
    for (const s of saved.setove.slice(0, MAX_SET + GOTOVI.length)) {
      if (!s || typeof s !== 'object') continue;
      const g = m.setove.find((x) => x.gotov && x.id === s.id);
      if (g) {
        // пазеният готов сет без нито една годна плочка (развален запис) не изтрива подредбата по подразбиране;
        // празен е само ако Михаил сам е махнал всичко
        const pl = chisti(s.plochki);
        if (pl.length || (Array.isArray(s.plochki) && !s.plochki.length)) { g.plochki = pl; g.izmenen = true; }
      } else if (!s.gotov && (typeof s.id === 'string' || typeof s.id === 'number') && !m.setove.some((x) => x.id === String(s.id))) {
        m.setove.push({ id: String(s.id).slice(0, 40), ime: imeOk(s.ime, 'Сет'), gotov: false, plochki: chisti(s.plochki) });
      }
    }
    if (saved.tek && m.setove.some((s) => s.id === saved.tek)) m.tek = saved.tek;
  }
  return m;
}

export const setove = () => m.setove;
export const tekusht = () => m.setove.find((s) => s.id === m.tek) || m.setove[0];
export function izberi(id) {
  if (!m.setove.some((s) => s.id === id)) return tekusht();
  m.tek = id; zapishi();
  return tekusht();
}
export function zapishiPlochki(list) { const s = tekusht(); s.plochki = chisti(list); s.izmenen = true; zapishi(); }

export function zapaziKato(ime, list) {
  ime = imeOk(ime, 'Моето табло');
  let name = ime, i = 2;
  while (m.setove.some((s) => s.ime === name)) name = ime + ' ' + i++;
  const s = { id: 's' + Date.now().toString(36), ime: name, gotov: false, plochki: chisti(list) };
  m.setove.push(s); m.tek = s.id; zapishi();
  return s;
}
export function varni(id) {
  const s = m.setove.find((x) => x.id === id && x.gotov);
  if (s) { s.plochki = gotovIzgled(id); s.izmenen = false; zapishi(); }
  return s;
}
export function iztrii(id) {
  const i = m.setove.findIndex((x) => x.id === id && !x.gotov);
  if (i < 0) return;
  m.setove.splice(i, 1);
  if (m.tek === id) m.tek = 'tablo';
  zapishi();
}

export function iznesi() {
  return JSON.stringify({ format: FORMAT, v: 1, setove: m.setove.map((s) => ({ id: s.id, ime: s.ime, gotov: s.gotov, plochki: s.plochki })) }, null, 1);
}
// Внася файл от „Изнеси“: готовите взимат подредбата от файла, своите се добавят (със същото име: заменят се)
export function vnesi(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('Файлът не е JSON'); }
  const list = Array.isArray(j) ? j : j && Array.isArray(j.setove) ? j.setove : j && Array.isArray(j.plochki) ? [j] : null;
  if (!list) throw new Error('Във файла няма сетове на таблото');
  let n = 0;
  for (const s of list.slice(0, MAX_SET)) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.plochki)) continue;
    const plochki = chisti(s.plochki);
    if (!plochki.length) continue;
    const ime = imeOk(s.ime, 'Внесен сет');
    const g = m.setove.find((x) => x.gotov && x.id === s.id);
    const own = m.setove.find((x) => !x.gotov && x.ime === ime);
    if (g) { g.plochki = plochki; g.izmenen = true; }
    else if (own) own.plochki = plochki;
    else if (m.setove.length < MAX_SET + GOTOVI.length) m.setove.push({ id: 's' + Date.now().toString(36) + n, ime, gotov: false, plochki });
    else continue;
    n++;
  }
  if (!n) throw new Error('Във файла няма сетове на таблото');
  zapishi();
  return n;
}
