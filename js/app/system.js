// Раздел „Система“: версии, връзката с тялото, качване на фърмуер (тяло и глава), конзолата на тялото,
// главата (пазач на серво, нула на тока, жироскоп), съобщения, рестарт на главата. Всичко от раздел „Система“ на телефона.
import { net, on, sendOrWarn } from '../net_ws.js';
import { getJson, url, isLive } from './api.js';
import { esc, fx, fmtUp, kb, mb, toast, OTA_ST, DEMO_NOTE, setT } from './ui.js';
import { lockDemo } from './lock.js';
import { run, onBusy, con } from './console.js';
import { curZeroGo, himuCalGo } from './actions.js';

export function init(root) {
  root.innerHTML = `
  ${DEMO_NOTE}
  <div class="sys">
    <div class="sys-col">
      <div class="card"><div class="ct"><span>Версии</span></div><div class="small sysver" data-r="sysVer">—</div></div>
      <div class="card"><div class="ct"><span>Връзката с тялото</span></div><div class="kv small" data-r="sysLink">—</div></div>
      <div class="card">
        <div class="ct"><span>Главата</span></div>
        <div class="kv small" data-r="sysHead">—</div>
        <div class="formrow sp-top">
          <label>прагът на запънато серво, A на 5 V<input class="inp" data-r="guardThr" type="number" inputmode="decimal" step="0.05" min="0.3" max="0.7"></label>
          <button class="btn" type="button" data-act="guardSet">Запази</button>
        </div>
        <div class="btnrow"><button class="btn" type="button" data-act="curzero">Нула на тока</button><button class="btn" type="button" data-act="himucal">Жироскоп на главата</button></div>
      </div>
      <div class="card"><div class="ct"><span>Съобщения</span></div><div class="small sysev" data-r="sysEvents">—</div></div>
      <button class="btn bad" type="button" data-act="p4Reboot">Рестарт на главата</button>
    </div>
    <div class="sys-col">
      <div class="card">
        <div class="ct"><span>Фърмуер на тялото (XIAO)</span></div>
        <div class="small dim">Само в покой (IDLE). Файлът е build/xiao_body.bin. Копие остава на SD картата.</div>
        <input class="inp file" type="file" data-r="fwBody" accept=".bin">
        <div class="btnrow"><button class="btn acc" type="button" data-act="fwBodyGo">Качи в тялото</button><button class="btn" type="button" data-act="fwBodySd">Пак от SD картата</button><button class="btn" type="button" data-act="fwBodyStop">Спри</button></div>
        <div class="prog"><i data-r="fwBodyBar"></i></div>
        <div class="small" data-r="fwBodyMsg">—</div>
      </div>
      <div class="card">
        <div class="ct"><span>Фърмуер на главата (P4)</span></div>
        <div class="small dim">Файлът е build/p4_head.bin. После P4 се рестартира; ако новият не тръгне, при следващия рестарт се връща старият.</div>
        <input class="inp file" type="file" data-r="fwHead" accept=".bin">
        <div class="btnrow"><button class="btn acc" type="button" data-act="fwHeadGo">Качи в главата</button></div>
        <div class="prog"><i data-r="fwHeadBar"></i></div>
        <div class="small" data-r="fwHeadMsg">—</div>
      </div>
      <div class="card">
        <div class="ct"><span>Конзолата на тялото</span></div>
        <div class="btnrow"><button class="btn mini" type="button" data-con="help">help</button><button class="btn mini" type="button" data-con="state">state</button><button class="btn mini" type="button" data-con="version">version</button><button class="btn mini" type="button" data-con="bat">bat</button><button class="btn mini" type="button" data-act="conClear" data-keep>изчисти</button></div>
        <pre class="con" data-r="conOut"></pre>
        <div class="conIn"><input class="inp" data-r="conLine" placeholder="команда към тялото" maxlength="240" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn acc" type="button" data-act="conSend">Прати</button></div>
      </div>
    </div>
  </div>`;
  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;
  let visible = false;

  async function loadSys() {
    try {
      const j = await getJson('/api/sys');
      const p = j.p4 || {}, b = j.body || {}, l = j.link || {}, sd = j.sd || {}, g = j.guard || {};
      R.sysVer.innerHTML = '<b>Главата:</b> ' + esc(p.ver) + ' · ' + esc(p.date) + ' ' + esc(p.time) + ' · дял ' + esc(p.part) +
        (p.pending ? ' <span class="chip warn">нов: потвърждава се, щом телефонът е свързан и тялото отговаря (иначе се връща старият)</span>' : '') + '<br><span class="dim">IDF ' + esc(p.idf) +
        ' · памет ' + Math.round(p.heap / 1024) + ' KB, PSRAM ' + Math.round(p.psram / 1048576) + ' MB · работи ' + fmtUp(p.up) + '</span><br>' +
        '<b>Тялото:</b> ' + (b.hello ? esc(b.fw) + ' · протокол ' + b.proto + ' · ' + b.params + ' параметъра' : (b.on ? 'старото тяло (без HELLO)' : 'няма връзка')) +
        '<br><b>Wi-Fi:</b> ' + esc(j.wifi) + ' · телефони ' + j.clients +
        '<br><b>SD:</b> ' + (sd.ok ? esc(sd.name) + ', свободни ' + mb(sd.free) + ' от ' + mb(sd.total) : 'няма карта');
      R.sysLink.innerHTML = '<div><span class="k">приети</span><b>' + l.ok + '</b></div><div><span class="k">грешен CRC</span><b>' + l.bad + '</b></div>' +
        '<div><span class="k">пратени</span><b>' + l.tx + '</b></div><div><span class="k">STATE2</span><b>' + l.s2 + '</b></div>' +
        '<div><span class="k">изпуснати STATE2</span><b>' + l.s2lost + '</b></div><div><span class="k">изпуснати DRIVE2/s</span><b>' + l.dlost + '</b></div>' +
        '<div><span class="k">STATE (старо)</span><b>' + l.s1 + '</b></div><div><span class="k">HELLO</span><b>' + l.hello + '</b></div>' +
        '<div><span class="k">рамки запис</span><b>' + l.logf + '</b></div><div><span class="k">рестарти на тялото</span><b>' + l.reboots + '</b></div>';
      R.sysHead.innerHTML = '<div><span class="k">IMU</span><b>' + (g.imu ? 'ок' : 'няма') + '</b></div><div><span class="k">VL53L5CX</span><b>' + (g.tof ? 'ок' : 'няма') + '</b></div>' +
        '<div><span class="k">VL53L1X отзад</span><b>' + (g.rear ? 'отговаря' : 'няма') + '</b></div><div><span class="k">спирания (ток)</span><b>' + g.cuts + '</b></div>' +
        '<div><span class="k">спирания (IMU)</span><b>' + (g.wdcuts || 0) + '</b></div><div><span class="k">серва</span><b>' + (g.cal ? 'центрирани' : 'не са центрирани') +
        ', ±' + fx(g.cap, 1) + '°</b></div>' +
        '<div class="wide"><span class="k">пазач на тока</span><b>' + (g.ready ? '<span class="good">готов</span>' :
          '<span class="warnc">НЕ Е ГОТОВ</span>: ' + esc(g.why || 'няма причина') + ' (сервата работят без него)') + '</b></div>';
      if (g.tmin > 0 && g.tmax > g.tmin) { R.guardThr.min = g.tmin; R.guardThr.max = g.tmax; }   // в тях главата реже прага
      if (document.activeElement !== R.guardThr) R.guardThr.value = g.thr;
      R.sysEvents.innerHTML = (j.events || []).map((e) => esc(e)).join('<br>') || 'няма';
    } catch (e) { R.sysVer.textContent = 'не се прочете: ' + e; }
  }
  setInterval(() => { if (visible) loadSys(); }, 3000);

  // ── конзолата на тялото ──
  function conSend(line) {         // false: редът е отказан и остава в полето
    return run(line, R.conOut);
  }
  const conBtns = () => root.querySelectorAll('[data-con], [data-act="conSend"]');
  function conLock() { for (const b of conBtns()) b.disabled = con.busy || !net.live; }
  onBusy(conLock);

  // ── качване на фърмуер ──
  function upload(path, file, bar, msg, done) {
    const x = new XMLHttpRequest();
    x.open('POST', url(path));
    x.upload.onprogress = (e) => { if (e.lengthComputable) { bar.style.width = (e.loaded / e.total * 100).toFixed(0) + '%'; msg.textContent = 'към P4: ' + (e.loaded / 1024).toFixed(0) + ' от ' + (e.total / 1024).toFixed(0) + ' KB'; } };
    x.onload = () => {
      let j = {};
      try { j = JSON.parse(x.responseText); } catch (e) { j = { ok: false, err: x.responseText || ('HTTP ' + x.status) }; }
      msg.textContent = j.ok ? j.msg : 'Неуспех: ' + j.err;
      toast(j.ok ? j.msg : j.err, !j.ok);
      if (done) done(j);
    };
    x.onerror = () => { msg.textContent = 'Връзката прекъсна'; toast('Качването прекъсна', true); };
    x.send(file);
  }
  async function act(a) {
    switch (a) {
      case 'guardSet': {
        /* Главата реже прага до разумното за серво и казва какъв е взет; полето се обновява от /api/sys */
        const v = parseFloat(R.guardThr.value), lo = +R.guardThr.min, hi = +R.guardThr.max;
        if (!(v >= lo && v <= hi)) { toast('Прагът е от ' + lo + ' до ' + hi + ' A', true); return; }
        sendOrWarn({ guard: v });
        R.guardThr.blur();
        setTimeout(loadSys, 500);
        break;
      }
      case 'curzero': curZeroGo(); break;
      case 'himucal': himuCalGo(); break;
      case 'p4Reboot': if (confirm('Рестарт на главата (P4)? Тялото продължава да балансира само.')) sendOrWarn({ cmd: 'p4reboot' }); break;
      case 'fwBodyGo': {
        const f = R.fwBody.files[0];
        if (!f) { toast('Избери .bin файла на тялото', true); return; }
        if (!confirm('Нов фърмуер в тялото (' + f.name + ', ' + kb(f.size) + ')? Тялото трябва да е в покой.')) return;
        upload('/api/ota/body', f, R.fwBodyBar, R.fwBodyMsg);
        break;
      }
      case 'fwBodySd': {
        if (!confirm('Пак фърмуера от SD картата (/sdcard/firmware/body.bin) в тялото?')) return;
        try {
          const j = await (await fetch(url('/api/ota/body?sd=1'), { method: 'POST' })).json();
          R.fwBodyMsg.textContent = j.ok ? j.msg : 'Неуспех: ' + j.err;
          toast(j.ok ? j.msg : j.err, !j.ok);
        } catch (e) { toast('' + e, true); }
        break;
      }
      case 'fwBodyStop': sendOrWarn({ cmd: 'otacancel' }); break;
      case 'fwHeadGo': {
        const f = R.fwHead.files[0];
        if (!f) { toast('Избери .bin файла на главата', true); return; }
        if (!confirm('Нов фърмуер в главата (' + f.name + ', ' + kb(f.size) + ')? После P4 се рестартира.')) return;
        upload('/api/ota/head', f, R.fwHeadBar, R.fwHeadMsg);
        break;
      }
      case 'conSend': if (conSend(R.conLine.value)) R.conLine.value = ''; break;
      case 'conClear': R.conOut.textContent = ''; break;
      default: break;
    }
  }
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.con) { conSend(b.dataset.con); return; }
    if (b.dataset.act) act(b.dataset.act);
  });
  R.conLine.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') act('conSend'); });

  function renderOta(o, oh) {
    if (o.act || o.st >= 5) {
      const pct = o.tot ? o.sent / o.tot * 100 : 0;
      R.fwBodyBar.style.width = pct.toFixed(0) + '%';
      setT(R.fwBodyMsg, (OTA_ST[o.st] || '') + ' · ' + (o.sent / 1024).toFixed(0) + ' от ' + (o.tot / 1024).toFixed(0) + ' KB' +
        (o.rt ? ' · повторения ' + o.rt : '') + ' · ' + (o.msg || ''));
    }
    if (oh.act) setT(R.fwHeadMsg, 'пише се: ' + (oh.w / 1024).toFixed(0) + ' KB');
  }
  on('st', (s) => { if (visible) renderOta(s.ota || {}, s.oh || {}); });

  lockDemo(root, !isLive());
  return {
    show() { visible = true; loadSys(); conLock(); },
    hide() { visible = false; },
    update() {},
  };
}
