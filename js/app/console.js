// Конзолата на тялото през главата: {"con":"..."} по /ws; отговорът идва като съобщения „co“ (текст) и „ce“ (край, r = какво
// е върнала командата, 0 = добре). Тялото приема ЕДНА команда наведнъж: докато тече една, бутоните са изключени.
import { net, on, send } from '../net_ws.js';
import { toast } from './ui.js';

const WATCHDOG_MS = 20000;
export const con = { busy: false, line: '', target: null };
const busyFns = [];
let doneFn = null;
let wd = 0;

export const onBusy = (fn) => busyFns.push(fn);
function setBusy(b) {
  if (con.busy === b) return;
  con.busy = b;
  for (const f of busyFns) { try { f(b); } catch (e) { console.error(e); } }
}

export function append(s, target) {
  const el = target || con.target;
  if (!el) return;
  el.textContent = (el.textContent + s).slice(-20000);
  el.scrollTop = el.scrollHeight;
}

// Връща true, ако редът е пратен. done({ret}) се вика, когато тялото каже „край“.
export function run(line, target, done) {
  line = String(line || '').trim();
  if (!line) return true;
  /* тялото приема най-много 240 байта на ред (UTF-8); по-дълго главата не праща (а над 1 KB по WebSocket
   * сървърът затваря връзката) */
  if (new TextEncoder().encode(line).length > 240) { toast('Редът е по-дълъг от 240 байта', true); return false; }
  if (!net.live) { toast('Демо: няма робот', true); return false; }
  if (con.busy) { toast('Тялото още изпълнява предната команда', true); return false; }
  if (!send({ con: line })) { toast('Няма връзка с главата', true); return false; }
  if (!net.linkOk) toast('Връзката не отговаря: командата може да не е стигнала', true);
  con.target = target || con.target;
  con.line = line;
  doneFn = done || null;
  append('\n> ' + line + '\n', con.target);
  setBusy(true);
  clearTimeout(wd);
  wd = setTimeout(() => { if (con.busy) { append('\n[без отговор от тялото 20 s]\n'); finish(null); } }, WATCHDOG_MS);
  return true;
}

function finish(ret) {
  clearTimeout(wd);
  const f = doneFn;
  doneFn = null;
  setBusy(false);
  if (f) { try { f({ ret }); } catch (e) { console.error(e); } }
}

on('co', (m) => append(m.s));
on('ce', (m) => { append('\n[край: ' + m.r + ']\n'); finish(m.r); });
on('ev', (m) => { if (con.busy && /още изпълнява/.test(m.s || '')) finish(null); });     // отказът на главата: нищо не е пратено
on('link', (ok) => { if (!ok && con.busy) { append('\n[връзката падна]\n'); finish(null); } });
