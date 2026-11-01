// Ключето: вкл/изкл на една част (елемент от каталога, 02_DIZAYN 1.14; мястото и видът: 05_TABLA).
// 34×20 на вид, полето за пръста е 44. Включено: акцент. Изключено: неутрално сиво. Частта я няма: бледо, не се натиска.
// Не се знае (още няма отговор): сиво, топчето в средата, „?“ в подсказката; натискане го прочита от робота.
// Командата е „vkl <id> on|off“ на P4, и за сервата. Състоянието е state.izk[id] (сервата: state.servos.on);
// частите, които ги няма в честотите (звукът, очите), се знаят от отговора на „vkl“. След команда се държи
// командваното, докато честотите го покажат (до 1 s на живо).
import { konzola } from '../app/api.js';
import { toast } from '../app/ui.js';
import { state } from '../state.js';
import { setClass, setAttr } from './util.js';

const HOLD_MS = 2500;        // след команда: толкова се вярва на командваното
const FRESH_MS = 1500;       // отговорът на „vkl“ е по-пресен от честотите толкова време
const chasti = {};           // последният отговор на „vkl“: {id: {on, e, at}}
const hold = {};             // {id: {on, until}}: току-що командвано
const busy = {};             // {id: true}: командата още върви
const all = new Set();       // живите ключета, за да се обновят веднага след команда
// Сервата в движение: ключето чака, иначе натискането би прекъснало центрирането
const SERVO_ZAETI = { cent: 'центрират се', park: 'отиват в средата' };

// „vkl“ или „vkl <id> on|off“: командата печата един ред JSON {"c":[...]} или {"err":"..."}
export async function vkl(line) {
  const txt = await konzola(line || 'vkl');
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('P4 не познава „vkl“ (стар фърмуер?)');
  const j = JSON.parse(txt.slice(a, b + 1));
  if (j.err) throw new Error(j.err);
  const list = Array.isArray(j.c) ? j.c : [];
  const now = performance.now();
  for (const p of list) if (p && typeof p.id === 'string') chasti[p.id] = { on: !!p.on, e: !!p.e, at: now };
  osvezhi();
  return list;
}

const vChestotite = (id) => state.izk[id] !== undefined || state.rates.some((r) => r.id === id);

// Включена ли е частта: true | false | null (не се знае)
export function vklyuchena(id) {
  const now = performance.now();
  const h = hold[id];
  if (h && now < h.until) return h.on;
  const c = chasti[id];
  if (c && now - c.at < FRESH_MS) return c.on;
  if (id === 'servo') return !!state.servos.on;
  if (vChestotite(id)) return !state.izk[id];
  return c ? c.on : null;
}
// Има ли я частта: true | false | null (не се знае). Каквото е в честотите или в телеметрията, го има.
export function ima(id) {
  if (chasti[id]) return chasti[id].e;
  if (id === 'servo' || vChestotite(id)) return true;
  return null;
}
// Сервата центрират или паркират: какво правят (иначе null)
const servoZaeti = (id) => (id === 'servo' ? SERVO_ZAETI[state.servos.mode] || null : null);

export async function smeni(id, on) {
  if (busy[id]) return null;
  busy[id] = true;
  hold[id] = { on, until: Infinity };        // показва се новото, бледо, докато командата върви
  osvezhi();
  try {
    const list = await vkl(`vkl ${id} ${on ? 'on' : 'off'}`);
    hold[id] = { on, until: performance.now() + HOLD_MS };
    return list;
  } catch (e) {
    delete hold[id];
    toast(e.message || String(e), true);
    return null;
  } finally {
    busy[id] = false;
    osvezhi();
  }
}
// Не се знае: само се прочита от робота
async function procheti(id) {
  if (busy[id]) return;
  busy[id] = true;
  osvezhi();
  try { await vkl('vkl'); } catch (e) { toast(e.message || String(e), true); }
  finally { busy[id] = false; osvezhi(); }
}

export function osvezhi() { for (const k of all) k.update(); }

// Ново ключе за частта id; ime е за подсказката („Камера“). Връща { el, update(), destroy() }.
export function klyuche(id, ime) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'klyuche';
  el.setAttribute('role', 'switch');
  el.innerHTML = '<i></i>';
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (busy[id] || ima(id) === false || servoZaeti(id)) return;
    const on = vklyuchena(id);
    if (on === null) procheti(id); else smeni(id, !on);
  });
  const k = {
    el,
    update() {
      const e = ima(id), on = e === false ? false : vklyuchena(id), b = !!busy[id], zaeti = servoZaeti(id);
      const cls = e === false ? ' none' : on === null ? ' nezn' : on ? ' on' : '';
      setClass(el, 'klyuche' + cls + (b ? ' busy' : '') + (zaeti ? ' chaka' : ''));
      setAttr(el, 'aria-checked', on === null ? 'mixed' : on ? 'true' : 'false');
      el.disabled = e === false || !!zaeti;
      const t = (ime || id) + (e === false ? ': няма я'
        : zaeti ? ': ' + zaeti + ', ключето чака'
        : on === null ? ': ? (не се знае, натисни, за да се прочете)'
        : on ? ': включена, натисни за изкл.' : ': изключена, натисни за вкл.');
      if (el.title !== t) el.title = t;
    },
    destroy() { all.delete(k); el.remove(); },
  };
  all.add(k);
  k.update();
  return k;
}
