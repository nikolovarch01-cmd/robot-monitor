// Връзката у дома: страницата е пусната от робота (http://robot.local/m), затова говори направо с него:
// WebSocket /mon (двоичните рамки и командите) и картината на порт 81.
import { state } from './state.js';
import { decode, bodyParams } from './proto.js';

const base = `${location.protocol}//${location.host}`;
let ws = null;
let pingTimer = 0;
let retry = 500;

export function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

async function loadParams() {
  try {
    const r = await fetch(`${base}/api/params`, { cache: 'no-store' });
    const j = await r.json();
    for (const p of (j.p || [])) {          // {"p":[{"n":"enc_cpr","v":2800,...}]}; празно, докато тялото не ги прати
      if (p && p.n in bodyParams && typeof p.v === 'number' && p.v > 0) bodyParams[p.n] = p.v;
    }
  } catch (e) { /* остават стойностите по подразбиране */ }
}

async function connect() {
  state.link.mode = 'lan';
  let key = '';
  try {
    const r = await fetch(`${base}/api/k`, { cache: 'no-store' });
    key = (await r.json()).k;
  } catch (e) {
    state.link.connected = false;
    setTimeout(connect, retry = Math.min(retry * 2, 5000));
    return;
  }
  ws = new WebSocket(`${base.replace(/^http/, 'ws')}/mon`);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    retry = 500;
    ws.send(JSON.stringify({ hi: 1, k: key }));
    state.link.connected = true;
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send({ ping: performance.now() }), 1000);
  };
  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') { decode(ev.data); return; }
    try {
      const j = JSON.parse(ev.data);
      if (j.t === 'pong') state.link.rtt_ms = performance.now() - j.ping;
    } catch (e) { /* друго съобщение */ }
  };
  ws.onclose = () => {
    state.link.connected = false;
    clearInterval(pingTimer);
    setTimeout(connect, retry = Math.min(retry * 2, 5000));
  };
}

export function startLan() {
  state.camera.url = `http://${location.hostname}:81/kamera`;
  loadParams();
  connect();
}
