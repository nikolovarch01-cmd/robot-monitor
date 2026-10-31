// Раздел „Записи“: старт и стоп на запис от тялото (400 Hz), списък на записите (SD картата И паметта на P4),
// сваляне (CSV, bin), изтриване, SD картата наново, и вграден преглед на запис с графики (logview.js).
// Форматите са тези на web.c: GET /api/logs {sd,sdTotal,sdFree,files:[{f,size,n}]}, GET /api/log?f=..&fmt=csv|bin,
// POST /api/logdel?f=..; записът от тялото върви в паметта на P4 (около 164 s на 400 Hz) и се чете без SD карта.
import { net, on, sendOrWarn } from '../net_ws.js';
import { getJson, postJson, url, isLive } from './api.js';
import { esc, mb, toast, DEMO_NOTE, setH } from './ui.js';
import { lockDemo } from './lock.js';
import { initViewer } from './logview.js';

const RAM_MAX_S = 164;

export function init(root) {
  root.innerHTML = `
  ${DEMO_NOTE}
  <div class="logs">
    <div class="logs-col">
      <div class="card">
        <div class="ct"><span>Запис от тялото</span></div>
        <div class="formrow">
          <label>секунди (0 = до стоп)<input class="inp" data-r="logS" type="number" inputmode="numeric" min="0" max="65535" value="10"></label>
          <label>честота<select class="inp" data-r="logDec"><option value="1">400 Hz</option><option value="2">200 Hz</option><option value="4">100 Hz</option></select></label>
        </div>
        <div class="btnrow">
          <button class="btn go" type="button" data-act="start">● Старт</button>
          <button class="btn bad" type="button" data-act="stop">■ Стоп</button>
        </div>
        <div class="logstate" data-r="logState">—</div>
        <div class="small dim" data-r="ramNote" hidden>Без SD карта записът остава в паметта на P4 (до около ${RAM_MAX_S} s на 400 Hz) и се чете оттам, без карта.</div>
      </div>
      <div class="card">
        <div class="ct"><span>Записите <span class="dim" data-r="sdInfo"></span></span></div>
        <div class="btnrow"><button class="btn" type="button" data-act="reload" data-keep>Обнови</button><button class="btn" type="button" data-act="sdmount">SD картата наново</button></div>
        <div class="loglist" data-r="logList">—</div>
      </div>
    </div>
    <div class="card lv" data-r="viewer" data-keep></div>
  </div>`;
  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;
  const viewer = initViewer(R.viewer);
  let visible = false, logWasOn = false;

  function renderLog(l, sd, b) {
    let s;
    if (l.on) {
      const el = (l.ms / 1000).toFixed(1);
      s = '<b class="rec">● записва</b> ' + esc(l.f) + ' · ' + l.n + ' записа · ' + el + ' s' + (l.s ? ' от ' + l.s : '') +
        (l.lost ? ' · липсват ' + l.lost : '') + (l.drop ? ' · не влезли ' + l.drop : '') + ' · ' + (l.sd ? 'SD картата' : 'паметта на P4') +
        (b && b.logfill != null ? ' · буфер на тялото ' + Math.round(b.logfill * 100) + '%' : '');
    } else {
      s = 'Не записва.' + (sd ? ' Записите отиват на SD картата.' : ' Няма SD карта: записът остава в паметта на P4 (около ' + RAM_MAX_S + ' s).');
    }
    setH(R.logState, s);
    R.ramNote.hidden = !!sd;
    if (logWasOn && !l.on && visible) setTimeout(loadLogs, 400);
    logWasOn = !!l.on;
  }
  on('st', (s) => { if (visible || (logWasOn !== !!(s.log && s.log.on))) renderLog(s.log || {}, s.sd, s.b); });

  async function loadLogs() {
    try {
      const j = await getJson('/api/logs');
      R.sdInfo.textContent = j.sd ? '(SD: свободни ' + mb(j.sdFree) + ' от ' + mb(j.sdTotal) + ')' : '(няма SD карта)';
      const f = j.files || [];
      R.logList.innerHTML = f.length ? f.map((e) => {
        const ram = e.f === 'ram';
        const q = encodeURIComponent(e.f);
        return `<div class="file"><div class="fn"><b>${esc(ram ? 'ram' : e.f)}</b>${ram ? ' <span class="chip accent">паметта на P4</span>' : ''}<br><span class="dim">${e.n.toLocaleString('bg')} записа · ${(e.size / 1024).toFixed(0)} KB</span></div>
          <button class="btn mini acc" type="button" data-view="${esc(e.f)}" data-n="${e.n}" data-keep>Виж</button>
          <a class="btn mini" href="${url('/api/log?f=' + q + '&fmt=csv')}" download data-keep ${isLive() ? '' : 'aria-disabled="true"'}>CSV</a>
          <a class="btn mini" href="${url('/api/log?f=' + q + '&fmt=bin')}" download data-keep ${isLive() ? '' : 'aria-disabled="true"'}>bin</a>
          <button class="btn mini bad" type="button" data-del="${esc(e.f)}" title="Изтрий">✕</button></div>`;
      }).join('') : 'няма записи';
      if (!isLive()) lockDemo(R.logList, true);
    } catch (e) { R.logList.textContent = 'не се прочетоха: ' + e; }
  }
  R.logList.addEventListener('click', async (ev) => {
    const v = ev.target.closest('[data-view]');
    if (v) { viewer.open(v.dataset.view, +v.dataset.n || 0); return; }
    const d = ev.target.closest('[data-del]');
    if (!d || !confirm('Да изтрия ли ' + d.dataset.del + '?')) return;
    try {
      const j = await postJson('/api/logdel?f=' + encodeURIComponent(d.dataset.del), '');
      toast(j.ok ? 'Изтрит' : j.err, !j.ok);
    } catch (e) { toast('' + e, true); }
    loadLogs();
  });

  // SD картата наново: бутонът е заключен до отговора ('sd' по WebSocket); текстът на отговора идва като съобщение
  let sdTimer = 0;
  const sdBtn = root.querySelector('[data-act="sdmount"]');
  function sdDone() {
    clearTimeout(sdTimer);
    sdBtn.disabled = !isLive();
    sdBtn.textContent = 'SD картата наново';
    if (visible) loadLogs();
  }
  on('sd', sdDone);
  async function sdMount() {
    if (sdBtn.disabled) return;
    sdBtn.disabled = true;
    sdBtn.textContent = 'монтира се...';
    sdTimer = setTimeout(sdDone, 12000);      // ако отговорът се загуби (връзката падна)
    try {
      const j = await (await fetch(url('/api/sd'), { method: 'POST' })).json();
      if (!j.ok) { toast(j.err || 'SD картата: отказ', true); sdDone(); }
    } catch (e) { toast('SD картата: ' + e, true); sdDone(); }
  }

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'start': sendOrWarn({ log: { s: Math.max(0, Math.min(65535, parseInt(R.logS.value, 10) || 0)), dec: +R.logDec.value } }); break;
      case 'stop': sendOrWarn({ cmd: 'logstop' }); break;
      case 'reload': loadLogs(); break;
      case 'sdmount': sdMount(); break;
      default: break;
    }
  });

  lockDemo(root, !isLive());
  return {
    show() { visible = true; loadLogs(); const s = net.st; if (s) renderLog(s.log || {}, s.sd, s.b); },
    hide() { visible = false; },
    update() {},
  };
}
