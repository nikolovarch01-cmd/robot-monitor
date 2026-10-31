// HTTP към робота. ВАЖНО: адресите са винаги абсолютни, от location.protocol + location.host.
// Страницата се пуска от робота през малък вход (http://robot.local/m), който изтегля index.html от GitHub Pages
// и го вмъква с <base href="https://...github.io/...">. Относителен адрес би отишъл към GitHub, не към робота.
import { fixture } from './demo_st.js';

export const base = `${location.protocol}//${location.host}`;
export const wsBase = base.replace(/^http/, 'ws');
let live = false;
export const setLive = (v) => { live = !!v; };
export const isLive = () => live;
export const url = (path) => base + path;
// камерата е на порт 81 на същия хост
export const camUrl = (path) => `${location.protocol}//${location.hostname}:81${path}`;

export async function getJson(path) {
  if (!live) return fixture(path);
  const r = await fetch(url(path), { cache: 'no-store' });
  return r.json();
}
export async function postJson(path, body) {
  if (!live) return fixture(path, true);
  const r = await fetch(url(path), { method: 'POST', body });
  return r.json();
}
// POST с текст (конзолата на P4): отговорът е текстът, който командата е напечатала
export async function konzola(line) {
  if (!live) return fixture('/api/konzola', true, line);
  const r = await fetch(url('/api/konzola'), { method: 'POST', body: line });
  return r.text();
}
