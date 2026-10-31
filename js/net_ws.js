// JSON каналът към робота: WebSocket /ws, точно като телефонното приложение
// (firmware/p4-head/main/www/index.html, команди и съобщения: началото на firmware/p4-head/main/web.c).
//   ключът от GET /api/k → {"hi":1,"k":...}; после главата праща телеметрия "st" на 10 Hz
//   движение {"v","w"} важи 300 ms → джойстикът го праща на 50 ms; пускане → v=0,w=0
//   СТОП {"stop":1}: три рамки, после се повтаря, докато телеметрията не покаже покой
// Пуска се само на живо (window.ROBOT_LAN или ?lan), не в демото.
import { wsBase, url } from './app/api.js';
import { toast, STATE_BG } from './app/ui.js';

const STALE_MS = 1000;          // по-стара телеметрия = няма връзка (сокетът може да е още „отворен“ след рестарт на P4)
const OPEN_GRACE_MS = 1500;     // след ново свързване още толкова за ключа и първата телеметрия

export const net = {
  live: false,
  ws: null, wsOk: false, linkOk: false,
  st: null,                     // последната телеметрия „st“
  stAt: 0,                      // кога (Date.now) е дошла
  hello: null,                  // {fw, proto, params}
};

// ── абонаменти ──
const subs = {};
export function on(type, fn) {
  (subs[type] = subs[type] || []).push(fn);
  return () => { subs[type] = subs[type].filter((f) => f !== fn); };
}
function emit(type, m) {
  for (const f of (subs[type] || [])) { try { f(m); } catch (e) { console.error('[net_ws ' + type + ']', e); } }
}
export const getSt = () => net.st;

// ── изпращане ──
export function send(o) {
  if (net.ws && net.wsOk && net.ws.readyState === 1) { net.ws.send(JSON.stringify(o)); return true; }
  return false;
}
// Движение и глава: само когато предишното вече е излязло. Иначе опашката расте при бавна връзка, а СТОП чака зад нея.
export function sendLive(o) {
  if (net.ws && net.wsOk && net.ws.readyState === 1 && net.ws.bufferedAmount === 0) { net.ws.send(JSON.stringify(o)); return true; }
  return false;
}
export function sendOrWarn(o) {
  if (!net.live) { toast('Демо: няма робот', true); return false; }
  if (!send(o)) { toast('Няма връзка с главата', true); return false; }
  if (!net.linkOk) toast('Връзката не отговаря: командата може да не е стигнала', true);
  return true;
}

// ── движение ──
export const drive = { v: 0, w: 0, active: false };
export function driveSet(v, w) { drive.v = v; drive.w = w; drive.active = true; }
export function driveRelease() {
  const was = drive.active;
  drive.active = false; drive.v = 0; drive.w = 0;
  if (was) send({ v: 0, w: 0 });
}
let headCmd = null;
export function headSet(pan, tilt) { headCmd = { pan, tilt }; }

// ── СТОП ──
// Праща се при допира (pointerdown), не при пускането: пръст, който се плъзне, не го отменя. Три рамки през 80 ms
// (една изгубена не е СТОП, който не е станал); хванатите джойстици се пускат. После, докато телеметрията не покаже,
// че тялото не движи (stopTick/checkStop), се праща пак и пише предупреждение.
let stopReq = null;       // {t, sent, warned}: СТОП е поискан и още не е потвърден
let stopAt = 0;
let stopTimers = [];
const stopHooks = [];
export const onStop = (fn) => stopHooks.push(fn);
export const stopPending = () => !!stopReq;
function cancelStopFrames() { for (const t of stopTimers) clearTimeout(t); stopTimers = []; }
function sendStopFrames() {
  send({ stop: 1 });
  cancelStopFrames();     // рамките на по-стар СТОП не се трупат върху новия
  stopTimers = [80, 160].map((ms) => setTimeout(() => send({ stop: 1 }), ms));
}
export function doStop() {
  drive.active = false; drive.v = 0; drive.w = 0; headCmd = null;
  for (const f of stopHooks) { try { f(); } catch (e) { console.error(e); } }
  stopAt = Date.now();
  stopReq = { t: stopAt, sent: stopAt, warned: false };
  if (!net.wsOk || !net.linkOk) toast('Няма връзка с главата: СТОП ще се прати, щом се свърже', true);
  sendStopFrames();
  emit('stop', null);
}
export const stopRecent = () => Date.now() - stopAt < 400;
// нов избор на режим (не покой) отменя чакащия СТОП и закъснелите му рамки (до 160 ms): иначе „Баланс“ би бил спрян от тях
export function cancelPendingStop() { stopReq = null; cancelStopFrames(); }
function checkStop(b) {   // от телеметрията: тялото вече не движи, СТОП е изпълнен
  /* CALIBRATING не е покой: калибровката може да върти колело, а краят ѝ е точно MODE_IDLE на СТОП */
  if (stopReq && b.on && b.st && b.st !== 'BALANCING' && b.st !== 'STANDING_UP' && b.st !== 'CALIBRATING') stopReq = null;
}
function stopTick(now) {  // на всеки 250 ms
  if (!stopReq) return;
  const age = now - stopReq.t;
  if (net.wsOk && now - stopReq.sent >= 600) { stopReq.sent = now; send({ stop: 1 }); }
  if (age > 1500 && !stopReq.warned) {
    stopReq.warned = true;
    const b = (net.st && net.st.b) || {};
    toast(!net.wsOk || !net.linkOk ? 'СТОП не е изпратен: няма връзка с главата. Ще се прати щом се свърже'
      : !b.on ? 'СТОП не е потвърден: тялото не отговаря'
      : 'СТОП не е потвърден: тялото още е „' + (STATE_BG[b.st] || b.st) + '“. Натисни пак', true);
  }
  if (age > 20000) { stopReq = null; toast('СТОП: без потвърждение 20 s. Провери робота', true); }
}

// ── връзката ──
let rcTimer = 0, connAt = 0, lastSt = 0, retry = 500;
let tickAt = performance.now(), bufSince = 0;

function setLink(ok) {
  if (ok === net.linkOk) return;
  net.linkOk = ok;
  emit('link', ok);
}

/* Нов сокет; старият, ако още виси, се оставя (след рестарт на P4 няма FIN и затварянето му не свършва). */
function connect() {
  clearTimeout(rcTimer);
  if (net.ws) { const o = net.ws; o.onopen = o.onclose = o.onerror = o.onmessage = null; try { o.close(); } catch (e) { /* виси */ } }
  net.wsOk = false;
  connAt = Date.now();
  let w;
  const later = () => { rcTimer = setTimeout(connect, retry); retry = Math.min(Math.round(retry * 1.6), 5000); };   // нарастващ интервал
  try { w = new WebSocket(wsBase + '/ws'); } catch (e) { net.ws = null; later(); return; }
  net.ws = w;
  w.onopen = () => {
    if (net.ws !== w) return;
    net.wsOk = true;
    lastSt = Date.now() + OPEN_GRACE_MS;   // от тук ключът и първата телеметрия имат OPEN_GRACE_MS + STALE_MS да дойдат
    authWs(w);                             // ключът от главата; с него тя праща телеметрия и приема команди
    emit('open', null);                    // потокът на камерата е умрял заедно със старата връзка
    if (stopReq) sendStopFrames();         // СТОП, натиснат без връзка, тръгва веднага (СТОП минава и без ключ)
  };
  w.onclose = () => { if (net.ws !== w) return; net.wsOk = false; setLink(false); later(); };
  w.onerror = () => { try { w.close(); } catch (e) { /* няма значение */ } };
  w.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch (err) { return; }
    switch (m.t) {
      case 'st':
        lastSt = Date.now(); net.st = m; net.stAt = lastSt; retry = 500;
        setLink(true);
        checkStop(m.b || {});
        break;
      case 'hello': net.hello = m; toast('Тялото: ' + m.fw); break;
      case 'ev': toast(m.s, !m.ok); break;
      default: break;
    }
    if (m.t) emit(m.t, m);
  };
}

/* Ключът на главата (GET /api/k, виж key_handler в web.c) се взема при всяко свързване, защото се сменя с рестарта
 * на P4. С него сокетът получава телеметрия и може да командва; без него приема само СТОП. Чужда страница може да
 * отвори сокета, но не може да прочете ключа. Опитва се най-много 20 пъти през 500 ms; ако не успее, часовникът
 * (по-долу) свързва наново, след като телеметрията не дойде. */
async function authWs(w) {
  for (let i = 0; i < 20; i++) {
    if (net.ws !== w || w.readyState !== 1) return;
    try {
      const r = await fetch(url('/api/k'), { cache: 'no-store' });
      if (r.ok) {
        const k = (await r.json()).k;
        if (k && net.ws === w && w.readyState === 1) send({ hi: 1, k });   // главата праща телеметрия веднага
        return;
      }
    } catch (e) { /* пак */ }
    if (i === 3 && !net.linkOk) toast('Няма ключ от главата: управлението още не работи. Опитвам пак', true);
    await new Promise((res) => setTimeout(res, 500));
  }
}

/* Връзката е жива само ако телеметрията е свежа. Сокетът може да казва „отворен“, а P4 да е рестартирал (няма FIN):
 * тогава връзката е „няма“ и се свързваме наново. Ако самата страница се е забавила (late), това не е вина на връзката. */
function watchdog() {
  const nowp = performance.now(), late = nowp - tickAt > 800;
  tickAt = nowp;
  const now = Date.now();
  if (net.ws && net.ws.readyState === 0 && now - connAt > 3000) { connect(); return; }      // свързването виси (P4 се рестартира)
  if (net.wsOk && !late) {
    const age = now - lastSt;
    if (age > STALE_MS) setLink(false);
    if (age > STALE_MS + 500) connect();
    else if (bufSince && now - bufSince > 1500) connect();                                 // P4 не приема: опашката не мърда
  }
  if (net.ws && net.ws.bufferedAmount > 0) { if (!bufSince) bufSince = now; } else bufSince = 0;
  stopTick(now);
}

export function start() {
  if (net.live) return;
  net.live = true;
  connect();
  setInterval(watchdog, 250);
  setInterval(() => { if (drive.active) sendLive({ v: drive.v, w: drive.w }); }, 50);    // главата спира сама след 300 ms без команда
  setInterval(() => { if (headCmd && sendLive(headCmd)) headCmd = null; }, 60);
  // скритата страница не бива да кара: пуска се и се спира
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && drive.active) { drive.active = false; drive.v = drive.w = 0; send({ v: 0, w: 0 }); for (const f of stopHooks) { try { f(); } catch (e) { /* няма значение */ } } }
  });
}

// Демо: телеметрия, направена от измисленото състояние (js/app/demo_st.js)
export function injectDemo(m) {
  net.st = m; net.stAt = Date.now(); net.linkOk = true;
  emit('st', m);
}
