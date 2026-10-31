// Стартира екрана: пълни state от демото или от истинската връзка и върти един цикъл за рисуване.
//   ?demo        — само измислени данни
//   ?lan         — връзка у дома (js/net_lan.js, когато го има)
//   ?rtc         — връзка отвън (js/net_webrtc.js, когато го има)
//   ?bat=15      — (демо) начален процент на батерията, за опити
import { state, hist } from './state.js';
import { startDemo } from './demo.js';

const params = new URLSearchParams(location.search);
const PERF = params.has("perf");      // ?perf — раз в 2 s пише в конзолата колко ms на кадър хапе всеки изглед

// Общият обект, който получава всеки изглед в update(ctx): ctx.state, ctx.hist, ctx.now (ms), ctx.dt (s), ctx.slow.
// ctx.slow е вярно един кадър на 100 ms — за текстовете, които не трябва да трептят.
// ctx.tab: кой раздел се вижда (dash | ctl | plot | set | log | sys). Само изгледите на видимия раздел се обновяват.
const ctx = { state, hist, now: 0, dt: 0.016, slow: false, tab: 'dash' };

// [име, модул, място, в кои раздели се обновява: 'all' | масив; по подразбиране само Табло]
// Камерата е и в „Управление“: същата рамка (една картина от робота) се мести там.
const VIEWS = [
  ['topbar', './ui/topbar.js', '#topbar', 'all'],
  ['rates', './ui/rates.js', '#rates'],
  ['instruments', './ui/instruments.js', '#instruments'],
  ['camera', './ui/camera.js', '#v-cam', ['dash', 'ctl']],
  ['depth', './ui/depth.js', '#v-depth'],
  ['scene3d', './ui/scene3d.js', '#v-3d'],
  ['battery', './ui/battery.js', '#v-bat'],
  ['body', './ui/body.js', '#v-body'],
  ['servos', './ui/servos.js', '#v-servo'],
  ['sound', './ui/sound.js', '#v-sound'],
  ['charts', './ui/charts.js', '#charts'],
];

const views = [];
let app = null;
let raf = 0, lastMs = 0, lastSlow = 0, nFrames = 0;

export function frame(ms) {
  raf = requestAnimationFrame(frame);
  ctx.dt = lastMs ? Math.min(0.1, (ms - lastMs) / 1000) : 0.016;
  lastMs = ms; ctx.now = ms;
  ctx.slow = ms - lastSlow >= 100;
  if (ctx.slow) lastSlow = ms;
  if (app) { try { app.update(ctx); } catch (e) { console.error('[app]', e); app = null; } }
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    if (v.dead) continue;
    if (v.tabs !== 'all' && v.tabs.indexOf(ctx.tab) < 0) continue;      // раздел, който не се вижда, не се рисува
    const t0 = PERF ? performance.now() : 0;
    try { v.update(ctx); } catch (e) { v.dead = true; console.error("[" + v.name + "]", e); }
    if (PERF) v.ms = (v.ms || 0) + performance.now() - t0;
  }
  nFrames++;
}
export function startLoop() { if (!raf) { lastMs = 0; raf = requestAnimationFrame(frame); } }
export function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoop(); else startLoop(); });

// Тук се включва истинската връзка. Липсващ файл не чупи демото.
// Модулят трябва да изнася start() или името от fnName (net_lan.js изнася startLan). start може да е async.
async function tryTransport(file, label, fnName) {
  try {
    const mod = await import(file);
    const start = mod.start || mod[fnName] || mod.default;
    if (typeof start !== 'function') throw new Error('няма start() / ' + fnName + '()');
    await start({ state, hist, params });
    return true;
  } catch (e) {
    console.warn(`[${label}] не стартира (${e && e.message ? e.message : e}); минавам на демо`);
    return false;
  }
}

async function boot() {
  let live = false;
  if (!params.has('demo')) {
    // window.ROBOT_LAN: страницата е пусната от робота (http://robot.local/m, виж web.c), значи сме у дома
    if (params.has('lan') || window.ROBOT_LAN) live = await tryTransport('./net_lan.js', 'lan', 'startLan');
    else if (params.has('rtc')) live = await tryTransport('./net_webrtc.js', 'rtc', 'startRtc');
  }
  if (!live) startDemo();

  // Кое е голямо: с робот камерата, в демото 3D; изборът с ⇄ се помни (само на това устройство)
  const colC = document.getElementById('col-c');
  let big = live ? 'cam' : '3d';
  try { big = localStorage.getItem('monitor.big') || big; } catch (e) { /* без памет: по подразбиране */ }
  big = params.get('big') || big;     // ?big=cam | 3d
  colC.classList.toggle('swap', big === 'cam');
  for (const b of colC.querySelectorAll('.swap-btn')) {
    b.addEventListener('click', () => {
      const cam = colC.classList.toggle('swap');
      try { localStorage.setItem('monitor.big', cam ? 'cam' : '3d'); } catch (e) { /* няма значение */ }
    });
  }

  await Promise.all(VIEWS.map(async ([name, path, sel, tabs]) => {
    const host = document.querySelector(sel);
    try {
      const mod = await import(path);
      if (host) views.push({ name, update: mod.init(host, ctx).update, tabs: tabs || ['dash'], order: VIEWS.findIndex((x) => x[0] === name) });
    } catch (e) {
      console.error('[' + name + ']', e);
      if (host) host.insertAdjacentHTML('beforeend', `<div class="miss">„${name}“ не се зареди: ${String(e && e.message || e).slice(0, 120)}</div>`);
    }
  }));
  views.sort((a, b) => a.order - b.order);

  // Раздели, СТОП и JSON каналът към робота (js/app/app.js). Липсващ файл не чупи Табло.
  try {
    const { initApp } = await import('./app/app.js');
    app = initApp({ live, ctx, state, params });
  } catch (e) {
    console.error('[app]', e);
  }
  startLoop();
  if (PERF) setInterval(() => {
    const n = Math.max(1, nFrames);
    console.warn("perf ms/кадър: " + views.map((v) => v.name + "=" + ((v.ms || 0) / n).toFixed(2)).join(" ") + " (кадри " + nFrames + ")");
    nFrames = 0; for (const v of views) v.ms = 0;
  }, 2000);
}
boot();
