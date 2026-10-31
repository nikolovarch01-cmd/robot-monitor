// Раздел „Управление“: камера с HUD, профил, два джойстика (движение и глава), режими, серви, наклон на главата,
// състояние. Всичко от раздел „Управление“ на телефонното приложение; поведението и текстовете са същите.
import { net, on, sendOrWarn, driveSet, driveRelease, headSet, doStop, onStop, cancelPendingStop } from '../net_ws.js';
import { stick } from './joystick.js';
import { esc, fx, STATE_BG, FLAGS, faultInfo, toast, DEMO_NOTE, setT, setH, setC, setW } from './ui.js';
import { konzola, url, isLive } from './api.js';
import { camApi } from '../ui/camera.js';
import { distCss } from '../ui/util.js';
import { lockDemo } from './lock.js';
import { centrStart, centrDone } from './actions.js';

const VMAX = 400, WMAX = 2000;             // mm/s, mrad/s; таваните на профила са в тялото
const KEY_V = 240, KEY_W = 1200;           // стрелките (около 60% от хода на джойстика)
const curve = (a) => Math.sign(a) * Math.pow(Math.abs(a), 1.6);
const r1 = (v) => Math.round(v * 10) / 10;
const TILT_STEP_US = 4, US_PER_DEG = 3.57;  // всяко натискане мести средата с 4 µs (около 1°)

export function init(root) {
  root.innerHTML = `
  ${DEMO_NOTE}
  <div class="ctl">
    <div class="ctl-col ctl-l">
      <div class="card c-cstate">
        <div class="ct"><span>Състояние</span><span class="ct-r"><span class="chip off" data-r="state">—</span><span class="chip bad" data-r="fault" hidden></span></span></div>
        <div class="tiles">
          <div class="tile"><span class="k">наклон</span><b data-r="pitch">—</b><u>°</u></div>
          <div class="tile"><span class="k">скорост</span><b data-r="speed">—</b><u>mm/s</u></div>
          <div class="tile"><span class="k">батерия</span><b data-r="vbat">—</b><u>V</u></div>
          <div class="tile"><span class="k">ток</span><b data-r="cur">—</b><u>A</u></div>
        </div>
        <div class="riskrow"><span class="k">риск</span><span class="rbar"><i data-r="risk"></i></span><b class="num" data-r="riskv">0%</b></div>
        <div class="flags" data-r="flags"></div>
        <div class="kv">
          <div><span class="k">глава наклон</span><b data-r="hPitch">—</b></div>
          <div><span class="k">глава roll</span><b data-r="hRoll">—</b></div>
          <div><span class="k">компас</span><b data-r="hHead">—</b></div>
          <div><span class="k">ток серва</span><b data-r="iSrv">—</b></div>
          <div><span class="k">GPS</span><b data-r="gps">—</b></div>
          <div><span class="k">връзка с тялото</span><b data-r="lAge">—</b></div>
        </div>
      </div>
      <div class="card c-tof">
        <div class="ct"><span>ToF 8×8</span><span class="ct-r">червено близо, синьо далеч</span></div>
        <div class="tofgrid" data-r="tof"></div>
      </div>
      <div class="card c-srv">
        <div class="ct"><span>Серви на главата</span><span class="ct-r"><span class="chip off" data-r="srvChip">—</span></span></div>
        <div class="srv-st" data-r="srvSt">—</div>
        <div class="srv-cut" data-r="cutBox" hidden>
          <div><b>СПРЯНО</b> <span data-r="cutWhich"></span><div class="small">пазачът е спрял сервата</div></div>
          <button class="btn bad" type="button" data-act="srvAgain">Пусни пак</button>
        </div>
        <div class="btnrow">
          <button class="btn" type="button" data-act="srv">Серва: вкл</button>
          <button class="btn" type="button" data-act="center">Глава в центъра</button>
          <button class="btn" type="button" data-act="centr">Центриране</button>
        </div>
        <div class="follow">
          <span class="k">Главата следи очите</span>
          <span class="seg seg-sm"><button type="button" data-follow="da">Да</button><button type="button" data-follow="ne">Не</button></span>
          <span class="small dim" data-r="followMsg">—</span>
        </div>
      </div>
    </div>

    <div class="ctl-col ctl-c">
      <div class="card c-ctlcam">
        <div class="ct cam-head"><span>Камера</span><span class="ct-r"><span class="small" data-r="camInfo">—</span><button class="btn mini" type="button" data-act="camcfg">⚙ Камера</button></span></div>
        <div class="ctl-cam" data-r="camHost"></div>
        <div class="camcfg" data-r="camCfg" hidden>
          <div class="follow"><span class="k">Размер</span><span class="seg seg-sm" data-r="segRez"><button type="button" data-rez="640x480">640×480</button><button type="button" data-rez="800x640">800×640</button><button type="button" data-rez="1280x960">1280×960</button><button type="button" data-rez="1920x1080">1920×1080</button></span></div>
          <div class="follow"><span class="k">Мащаб</span><span class="seg seg-sm" data-r="segZoom"><button type="button" data-zoom="1">1×</button><button type="button" data-zoom="2">2×</button><button type="button" data-zoom="4">4×</button></span>
            <span class="k kq">Качество</span><span class="seg seg-sm" data-r="segQ"><button type="button" data-q="40">40</button><button type="button" data-q="60">60</button><button type="button" data-q="80">80</button></span></div>
          <div class="follow"><span class="k">Бяло</span><span class="seg seg-sm" data-r="segBb"><button type="button" data-bb="auto">Авто</button><button type="button" data-bb="den">Дневна</button><button type="button" data-bb="oblak">Облачно</button><button type="button" data-bb="krushka">Крушка</button><button type="button" data-bb="lum">Луминесц.</button></span>
            <span class="btnrow"><button class="btn mini" type="button" data-warm="-1" title="Малко повече синьо">по-студено</button><button class="btn mini" type="button" data-warm="1" title="Малко повече червено">по-топло</button></span>
            <span class="small dim" data-r="bbInfo">—</span></div>
        </div>
      </div>
      <div class="card c-prof">
        <div class="seg" data-r="prof"><button type="button" data-p="0">Спокоен</button><button type="button" data-p="1">Нормален</button><button type="button" data-p="2">Пъргав</button></div>
      </div>
    </div>

    <div class="ctl-col ctl-r">
      <div class="card c-sticks">
        <div class="sticks">
          <div class="stick-wrap"><div class="stick" data-r="drive"><div class="knob"></div></div><div class="stick-lbl">движение</div></div>
          <div class="stick-wrap"><div class="stick headst dim" data-r="head"><div class="knob"></div></div><div class="stick-lbl" data-r="headLbl">глава</div></div>
        </div>
        <div class="keyhint small dim">Клавиатура: стрелките карат · Space = СТОП</div>
      </div>
      <div class="card c-misc">
        <button class="btn off" type="button" data-act="off">Изключи робота</button>
      </div>
    </div>

    <div class="ctl-col ctl-a">
      <div class="card c-act">
        <div class="act-row">
          <div class="modes">
            <button class="btn go big" type="button" data-mode="balance">Баланс</button>
            <button class="btn big" type="button" data-mode="park">Паркирай</button>
            <button class="btn big" type="button" data-mode="standup">Изправи</button>
            <button class="btn big" type="button" data-mode="idle">Покой</button>
          </div>
          <div class="trim">
            <button class="btn big" type="button" data-act="tiltUp" title="Средата на наклона: −4 µs">Глава ▲ 1°</button>
            <button class="btn big" type="button" data-act="tiltDn" title="Средата на наклона: +4 µs">Глава ▼ 1°</button>
          </div>
        </div>
        <div class="small dim trimmsg"><span data-r="tiltMsg">средата на наклона: мести се с ▲ ▼ и се записва сама (4 µs ≈ 1°)</span> <span class="trimnote">· „надолу“ = повече µs (изведено, не е потвърдено на око)</span></div>
      </div>
    </div>
  </div>`;

  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;
  const tofCells = [];
  for (let i = 0; i < 64; i++) { const d = document.createElement('i'); R.tof.appendChild(d); tofCells.push(d); }

  let visible = false;
  let last = null;
  let srvCap = [7.5, 7.5];
  const lastH = () => (net.st && net.st.h) || {};
  const servoAllOn = (h) => !!(h && h.sm === 'on' && !(h.cut || []).some(Boolean));

  // ── джойстици ──
  const driveStick = stick(R.drive, (x, y) => { driveSet(Math.round(-curve(y) * VMAX), Math.round(-curve(x) * WMAX)); }, () => driveRelease(), true);
  /* Главата: целият ход на джойстика е таванът (h.cap от главата, ±7.5° за първите тестове). Таванът и плавността
   * (до 20°/s) са в драйвера на P4; тук само се мащабира, за да стига ръката точно до тавана. */
  const headStick = stick(R.head, (x, y) => { headSet(r1(-x * srvCap[0]), r1(-y * srvCap[1])); }, () => {}, false);
  onStop(() => { keys.clear(); driveStick.release(); driveStick.place(0, 0); R.drive.classList.remove('held'); headStick.release(); });

  // ── клавиатура (на компютър): стрелките карат, докато са натиснати; пускане = спиране; Space = СТОП ──
  const keys = new Set();
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  function applyKeys() {
    let v = 0, w = 0;
    if (keys.has('ArrowUp')) v += KEY_V;
    if (keys.has('ArrowDown')) v -= KEY_V;
    if (keys.has('ArrowLeft')) w += KEY_W;      // + е наляво
    if (keys.has('ArrowRight')) w -= KEY_W;
    if (v || w) { driveSet(v, w); driveStick.place(-w / WMAX, -v / VMAX); R.drive.classList.add('held'); }
    else { driveRelease(); driveStick.place(0, 0); R.drive.classList.remove('held'); }
  }
  function releaseKeys() { if (keys.size) { keys.clear(); applyKeys(); } }
  document.addEventListener('keydown', (ev) => {
    if (!visible || !net.live || typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.code === 'Space') { ev.preventDefault(); if (!ev.repeat) { keys.clear(); doStop(); } return; }
    if (/^Arrow(Up|Down|Left|Right)$/.test(ev.key)) {
      ev.preventDefault();
      if (!keys.has(ev.key)) { keys.add(ev.key); applyKeys(); }
    }
  });
  document.addEventListener('keyup', (ev) => {
    if (keys.delete(ev.key)) applyKeys();
  });
  window.addEventListener('blur', releaseKeys);

  // ── режими, профил ──
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) {
      if (t.dataset.mode !== 'idle') cancelPendingStop();
      sendOrWarn({ mode: t.dataset.mode });
    } else if (t.dataset.p !== undefined) {
      sendOrWarn({ prof: +t.dataset.p });
    } else if (t.dataset.rez || t.dataset.zoom) {          // размер или мащаб: камерата се прави наново за около половин секунда
      setT(R.camInfo, 'сменям...');
      try { await fetch(url('/api/cam?' + (t.dataset.rez ? 'rez=' + t.dataset.rez : 'zoom=' + t.dataset.zoom)), { method: 'POST' }); } catch (e) { /* пак */ }
      setTimeout(() => { const c = camApi(); if (c) c.restart(); }, 1200);
    } else if (t.dataset.bb) {                             // баланс на бялото: готов режим
      fetch(url('/api/cam?bb=' + t.dataset.bb), { method: 'POST' }).catch(() => {});
    } else if (t.dataset.warm) {                           // по-топло/по-студено: червеното и синьото в обратни посоки от сегашното
      const c = (last && last.c) || {};
      if (!c.gr || !c.gb) return;
      const k = 1 + 0.05 * +t.dataset.warm, lim = (v) => Math.min(3.99, Math.max(0.5, v));
      fetch(url('/api/cam?gr=' + lim(c.gr * k).toFixed(2) + '&gb=' + lim(c.gb / k).toFixed(2)), { method: 'POST' }).catch(() => {});
    } else if (t.dataset.q) {
      fetch(url('/api/cam?q=' + t.dataset.q), { method: 'POST' }).catch(() => {});
    } else if (t.dataset.follow) {
      setFollow(t.dataset.follow);
    } else if (t.dataset.act) {
      act(t.dataset.act);
    }
  });

  // ── сервата ──
  let tiltBusy = false;
  /* Средата на наклона на главата: всяко натискане мести средата с 4 µs (около 1°), записва я (servo trim, в паметта
   * на главата) и праща главата там (servo center). През конзолата по мрежата. Повече µs: главата надолу. */
  async function tiltNudge(dir) {
    if (tiltBusy) return;
    tiltBusy = true;
    try {
      const m = /tilt:.*?център (\d+)/.exec(await konzola('servo'));
      if (!m) throw new Error('средата на наклона не се разбра');
      const t = /= (\d+) us/.exec(await konzola('servo trim tilt ' + (+m[1] + dir * TILT_STEP_US)));
      const c = await konzola('servo center');
      if (!/към центъра/.test(c)) toast(c.trim(), true);
      if (t) R.tiltMsg.textContent = 'средата на наклона: ' + t[1] + ' µs (' + fx((t[1] - 1500) / US_PER_DEG, 1) + '° от 1500), записана';
    } catch (e) { toast('' + e, true); }
    tiltBusy = false;
  }
  function act(a) {
    const h = lastH();
    switch (a) {
      case 'srv':
        if (h.sm === 'cent') { sendOrWarn({ cmd: 'servooff' }); return; }            // отказ от центрирането
        if (!servoAllOn(h) && !h.cal) { toast('Първо „Центриране“: без него сервата са без импулси', true); return; }
        sendOrWarn({ cmd: servoAllOn(h) ? 'servooff' : 'servoon' });
        break;
      case 'srvAgain':
        if (!h.cal) { toast('Първо „Центриране“: без него сервата са без импулси', true); return; }
        sendOrWarn({ cmd: 'servoon' });
        break;
      case 'center': headStick.place(0, 0); sendOrWarn({ cmd: 'center' }); break;
      case 'centr': if (h.sm === 'cent') centrDone(); else centrStart(); break;
      case 'tiltUp': tiltNudge(-1); break;
      case 'tiltDn': tiltNudge(+1); break;
      case 'off': if (confirm('Да изключа ли робота?')) sendOrWarn({ cmd: 'off' }); break;
      case 'camcfg': R.camCfg.hidden = !R.camCfg.hidden; break;
      default: break;
    }
  }

  // ── следене на главата (oci glava da|ne), записано в паметта на главата ──
  async function readFollow() {
    if (!isLive()) { setT(R.followMsg, '—'); return; }
    try {
      const m = /главата следи: (да|не)/.exec(await konzola('oci'));
      markFollow(m ? m[1] : null);
    } catch (e) { setT(R.followMsg, 'не се прочете'); }
  }
  function markFollow(v) {                 // v: „да“ | „не“ (както го печата конзолата) | null
    const k = v === 'да' ? 'da' : v === 'не' ? 'ne' : null;
    for (const b of root.querySelectorAll('[data-follow]')) b.classList.toggle('on', b.dataset.follow === k);
    setT(R.followMsg, v ? (v === 'да' ? 'следи (записано в паметта на главата)' : 'не следи (записано в паметта на главата)') : '—');
  }
  async function setFollow(v) {
    try {
      const t = (await konzola('oci glava ' + v)).trim().split('\n')[0];
      toast(t || ('oci glava ' + v));
    } catch (e) { toast('' + e, true); }
    readFollow();
  }

  // ── показване ──
  function renderServo(h) {
    const sm = h.sm || (h.srv ? 'on' : 'off');
    const cut = (h.cut || []).map((x, i) => x ? (i ? 'tilt' : 'pan') : '').filter(Boolean);
    if (Array.isArray(h.cap) && h.cap.length === 2 && h.cap.every((v) => v > 0)) srvCap = h.cap;
    const cap = '±' + fx(h.capset !== undefined ? h.capset : Math.max(srvCap[0], srvCap[1]), 1) + '°';
    let st, cls = 'off';
    if (sm === 'cent') { st = 'центриране: ' + (h.us || [1500, 1500]).join(' / ') + ' µs; сложи рамената, после „Рамената са сложени“'; cls = 'warn'; }
    else if (sm === 'on') { st = 'ограничени ' + cap; cls = 'accent'; }
    else if (sm === 'park') { st = 'към центъра, после без импулси'; cls = 'warn'; }
    else { st = h.cal ? 'без импулси' : 'без импулси: първо „Центриране“'; cls = h.cal ? 'off' : 'warn'; }
    if (cut.length) cls = 'bad';
    let line = st;
    if (h.wd > 0) line += ' · пазачът на IMU следи';
    /* пазачът на тока без верен ток или научен покой не работи: сервата са пуснати, а запънато не се вижда */
    if ((sm === 'on' || sm === 'cent') && h.gr === false) {
      line += ' · пазачът на тока НЕ Е ГОТОВ' + (h.grs ? ' (' + h.grs + ')' : '');
      if (cls !== 'bad') cls = 'warn';
    }
    setT(R.srvSt, line);
    R.srvSt.classList.toggle('bad', cls === 'bad');
    setT(R.srvChip, cut.length ? 'СПРЯНО' : sm === 'on' ? 'ВКЛ' : sm === 'cent' ? 'ЦЕНТЪР' : sm === 'park' ? 'ПАРК' : 'ИЗКЛ');
    setC(R.srvChip, 'chip ' + cls);
    R.cutBox.hidden = !cut.length;
    setT(R.cutWhich, cut.join(' и '));
    const on = servoAllOn(h);
    const btn = (a) => root.querySelector('[data-act="' + a + '"]');
    setT(btn('srv'), sm === 'cent' ? 'Спри центрирането' : on ? 'Серва: изкл' : 'Серва: вкл');
    setT(btn('centr'), sm === 'cent' ? 'Рамената са сложени' : 'Центриране');
    btn('centr').classList.toggle('acc', sm === 'cent' || !h.cal);
    if (isLive()) btn('center').disabled = sm !== 'on';
    R.head.classList.toggle('dim', !on);
    setT(R.headLbl, 'глава ' + cap);
    return sm === 'on' ? 'ограничени ' + cap + (cut.length ? ', СПРЯНО' : '') : sm === 'cent' ? 'центриране' : sm === 'park' ? 'към центъра' : (h.cal ? 'без импулси' : 'не са центрирани');
  }

  function render(s) {
    last = s;
    if (!visible) return;
    const b = s.b || {};
    const linkOk = net.linkOk;
    const stText = !linkOk ? 'няма връзка' : b.on ? (STATE_BG[b.st] || b.st || '—') : 'тялото мълчи';
    setT(R.state, stText);
    setC(R.state, 'chip ' + (!linkOk || !b.on ? 'bad' : b.st === 'BALANCING' ? 'accent' : (b.st === 'FALLEN' || b.st === 'LOW_BATTERY') ? 'bad' : 'off'));
    const fi = faultInfo(b.fault);
    R.fault.hidden = !fi;
    if (fi) { setT(R.fault, fi.text); setC(R.fault, 'chip ' + fi.cls); R.fault.title = fi.hint; }
    const vb = b.vb ? (b.vb > 6 ? fx(b.vb, 2) : 'USB') : '—';
    setT(R.vbat, vb);
    setT(R.cur, (s.cur === null || s.cur === undefined) ? '—' : fx(s.cur, 2));
    setT(R.pitch, fx(b.p, 1));
    setT(R.speed, b.v === undefined ? '—' : String(b.v));
    const risk = b.risk || 0;
    setW(R.risk, risk * 100);
    R.risk.style.background = risk > 0.6 ? 'var(--bad)' : risk > 0.3 ? 'var(--warn)' : 'var(--good)';
    setT(R.riskv, Math.round(risk * 100) + '%');
    setH(R.flags, FLAGS.filter((f) => (b.fl || 0) & f[0]).map((f) => '<span class="chip warn">' + f[1] + '</span>').join(''));
    setT(R.lAge, b.on ? ('ок' + (b.lost ? ', изп. ' + b.lost + '/s' : '')) : (b.age ? b.age + ' ms' : 'няма'));
    const d = s.d || {};
    for (const x of R.prof.children) x.classList.toggle('on', +x.dataset.p === d.prof);

    const c = s.c || {};
    setT(R.camInfo, c.ok ? c.w + '×' + c.h + ' · ' + fx(c.fps, 0) + ' прави / ' + fx(c.net, 1) + ' стигат · ' + c.kb + ' kB · к' + c.q : 'няма камера');
    // сегашните избори в менюто на камерата
    for (const x of R.segRez.children) x.classList.toggle('on', x.dataset.rez === c.rz);
    for (const x of R.segZoom.children) x.classList.toggle('on', +x.dataset.zoom === c.z);
    for (const x of R.segBb.children) x.classList.toggle('on', x.dataset.bb === c.bb);
    for (const x of R.segQ.children) x.classList.toggle('on', +x.dataset.q === c.q);
    setT(R.bbInfo, c.gr ? (c.bb === 'auto' ? 'автоматичен' : c.bb === 'ruchno' ? 'ръчен' : 'готов') + ' · червено ' + fx(c.gr, 2) + ' · синьо ' + fx(c.gb, 2) : '—');

    const h = s.h || {};
    setT(R.hPitch, h.imu ? fx(h.p, 1) + '°' : '—');
    setT(R.hRoll, h.imu ? fx(h.roll, 1) + '°' : '—');
    setT(R.hHead, h.imu ? Math.round(h.hd) + '°' : '—');
    renderServo(h);
    setT(R.iSrv, s.isv >= 0 ? fx(s.isv, 2) + ' A' : '—');
    const g = s.g || {};
    setT(R.gps, g.fix ? (fx(g.lat, 5) + ', ' + fx(g.lon, 5) + ' (' + g.sats + ')') : (g.n ? 'търси, ' + g.sats + ' сат.' : 'няма'));
    if (s.tof && s.tof.mm) {
      const mm = s.tof.mm;
      for (let i = 0; i < 64; i++) tofCells[i].style.background = mm[i] < 0 ? '#16202c' : distCss(mm[i]);
    }
  }
  on('st', render);
  on('link', () => { if (last) render(last); });

  const camHost = R.camHost;
  lockDemo(root, !isLive());

  return {
    camHost,
    show() {
      visible = true;
      if (last) render(last);
      readFollow();
    },
    hide() { visible = false; releaseKeys(); driveRelease(); },
    update() {},
  };
}
