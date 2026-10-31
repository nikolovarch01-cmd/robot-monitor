// Раздел „Настройка“: параметрите на тялото (по групи), усилванията на стария регулатор, калибровките
// (воден помощник + главата и сервата). Всичко от раздел „Настройка“ на телефона.
import { on, sendOrWarn } from '../net_ws.js';
import { getJson, isLive } from './api.js';
import { esc, num, toast, DEMO_NOTE } from './ui.js';
import { lockDemo } from './lock.js';
import { initCalib } from './calib.js';
import { centrStart, centrDone, curZeroGo, himuCalGo } from './actions.js';

const PST = { 0: ['✓', 'ok'], 5: ['✓✓', 'ok'], 1: ['няма', 'bad'], 2: ['извън', 'bad'], 3: ['в покой', 'bad'], 4: ['само чет.', 'bad'] };
const LOOPS = ['наклон', 'скорост', 'завой'];

function badges(f) {
  let s = '';
  if (f & 0x01) s += '<span class="badge-s live">на живо</span>';
  if (f & 0x02) s += '<span class="badge-s idle">само в покой</span>';
  if (f & 0x04) s += '<span class="badge-s rst">след рестарт</span>';
  if (f & 0x08) s += '<span class="badge-s cal">калибровка</span>';
  if (f & 0x10) s += '<span class="badge-s">само за четене</span>';
  return s;
}

export function init(root) {
  root.innerHTML = `
  ${DEMO_NOTE}
  <div class="set">
    <div class="set-main">
      <div class="card">
        <div class="ct"><span>Параметри на тялото <span class="dim" data-r="pCount"></span></span></div>
        <label class="chk"><input type="checkbox" data-r="pSaveNow"> записвай веднага и в паметта на тялото</label>
        <div class="btnrow">
          <button class="btn" type="button" data-act="reload">Прочети от тялото</button>
          <button class="btn acc" type="button" data-act="save">Запиши всички</button>
          <button class="btn" type="button" data-act="defaults">Фабрични</button>
        </div>
        <input class="inp filter" data-r="filter" data-keep type="search" placeholder="Търси параметър (име или описание)…" autocomplete="off" spellcheck="false">
        <div class="small dim" data-r="pMsg"></div>
      </div>
      <div data-r="pGroups"></div>
    </div>
    <div class="set-side">
      <div class="card c-wiz" data-r="wizCard"></div>
      <div class="card">
        <div class="ct"><span>Главата и сервата</span></div>
        <div class="small dim">Нулата на тока: моторите и сервата изключени. Жироскопът на главата: не я пипай 2 s.</div>
        <div class="btnrow"><button class="btn" type="button" data-act="curzero">Нула на тока</button><button class="btn" type="button" data-act="himucal">Жироскоп на главата</button></div>
        <div class="small dim sp-top">Сервата, центриране: 1) свали главините (рамената) от двете серва; 2) „Центрирай“: отиват на 1500 µs; 3) сложи рамената обратно; 4) „Рамената са сложени“: сервата се пускат, ограничени в тавана.</div>
        <div class="btnrow"><button class="btn" type="button" data-act="centrStart">Центрирай</button><button class="btn" type="button" data-act="centrDone">Рамената са сложени</button></div>
      </div>
      <div class="card" data-r="pidBox" hidden>
        <div class="ct"><span>Стар регулатор (старото тяло)</span></div>
        <div data-r="pidRows"></div>
        <div class="btnrow"><button class="btn" type="button" data-act="pidApply">Приложи</button><button class="btn" type="button" data-act="pidSave">Запиши</button><button class="btn" type="button" data-act="pidGet">Прочети</button></div>
      </div>
    </div>
  </div>`;
  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;
  const calib = initCalib(R.wizCard);

  const P = { list: [], byId: {}, groups: [], loaded: false };
  let visible = false;

  // ── параметри ──
  /* Списъкът е около 32 KB и минава през същия порт като СТОП. Затова: една заявка наведнъж; съобщенията от
   * главата (wantParams) само отбелязват, че списъкът е остарял, и го четат със закъснение 300 ms, и то само
   * когато Настройка е отворена. */
  let pBusy = false, pAgain = false, pTimer = 0;
  function wantParams() {
    P.loaded = false;
    if (!visible) return;
    clearTimeout(pTimer);
    pTimer = setTimeout(loadParams, 300);
  }
  async function loadParams() {
    if (pBusy) { pAgain = true; return; }
    pBusy = true;
    try {
      const j = await getJson('/api/params');
      P.groups = j.groups || [];
      P.list = j.p || [];
      P.byId = {};
      P.list.forEach((p) => { P.byId[p.id] = p; });
      P.loaded = P.list.length > 0;
      R.pCount.textContent = j.total ? '(' + j.got + ' от ' + j.total + ')' : '';
      R.pMsg.textContent = j.total ? '' : (j.v2 ? 'Тялото още не е дало параметрите („Прочети от тялото“).' : 'Тялото не дава параметри (старото тяло или няма връзка).');
      renderParams();
    } catch (e) { R.pMsg.textContent = 'Не се прочетоха: ' + e; }
    pBusy = false;
    if (pAgain) { pAgain = false; wantParams(); }
  }
  function renderParams() {
    const open = {};
    root.querySelectorAll('details.grp').forEach((d) => { open[d.dataset.g] = d.open; });
    /* писаното не се губи при ново прочитане: фокусираното и сменените полета се връщат след пребъркването */
    const keep = {};
    root.querySelectorAll('input[data-id]').forEach((i) => {
      if (i === document.activeElement || i.classList.contains('changed'))
        keep[i.dataset.id] = { v: i.value, focus: i === document.activeElement, s: i.selectionStart, e: i.selectionEnd };
    });
    const byG = {};
    P.list.forEach((p) => (byG[p.g] = byG[p.g] || []).push(p));
    let html = '';
    Object.keys(byG).map(Number).sort((a, b) => a - b).forEach((g, gi) => {
      const name = P.groups[g] || ('Група ' + g);
      const isOpen = open[g] !== undefined ? open[g] : gi < 2;
      html += '<details class="grp card" data-g="' + g + '"' + (isOpen ? ' open' : '') + '><summary>' + esc(name) +
        ' <span class="dim">(' + byG[g].length + ')</span></summary><div class="prm-grid">';
      byG[g].forEach((p) => {
        const ro = p.f & 0x10;
        html += '<div class="prm" id="prm' + p.id + '" data-s="' + esc((p.n + ' ' + (p.h || '') + ' ' + (p.u || '')).toLowerCase()) + '"><div class="ph"><b>' + esc(p.n) + '</b>' +
          (p.u ? '<span class="dim small">' + esc(p.u) + '</span>' : '') + badges(p.f) + '</div>' +
          (p.h ? '<div class="help">' + esc(p.h) + '</div>' : '') +
          '<div class="pin"><input class="inp" type="number" step="any" inputmode="decimal" data-id="' + p.id + '" value="' + num(p.v) + '"' +
          (ro ? ' disabled' : '') + '><button class="btn" type="button" data-apply="' + p.id + '"' + (ro ? ' disabled' : '') + '>Приложи</button>' +
          '<span class="pst" id="pst' + p.id + '"></span></div>' +
          '<div class="lim">от ' + num(p.min) + ' до ' + num(p.max) + ' · фабрично ' + num(p.def) + ' · id ' + p.id + '</div></div>';
      });
      html += '</div></details>';
    });
    R.pGroups.innerHTML = html || '';
    for (const id in keep) {
      const inp = root.querySelector('input[data-id="' + id + '"]');
      if (!inp || inp.disabled) continue;
      inp.value = keep[id].v;
      inp.classList.toggle('changed', parseFloat(inp.value) !== (P.byId[id] || {}).v);
      if (keep[id].focus) {
        inp.focus();
        try { inp.setSelectionRange(keep[id].s, keep[id].e); } catch (e) { /* number няма избор: пропуска се */ }
      }
    }
    applyFilter();
    if (!isLive()) lockDemo(root, true);
  }
  function applyFilter() {
    const f = R.filter.value.trim().toLowerCase();
    root.querySelectorAll('details.grp').forEach((d) => {
      let any = false;
      d.querySelectorAll('.prm').forEach((p) => {
        const hit = !f || p.dataset.s.indexOf(f) >= 0;
        p.hidden = !hit;
        if (hit) any = true;
      });
      d.hidden = !any;
      if (f && any) d.open = true;
    });
  }
  R.filter.addEventListener('input', applyFilter);

  R.pGroups.addEventListener('click', (ev) => {
    const id = ev.target.dataset.apply;
    if (!id) return;
    const inp = root.querySelector('input[data-id="' + id + '"]');
    const v = parseFloat(String(inp.value).replace(',', '.'));
    const p = P.byId[id];
    if (!isFinite(v)) { toast('Не е число', true); return; }
    if (p && (v < p.min || v > p.max)) { toast(p.n + ': от ' + num(p.min) + ' до ' + num(p.max), true); return; }
    const el = root.querySelector('#pst' + id);
    el.textContent = '…'; el.className = 'pst wait';
    sendOrWarn({ pset: { id: +id, v, save: R.pSaveNow.checked } });
  });
  R.pGroups.addEventListener('input', (ev) => {
    const id = ev.target.dataset.id;
    if (!id || !P.byId[id]) return;
    ev.target.classList.toggle('changed', parseFloat(ev.target.value) !== P.byId[id].v);
  });
  function paramVal(m) {
    const p = P.byId[m.id];
    if (p && (m.st === 0 || m.st === 5)) p.v = m.v;
    const inp = root.querySelector('input[data-id="' + m.id + '"]');
    if (inp && document.activeElement !== inp && (m.st === 0 || m.st === 5)) { inp.value = num(m.v); inp.classList.remove('changed'); }
    const el = root.querySelector('#pst' + m.id);
    if (el) { const s = PST[m.st] || ['?', 'bad']; el.textContent = s[0]; el.className = 'pst ' + s[1]; }
    if (m.st === 2 || m.st === 3 || m.st === 4) toast((p ? p.n : 'id ' + m.id) + ': ' + (m.st === 2 ? 'извън обхвата' : m.st === 3 ? 'сменя се само в покой' : 'само за четене'), true);
  }
  on('pv', paramVal);
  on('pi', (m) => { if (m.total > 0 && m.got === m.total) wantParams(); else if (visible) R.pMsg.textContent = 'идват: ' + m.got + ' от ' + m.total; });
  on('hello', () => wantParams());
  on('ack', (m) => {
    const a = m.a;
    if (a === 0x33) toast('Параметрите са записани в тялото');
    else if (a === 0x34) { toast('Фабричните стойности са върнати'); wantParams(); }
    else if (a === 0x21) toast('Усилванията са записани');
  });

  // ── старото тяло: усилванията на стария регулатор ──
  let pidFilled = false;
  R.pidRows.innerHTML = LOOPS.map((n, i) => '<div class="pidrow"><span>' + n + '</span>' +
    ['kp', 'ki', 'kd'].map((k) => '<input class="inp" id="pid_' + i + '_' + k + '" type="number" step="any" inputmode="decimal" placeholder="' + k + '">').join('') + '</div>').join('');
  on('st', (s) => {
    if (s.pid !== undefined) {
      R.pidBox.hidden = !!(s.b && s.b.v2);
      if (!pidFilled && s.pid[0] && s.pid[0].kp !== undefined) {
        s.pid.forEach((p, i) => { if (p.kp !== undefined) { root.querySelector('#pid_' + i + '_kp').value = p.kp; root.querySelector('#pid_' + i + '_ki').value = p.ki; root.querySelector('#pid_' + i + '_kd').value = p.kd; } });
        pidFilled = true;
      }
    }
  });

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'reload': sendOrWarn({ cmd: 'plist' }); R.pMsg.textContent = 'чака се тялото...'; setTimeout(wantParams, 1500); break;
      case 'save': sendOrWarn({ cmd: 'psave' }); break;
      case 'defaults': if (confirm('Всички параметри на тялото по фабричните стойности?')) sendOrWarn({ cmd: 'pdef' }); break;
      case 'curzero': curZeroGo(); break;
      case 'himucal': himuCalGo(); break;
      case 'centrStart': centrStart(); break;
      case 'centrDone': centrDone(); break;
      case 'pidApply': LOOPS.forEach((n, i) => sendOrWarn({ pid: { loop: i, kp: +root.querySelector('#pid_' + i + '_kp').value, ki: +root.querySelector('#pid_' + i + '_ki').value, kd: +root.querySelector('#pid_' + i + '_kd').value } })); break;
      case 'pidSave': sendOrWarn({ cmd: 'pidsave' }); break;
      case 'pidGet': pidFilled = false; sendOrWarn({ cmd: 'pidget' }); break;
      default: break;
    }
  });

  lockDemo(root, !isLive());
  return {
    show() { visible = true; calib.show(); if (!P.loaded) loadParams(); },
    hide() { visible = false; calib.hide(); },
    update() {},
  };
}
