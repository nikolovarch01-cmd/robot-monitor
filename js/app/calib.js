// Воден помощник за калибровките на тялото. Стъпките са командите „kal ...“ на конзолата на тялото
// (firmware/xiao-body/main/calib.c), пратени с {"con":"..."} по /ws, както прави телефонът.
// Между стъпките човекът прави нещо (държи, наклонява, вдига): за всяка стъпка има един ред указание.
// Тялото приема ЕДНА команда наведнъж: докато тече една, бутоните са изключени. Всяка стъпка изтича след 3 min.
import { net, on, sendOrWarn } from '../net_ws.js';
import { run, con, onBusy } from './console.js';
import { esc, STATE_BG, toast, setT } from './ui.js';

const STEP_TIMEOUT_MS = 180000;      // STEP_TIMEOUT_MS в calib.c: 3 min без стъпка прекъсват калибровката

// step: { label, cmd, say } — бутон; { ask, yes, no } — въпрос с два отговора. spin: колелото се върти (стенд на ядрото)
export const GROUPS = [
  { id: 'gyro', title: 'Жироскоп на тялото', steps: [
    { label: 'Калибрирай', cmd: 'kal gyro', say: 'Подпри или положи робота и не го пипай 2 s. Тялото да е в покой.' }] },
  { id: 'osi', title: 'Оси на IMU', steps: [
    { label: 'Започни', cmd: 'kal osi', say: 'Тялото да е в покой. После го вдигни отвесно.' },
    { label: 'Изправен', cmd: 'kal osi gore', say: 'Дръж робота отвесно и неподвижен, после натисни.' },
    { label: 'Наклонен напред', cmd: 'kal osi napred', say: 'Наклони го напред (накъдето кара) на 10–30° и го дръж неподвижно, после натисни.' }] },
  { id: 'posoki', title: 'Посоки на моторите', warn: 'колелата във въздуха', steps: [
    { label: 'Започни', cmd: 'kal posoki', say: 'Вдигни робота: колелата да са във въздуха, нищо да не ги пипа.' },
    { label: 'Ляво колело', cmd: 'kal posoki l', spin: true, say: 'Левият мотор ще се завърти 0.6 s на 2.5 V. Гледай накъде върти колелото.' },
    { ask: 'Левият мотор въртеше ли колелото НАПРЕД (горната му част към предната страна)?', yes: 'kal posoki l da', no: 'kal posoki l ne' },
    { label: 'Дясно колело', cmd: 'kal posoki d', spin: true, say: 'Десният мотор ще се завърти 0.6 s на 2.5 V. Колелата още са във въздуха.' },
    { ask: 'Десният мотор въртеше ли колелото НАПРЕД (горната му част към предната страна)?', yes: 'kal posoki d da', no: 'kal posoki d ne' }] },
  { id: 'trim', title: 'Трим (центърът)', steps: [
    { label: 'Трим', cmd: 'kal trim', say: 'Дръж го изправен и неподвижен 3 s, или го остави да балансира мирно без команди.' }] },
  { id: 'kompas', title: 'Компас', steps: [
    { label: 'Започни', cmd: 'kal kompas', say: 'Тялото да е в покой, далеч от желязо, магнити и кабели под ток.' },
    { label: 'Готово', cmd: 'kal kompas gotovo', say: 'Върти робота с ръка във всички посоки (и с колелата нагоре), поне 10 s, после натисни.' }] },
];

// Ръчните команди, както в телефона (за този, който иска всяка стъпка отделно)
const RAW = [
  { t: 'Оси на IMU', s: [['Започни', 'kal osi'], ['Изправен', 'kal osi gore'], ['Наклонен напред', 'kal osi napred']] },
  { t: 'Жироскоп на тялото', s: [['Калибрирай', 'kal gyro']] },
  { t: 'Посоки на моторите', s: [['Започни', 'kal posoki'], ['Ляво колело', 'kal posoki l'], ['Ляво: напред', 'kal posoki l da'], ['Ляво: назад', 'kal posoki l ne'],
    ['Дясно колело', 'kal posoki d'], ['Дясно: напред', 'kal posoki d da'], ['Дясно: назад', 'kal posoki d ne']] },
  { t: 'Трим (центърът)', s: [['Трим', 'kal trim']] },
  { t: 'Компас', s: [['Започни', 'kal kompas'], ['Готово', 'kal kompas gotovo']] },
  { t: 'Прекъсни / помощ', s: [['Прекъсни', 'kal stop'], ['Помощ', 'kal']] },
];

export function initCalib(root) {
  root.innerHTML = `
    <div class="ct"><span>Калибровка на тялото</span><span class="ct-r"><span class="chip off" data-r="bodySt">—</span></span></div>
    <div class="small dim wiz-intro">Всяка стъпка е команда към тялото. Правиш каквото пише и натискаш бутона. Една команда наведнъж; стъпката изтича след 3 min.</div>
    <div class="btnrow wiz-top">
      <button class="btn mini" type="button" data-act="idle">Покой (mode idle)</button>
      <button class="btn mini bad" type="button" data-act="stop">Прекъсни калибровката</button>
    </div>
    <div class="wiz-run" data-r="runLine" hidden></div>
    <pre class="con wiz-out" data-r="out" placeholder="отговорът на тялото"></pre>
    <div class="wiz" data-r="wiz"></div>
    <details class="raw-cmds">
      <summary>Ръчно, по команда</summary>
      <div class="raw-body" data-r="raw"></div>
    </details>`;
  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;

  // състояние на всяка група: idx = коя стъпка е следващата; deadline = кога изтича; msg = последен резултат
  const S = {};
  for (const g of GROUPS) S[g.id] = { idx: 0, deadline: 0, msg: '', ok: null };
  let visible = false;

  const active = () => GROUPS.find((g) => S[g.id].idx > 0);       // група, започната и недовършена

  function draw() {
    const act = active();
    const busy = con.busy || !net.live;          // в демото всичко е изключено
    R.wiz.innerHTML = GROUPS.map((g, gi) => {
      const st = S[g.id];
      const step = g.steps[st.idx];
      const other = act && act !== g;                                 // тялото чака друга група
      const dots = g.steps.map((s, i) => `<i class="${i < st.idx ? 'done' : i === st.idx && act === g ? 'cur' : ''}"></i>`).join('');
      let body;
      if (step.ask) {
        body = `<div class="wiz-say"><b>?</b> ${esc(step.ask)}</div>
          <div class="btnrow"><button class="btn go" type="button" data-cmd="${esc(step.yes)}" ${busy || other ? 'disabled' : ''}>Да, напред</button>
          <button class="btn" type="button" data-cmd="${esc(step.no)}" ${busy || other ? 'disabled' : ''}>Не, назад</button></div>`;
      } else {
        body = `<div class="wiz-say">${esc(step.say)}</div>
          ${step.spin ? '<div class="wiz-warn">⚠ колелата във въздуха: моторът се върти 0.6 s на 2.5 V</div>' : ''}
          <div class="btnrow"><button class="btn acc" type="button" data-cmd="${esc(step.cmd)}" ${step.spin ? 'data-spin="1"' : ''} ${busy || other ? 'disabled' : ''}>${esc(step.label)}</button>
          <code class="small dim">${esc(step.cmd)}</code></div>`;
      }
      const left = st.idx > 0 ? Math.max(0, st.deadline - Date.now()) : 0;
      const timer = st.idx > 0 ? `<span class="wiz-timer" data-timer="${g.id}">остават ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}</span>` : '';
      return `<div class="wiz-g ${act === g ? 'on' : ''} ${other ? 'wait' : ''}">
        <div class="wiz-h"><span class="wiz-n">${gi + 1}</span><b>${esc(g.title)}</b>${g.warn ? `<span class="chip warn">${esc(g.warn)}</span>` : ''}<span class="wiz-dots">${dots}</span>${timer}</div>
        ${body}
        ${st.msg ? `<div class="wiz-msg ${st.ok ? 'ok' : st.ok === false ? 'bad' : ''}">${esc(st.msg)}</div>` : ''}
        ${other ? '<div class="small dim">довърши другата калибровка или „Прекъсни“</div>' : ''}
      </div>`;
    }).join('');
    R.runLine.hidden = !con.busy;
    if (con.busy) R.runLine.innerHTML = `<span class="spin"></span> изпълнява се: <code>${esc(con.line)}</code> · бутоните са изключени, докато тялото не свърши`;
    for (const b of root.querySelectorAll('.wiz-top .btn')) b.disabled = busy;
    for (const b of R.raw.querySelectorAll('button')) b.disabled = busy;
  }

  function find(cmd) {
    for (const g of GROUPS) for (let i = 0; i < g.steps.length; i++) {
      const s = g.steps[i];
      if (s.cmd === cmd || s.yes === cmd || s.no === cmd) return { g, i, s };
    }
    return null;
  }

  function exec(cmd, spin) {
    if (spin && !confirm('Колелата във въздуха ли са?\n\nМоторът ще се завърти 0.6 s на 2.5 V. Ако роботът е на пода, ще мръдне.')) return;
    const f = find(cmd);
    run(cmd, R.out, ({ ret }) => {
      if (f) {
        const st = S[f.g.id];
        if (ret === 0) {
          const last = f.i >= f.g.steps.length - 1;
          const isAskNo = f.s.no === cmd;
          st.msg = '';
          if (last) { st.idx = 0; st.deadline = 0; st.msg = 'готово'; st.ok = true; }
          else { st.idx = f.i + 1; st.deadline = Date.now() + STEP_TIMEOUT_MS; st.ok = null; }
          if (isAskNo && !last) st.msg = 'записано „назад“';
        } else if (ret === null) {
          st.msg = 'без отговор от тялото'; st.ok = false;
        } else {
          st.msg = 'тялото отказа (код ' + ret + '): виж отговора отдолу'; st.ok = false;
        }
      }
      draw();
    });
    draw();
  }

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.cmd) {
      if (b.dataset.raw) run(b.dataset.cmd, R.out, () => draw());
      else exec(b.dataset.cmd, !!b.dataset.spin);
      draw();
    } else if (b.dataset.act === 'idle') {
      sendOrWarn({ mode: 'idle' });
    } else if (b.dataset.act === 'stop') {
      for (const g of GROUPS) Object.assign(S[g.id], { idx: 0, deadline: 0, msg: '', ok: null });
      if (con.busy) toast('Тялото още изпълнява команда; „kal stop“ ще се прати след нея', true);
      else run('kal stop', R.out, () => draw());
      draw();
    }
  });

  R.raw.innerHTML = RAW.map((c) => `<div class="calstep"><b>${esc(c.t)}</b><div class="btnrow">${c.s.map((s) =>
    `<button class="btn mini" type="button" data-raw="1" data-cmd="${esc(s[1])}">${esc(s[0])} <code>${esc(s[1])}</code></button>`).join('')}</div></div>`).join('');

  onBusy(() => { if (visible) draw(); });
  on('st', (m) => {
    if (!visible) return;
    const b = m.b || {};
    setT(R.bodySt, b.on ? (STATE_BG[b.st] || b.st) : 'тялото мълчи');
    R.bodySt.className = 'chip ' + (!b.on ? 'bad' : b.st === 'CALIBRATING' ? 'accent' : b.st === 'BALANCING' ? 'warn' : 'off');
  });

  // 3 min без стъпка: тялото прекъсва калибровката само; показваме същото
  setInterval(() => {
    if (!visible) return;
    let changed = false;
    for (const g of GROUPS) {
      const st = S[g.id];
      if (st.idx > 0 && Date.now() > st.deadline) {
        st.idx = 0; st.deadline = 0; st.ok = false;
        st.msg = 'Времето изтече (3 min без стъпка): тялото прекъсна калибровката. Почни отначало.';
        changed = true;
      }
    }
    if (changed) draw();
    else for (const t of root.querySelectorAll('[data-timer]')) {
      const left = Math.max(0, S[t.dataset.timer].deadline - Date.now());
      setT(t, 'остават ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'));
    }
  }, 1000);

  draw();
  return {
    el: root,
    show() { visible = true; draw(); },
    hide() { visible = false; },
    redraw: draw,
  };
}
