// Приложната част на монитора: раздели, СТОП, JSON каналът към робота, единствената камера.
// Вика се от main.js след като плочките на Табло са готови (tablo: js/dash/tablo.js).
import { initNav, onTab } from './nav.js';
import { setLive } from './api.js';
import * as net from '../net_ws.js';
import { initStopbar } from './stopbar.js';
import { makeSt } from './demo_st.js';
import { camApi } from '../ui/camera.js';
import { init as initControl } from './control.js';
import { init as initPlots } from './plots.js';
import { init as initSettings } from './settings.js';
import { init as initLogs } from './logs.js';
import { init as initSystem } from './system.js';

const PANES = [['ctl', initControl], ['plot', initPlots], ['set', initSettings], ['log', initLogs], ['sys', initSystem]];

export function initApp({ live, ctx, state, params, tablo }) {
  setLive(live);
  document.body.classList.add(live ? 'is-live' : 'is-demo');
  initStopbar(live);

  const mods = {};
  for (const [id, init] of PANES) {
    const host = document.getElementById('tab-' + id);
    try { mods[id] = init(host, ctx); } catch (e) { console.error('[' + id + ']', e); host.innerHTML = '<div class="miss">„' + id + '“ не се зареди: ' + String(e && e.message || e).slice(0, 160) + '</div>'; }
  }

  // връзката се пуска чак сега: разделите вече слушат съобщенията
  if (live) net.start();
  else {
    // демо: телеметрия „st“ от измисленото състояние, 10 пъти в секунда
    let n = 0;
    net.injectDemo(makeSt(state, n++));
    setInterval(() => net.injectDemo(makeSt(state, n++)), 100);
  }

  // единствената камера: на Табло (в плочката „Камера“, ако я има) или на Управление (голяма); другаде потокът е спрян
  let camSeen = 0, camStart = Date.now();
  function applyCam(t) {
    const cam = camApi();
    if (!cam) return;
    const dash = t === 'dash' && tablo ? tablo.camHost() : null;
    if (t === 'ctl' && mods.ctl) { cam.mount(mods.ctl.camHost); cam.setActive(true); }
    else if (dash) { cam.mount(dash); cam.setActive(true); }
    else { if (t === 'dash') cam.mount(null); cam.setActive(false); }
    camStart = camSeen = Date.now();
  }
  net.on('st', (s) => {            // кадри не стигат 3 s (спрял поток, умряла връзка): поточи наново (както в телефона)
    const cam = camApi();
    if (!live || !cam || !cam.streaming()) return;
    const c = s.c || {}, now = Date.now();
    if (!c.ok) return;
    if (c.net > 0) camSeen = now;
    else if (now - Math.max(camSeen, camStart) > 3000) { cam.restart(); camStart = camSeen = now; }
  });
  let opens = 0;
  net.on('open', () => {           // при НОВО свързване потокът е умрял със старата връзка; първото отваряне не го пипа
    if (opens++ === 0) return;
    const cam = camApi();
    if (cam) cam.restart();
    camStart = camSeen = Date.now();
  });

  let active = null;
  onTab((t, prev) => {
    ctx.tab = t;
    if (prev && mods[prev] && mods[prev].hide) mods[prev].hide();
    if (tablo && prev === 'dash' && t !== 'dash') tablo.hide();
    if (tablo && t === 'dash' && prev !== 'dash') tablo.show();
    active = mods[t] || null;
    if (active && active.show) active.show();
    applyCam(t);
  });

  let start = 'dash';
  try { start = localStorage.getItem('monitor.tab') || 'dash'; } catch (e) { /* без памет */ }
  start = params.get('tab') || start;
  initNav(start);

  return {
    update(ctx2) { if (active && active.update) active.update(ctx2); },
  };
}
