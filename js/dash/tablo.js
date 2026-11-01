// Раздел Табло: мрежа от плочки (GridStack 11, MIT), режимът „Подреди“, рамките на плочките и лентата със сетовете.
// Плочките и изгледите им са в plochki.js, сетовете в setove.js, ключето в ui/klyuche.js. Правилата: 05_TABLA.
//   компютър (над 1180 px): 24 колони, ред 30 px, отстояние 10; плочките мърдат само в „Подреди“
//   таблет и телефон: две колони или една, по важност (02_DIZAYN 2.2); „Подреди“ там добавя и маха
import { PLOCHKI, GRUPI } from './plochki.js';
import * as S from './setove.js';
import { klyuche, vkl } from '../ui/klyuche.js';
import { camApi } from '../ui/camera.js';
import { toast, toastAct, esc } from '../app/ui.js';
import { currentTab } from '../app/nav.js';
import { releaseDrive } from '../app/upravlenie.js';

const COLS = 24, ROW = 30, MARGIN = 5;
const IME_CHAST = { kam: 'Камера', tof: '8×8', zad: 'Задният датчик', zvuk: 'Звук', servo: 'Серва' };
const ARM_MS = 4000;           // „Изтрий“ и „Върни“: второ натискане в рамките на 4 s
const VKL_MS = 15000;          // звукът и очите ги няма в честотите: „vkl“ се пита толкова често, докато Табло се вижда
// Бутонът казва какво прави (Михаил не го намери като „Подреди“: „не виждам как става това“)
const PODREDI = '✎ Подреди таблото';

// GridStack 11 носи ширините само до 12 колони: 24-те се пишат тук веднъж
function css24() {
  let c = '';
  const pc = (i) => (i * 100 / COLS).toFixed(4) + '%';
  c += `.gs-24>.grid-stack-item{width:${pc(1)}}`;
  for (let i = 1; i <= COLS; i++) c += `.gs-24>.grid-stack-item[gs-w="${i}"]{width:${pc(i)}}.gs-24>.grid-stack-item[gs-x="${i}"]{left:${pc(i)}}`;
  const st = document.createElement('style');
  st.textContent = c;
  document.head.appendChild(st);
}

export async function initTablo(root, ctx, { live, params }) {
  S.nachalo(live);
  root.classList.add('tbl');
  root.innerHTML = `
    <div class="tbl-bar">
      <div class="tbl-sets" role="tablist" aria-label="Табла"></div>
      <span class="tbl-sp"></span>
      <span class="tbl-tools">
        <span class="tbl-note small dim">местенето и размерът са на компютъра</span>
        <button class="btn mini bad" type="button" data-a="varni" title="Готовият сет както беше в началото">Върни</button>
        <button class="btn mini bad" type="button" data-a="iztrii">Изтрий</button>
        <button class="btn mini" type="button" data-a="iznesi" title="Всички сетове във файл">Изнеси</button>
        <button class="btn mini" type="button" data-a="vnesi" title="Сетове от файл">Внеси</button>
        <button class="btn mini" type="button" data-a="kato">Запази като…</button>
        <button class="btn mini" type="button" data-a="dobavi">+ Добави</button>
      </span>
      <button class="btn mini" type="button" data-a="podredi" aria-pressed="false" title="Местене, размер, добавяне и махане на плочки">${PODREDI}</button>
      <input type="file" accept=".json,application/json" hidden>
    </div>
    <div class="tbl-pop" hidden></div>
    <div class="pl-grid grid-stack"></div>`;
  const bar = root.querySelector('.tbl-bar'), setsEl = root.querySelector('.tbl-sets');
  const pop = root.querySelector('.tbl-pop'), gridEl = root.querySelector('.pl-grid');
  const fileIn = root.querySelector('input[type="file"]');
  const btnPodredi = bar.querySelector('[data-a="podredi"]');

  // ── мрежата ──
  const GS = window.GridStack;
  let grid = null;
  if (GS) {
    css24();
    grid = GS.init({
      column: COLS, cellHeight: ROW, margin: MARGIN, float: false, animate: true, staticGrid: true,
      // размерът се хваща от всички страни и ъгли, като прозорец (Михаил, 2026-11-01: камерата „няма за сменяне на
      // мащаба около прозореца“; беше само ъгълът долу вдясно)
      alwaysShowResizeHandle: true, resizable: { handles: 'n,ne,e,se,s,sw,w,nw' },
      draggable: { handle: '.grid-stack-item-content', scroll: true, cancel: '.pl-x,.klyuche,.swap-btn' },
    }, gridEl);
  } else {
    root.insertAdjacentHTML('afterbegin', '<div class="miss">Подредбата не се зареди (няма интернет към jsDelivr): плочките са в колони</div>');
  }
  const mq = matchMedia('(max-width: 1180px)');
  let uzko = !grid || mq.matches, podredi = false, loading = false, seq = 0;
  const plates = new Map();          // ключ → плочка { key, t, def, el, card, body, view, keys, x }

  // ── рамката на една плочка ──
  function napravi(it) {
    const def = PLOCHKI[it.t];
    if (!def) return null;
    const key = it.t + '#' + (++seq);
    const el = document.createElement('div');
    el.className = 'grid-stack-item' + (def.cyal ? ' cyal' : '');
    el.dataset.t = it.t;
    el.style.setProperty('--red', String(Math.round(def.red * 10)));
    el.style.setProperty('--redT', String(Math.round((def.redT != null ? def.redT : def.red) * 10)));
    el.innerHTML = `
      <div class="grid-stack-item-content card pl pl-${def.vid} pl-${it.t}">
        <div class="pl-b${it.t === 'zdrave' ? ' rates' : ''}"></div>
        <div class="pl-ovl"><span class="pl-ovl-ime">${esc(def.ime)}</span></div>
      </div>`;
    const card = el.firstElementChild, body = card.querySelector('.pl-b');
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'pl-x'; x.textContent = '✕';
    x.title = 'Махни „' + def.ime + '“'; x.setAttribute('aria-label', x.title);
    x.addEventListener('click', (ev) => { ev.stopPropagation(); mahni(key); });
    card.querySelector('.pl-ovl').appendChild(x);
    const p = { key, t: it.t, def, el, card, body, view: null, keys: [], x, dead: false };
    plates.set(key, p);
    if (def.vid === 'kartina') {
      const sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'swap-btn'; sw.textContent = '⇄';
      sw.title = it.t === 'kam' ? 'Камерата голяма' : '3D голямо';
      sw.addEventListener('click', razmeniGolyamoto);
      card.appendChild(sw);
    }
    postavi(p, it);
    p.ready = zaredi(p);
    return p;
  }
  function postavi(p, it) {
    const a = { 'gs-x': it.x, 'gs-y': it.y, 'gs-w': it.w, 'gs-h': it.h, 'gs-min-w': p.def.minW, 'gs-min-h': p.def.minH, 'gs-id': p.key };
    for (const k in a) { if (a[k] == null) p.el.removeAttribute(k); else p.el.setAttribute(k, String(a[k])); }
    if (it.x == null) p.el.setAttribute('gs-auto-position', 'true'); else p.el.removeAttribute('gs-auto-position');
    gridEl.appendChild(p.el);
    if (grid) grid.makeWidget(p.el);
  }

  // изгледът: модулът се зарежда отделно, един счупен не чупи другите
  async function zaredi(p) {
    const { def, body } = p;
    try {
      if (def.kam) {
        const cam = camApi();
        if (!cam) throw new Error('камерата не се зареди');
        p.view = {
          destroy() { if (cam.stage.parentNode === body) { cam.mount(null); cam.setActive(false); } },
        };
        if (currentTab() === 'dash') { cam.mount(body); cam.setActive(true); }
      } else {
        const mod = await import(def.mod);
        if (p.dead) return;
        p.view = mod[def.fn](body, ctx, def.arg) || {};
      }
    } catch (e) {
      console.error('[' + p.t + ']', e);
      body.insertAdjacentHTML('beforeend', `<div class="miss">„${esc(def.ime)}“ не се зареди: ${esc(String(e && e.message || e).slice(0, 120))}</div>`);
      return;
    }
    // заглавието на изгледа става заглавие на рамката (едно заглавие)
    const first = body.firstElementChild;
    let head = null;
    if (first && first.classList.contains('ct')) { head = first; p.card.insertBefore(head, body); p.card.classList.add('has-h'); }
    // дясната страна на заглавието: каквото изгледът е сложил там (стойност, хапче) плюс ключето и ✕;
    // в обща обвивка, защото изгледът пише текста на своя елемент наново (setText)
    const right = () => {
      if (p.hr) return p.hr;
      const r = document.createElement('span');
      r.className = 'ct-r pl-hr';
      const last = head.lastElementChild;
      if (last && last !== head.firstElementChild) r.appendChild(last);
      head.appendChild(r);
      return (p.hr = r);
    };
    // ключетата: в мястото, което изгледът е оставил (data-k), иначе в заглавието, иначе горе вдясно върху картината
    const slots = [...body.querySelectorAll('[data-k]')];
    for (const s of slots) { const k = klyuche(s.dataset.k, IME_CHAST[s.dataset.k]); s.appendChild(k.el); p.keys.push(k); }
    if (def.chast && !slots.some((s) => s.dataset.k === def.chast)) {
      const k = klyuche(def.chast, IME_CHAST[def.chast]);
      p.keys.push(k);
      if (head) right().appendChild(k.el);
      else { const f = document.createElement('span'); f.className = 'pl-kf'; f.appendChild(k.el); p.card.appendChild(f); }
    }
    if (head) right().appendChild(p.x);         // ✕ в заглавието
  }

  function unishtozhi(p) {
    p.dead = true;
    for (const k of p.keys) k.destroy();
    p.keys = [];
    if (p.view && p.view.destroy) { try { p.view.destroy(); } catch (e) { console.error('[' + p.t + ']', e); } }
    plates.delete(p.key);
  }

  function saberi() {
    const out = [];
    for (const p of plates.values()) {
      const n = p.el.gridstackNode;
      if (n) out.push({ t: p.t, x: n.x, y: n.y, w: n.w, h: n.h });
      else out.push({ t: p.t, x: +p.el.getAttribute('gs-x') || 0, y: +p.el.getAttribute('gs-y') || 0, w: +p.el.getAttribute('gs-w') || p.def.w, h: +p.el.getAttribute('gs-h') || p.def.h });
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  }
  function zapishi() { if (!loading) { S.zapishiPlochki(saberi()); swapVidim(); } }
  if (grid) grid.on('change', zapishi);

  // ── сет: плочките от същия вид се преизползват (3D и графиките не започват отначало) ──
  function sglobi(set) {
    const free = {};
    for (const p of plates.values()) (free[p.t] = free[p.t] || []).push(p);
    if (grid) { grid.batchUpdate(); grid.setAnimation(false); }
    try {
      for (const p of plates.values()) if (grid) grid.removeWidget(p.el, false, false);
      const keep = new Set();
      for (const it of set.plochki) {
        const reuse = free[it.t] && free[it.t].shift();
        if (reuse) { postavi(reuse, it); keep.add(reuse.key); }
        else { const p = napravi(it); if (p) keep.add(p.key); }
      }
      for (const p of [...plates.values()]) if (!keep.has(p.key)) { unishtozhi(p); p.el.remove(); }
    } finally {
      if (grid) { grid.batchUpdate(false); grid.setAnimation(true); }
    }
  }
  // Смяна на сет. Сет, който не се сглобява, не се трие: показва се готовото „Табло“ и се казва защо.
  function pokazhi(set) {
    zatvori();
    releaseDrive();                     // стрелка или пръст от стария сет не карат в новия
    undo = null;
    loading = true;
    try {
      sglobi(set);
    } catch (e) {
      console.error('[tablo] сетът „' + set.ime + '“', e);
      toast('Сетът „' + set.ime + '“ не се зареди. Показвам „Табло“; сетът остава в списъка', true);
      if (set.id !== 'tablo') {
        try { sglobi(S.izberi('tablo')); } catch (e2) { console.error('[tablo]', e2); }
      }
    } finally {
      loading = false;
    }
    risuvaiLenta();
    swapVidim();
    if (currentTab() === 'dash') kamera();
  }

  // ✕: обратимо, затова без питане, а с „↶ Отмени“ за 6 s (02_DIZAYN 1.3; „Върни“ е друго: сетът в началото)
  let undo = null;
  function mahni(key) {
    const p = plates.get(key);
    if (!p) return;
    const u = undo = { set: S.tekusht().id, plochki: saberi() };
    unishtozhi(p);
    if (grid) grid.removeWidget(p.el, true); else p.el.remove();
    zapishi();
    const posle = JSON.stringify(saberi());
    if (pop.dataset.kak === 'dobavi') otvoriDobavi();
    toastAct('Плочката „' + p.def.ime + '“ е махната', '↶ Отмени', () => {
      if (undo !== u || S.tekusht().id !== u.set) return;
      undo = null;
      // нищо друго не е сменено: старата подредба цяла; иначе само плочката, на първото свободно място
      if (JSON.stringify(saberi()) === posle) { S.zapishiPlochki(u.plochki); pokazhi(S.tekusht()); }
      else dobavi(p.t);
    }, 6000);
  }
  function dobavi(t) {
    const def = PLOCHKI[t];
    if (!def || (def.edna && [...plates.values()].some((p) => p.t === t))) return;
    const p = napravi({ t, w: def.w, h: def.h });
    zapishi();
    zatvori();
    if (p) {
      p.el.classList.add('pl-novo');
      setTimeout(() => p.el.classList.remove('pl-novo'), 1600);
      requestAnimationFrame(() => p.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  // ⇄: камерата и 3D си разменят мястото и размера (ако ги има и двете); бутонът е на по-малката
  function dvoyka() {
    let a = null, b = null;
    for (const p of plates.values()) { if (p.t === 'kam') a = p; if (p.t === '3d') b = p; }
    return a && b && a.el.gridstackNode && b.el.gridstackNode ? [a, b] : null;
  }
  function swapVidim() {
    const d = dvoyka();
    for (const p of plates.values()) {
      const sw = p.card.querySelector('.swap-btn');
      if (!sw) continue;
      let show = false;
      if (d) {
        const [a, b] = d, na = a.el.gridstackNode, nb = b.el.gridstackNode;
        const small = na.w * na.h <= nb.w * nb.h ? a : b;
        show = p === small;
      }
      sw.hidden = !show;
    }
  }
  function razmeniGolyamoto() {
    const d = dvoyka();
    if (!d || !grid) return;
    const [a, b] = d, ra = { ...pick(a.el.gridstackNode) }, rb = { ...pick(b.el.gridstackNode) };
    grid.batchUpdate();
    grid.update(a.el, { y: 1000 });
    grid.update(b.el, ra);
    grid.update(a.el, rb);
    grid.batchUpdate(false);
    try { localStorage.setItem('monitor.big', ra.w * ra.h < rb.w * rb.h ? 'cam' : '3d'); } catch (e) { /* няма значение */ }
    zapishi();
  }
  const pick = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h });

  // ── камерата: една за цялото приложение (camera.js); на Табло седи в плочката „Камера“, ако я има ──
  function camHost() {
    for (const p of plates.values()) if (p.t === 'kam' && p.view) return p.body;
    return null;
  }
  function kamera() {
    const cam = camApi();
    if (!cam) return;
    const h = camHost();
    if (h) { cam.mount(h); cam.setActive(true); } else { if (cam.stage.closest('.tbl')) cam.mount(null); cam.setActive(false); }
  }

  // ── лентата: сетовете като раздели вляво, „Подреди“ вдясно ──
  function risuvaiLenta() {
    const tek = S.tekusht();
    setsEl.innerHTML = S.setove().map((s) => `<button class="tab-btn mini${s.id === tek.id ? ' on' : ''}" type="button" role="tab" aria-selected="${s.id === tek.id}" data-set="${esc(s.id)}">${esc(s.ime)}</button>`).join('');
    bar.querySelector('[data-a="varni"]').hidden = !tek.gotov;
    bar.querySelector('[data-a="iztrii"]').hidden = tek.gotov;
    for (const b of bar.querySelectorAll('.armed')) razoruzhi(b);
  }
  function setPodredi(on) {
    podredi = on;
    if (on) releaseDrive();             // в „Подреди“ стрелките не карат
    root.classList.toggle('podredi', on);
    btnPodredi.textContent = on ? 'Готово' : PODREDI;
    btnPodredi.classList.toggle('acc', on);
    btnPodredi.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (grid) grid.setStatic(!on || uzko);
    if (!on) zatvori();
  }
  function setUzko(v) {
    uzko = v || !grid;
    root.classList.toggle('uzko', uzko);
    if (grid) grid.setStatic(!podredi || uzko);
  }
  mq.addEventListener('change', () => setUzko(mq.matches));

  // второ натискане за „Изтрий“ и „Върни“ (без системния прозорец, 02_DIZAYN 1.3)
  function razoruzhi(b) { clearTimeout(b._t); b.classList.remove('armed'); b.textContent = b._txt || b.textContent; }
  function vaoruzhen(b, txt) {
    if (b.classList.contains('armed')) { razoruzhi(b); return true; }
    b._txt = b.textContent;
    b.classList.add('armed');
    b.textContent = txt;
    b._t = setTimeout(() => razoruzhi(b), ARM_MS);
    return false;
  }

  bar.addEventListener('click', (ev) => {
    const s = ev.target.closest('[data-set]');
    if (s) { if (s.dataset.set !== S.tekusht().id) pokazhi(S.izberi(s.dataset.set)); return; }
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    const tek = S.tekusht();
    switch (b.dataset.a) {
      case 'podredi': setPodredi(!podredi); break;
      case 'dobavi': if (pop.dataset.kak === 'dobavi' && !pop.hidden) zatvori(); else otvoriDobavi(); break;
      case 'kato': if (pop.dataset.kak === 'kato' && !pop.hidden) zatvori(); else otvoriKato(); break;
      case 'iznesi': iznesi(); break;
      case 'vnesi': fileIn.value = ''; fileIn.click(); break;
      case 'varni':
        if (!vaoruzhen(b, 'Върни „' + tek.ime + '“?')) return;
        S.varni(tek.id); pokazhi(S.tekusht()); toast('„' + tek.ime + '“ е както в началото');
        break;
      case 'iztrii':
        if (!vaoruzhen(b, 'Изтрий „' + tek.ime + '“?')) return;
        S.iztrii(tek.id); pokazhi(S.tekusht()); toast('Сетът „' + tek.ime + '“ е изтрит');
        break;
      default: break;
    }
  });

  // ── „+ Добави“ и „Запази като…“: малък прозорец под лентата ──
  function zatvori() { pop.hidden = true; pop.dataset.kak = ''; }
  function otvori(kak) { pop.dataset.kak = kak; pop.style.top = (bar.offsetTop + bar.offsetHeight + 6) + 'px'; pop.hidden = false; }
  function otvoriDobavi() {
    const ima = {};
    for (const p of plates.values()) ima[p.t] = true;
    pop.innerHTML = `<div class="ct"><span>Добави плочка</span><span class="ct-r"><span class="dim">нова отива на първото свободно място</span></span></div>` +
      GRUPI.map(([g, ime]) => `<div class="pop-g">${esc(ime)}</div>` + Object.entries(PLOCHKI).filter(([, d]) => d.grupa === g).map(([t, d]) => {
        const off = d.edna && ima[t];
        return `<button type="button" class="pop-i" data-t="${t}"${off ? ' disabled' : ''}>
          <b>${esc(d.ime)}${ima[t] ? `<i>${off ? 'вече е на таблото: само една' : 'има я'}</i>` : ''}</b><span>${esc(d.kakvo)}</span></button>`;
      }).join('')).join('');
    otvori('dobavi');
  }
  function otvoriKato() {
    const n = S.setove().filter((s) => !s.gotov).length + 1;
    pop.innerHTML = `<div class="ct"><span>Запази като нов сет</span></div>
      <form class="pop-kato"><input class="inp" maxlength="40" required value="Моето табло ${n}" aria-label="Име на сета"><button class="btn acc" type="submit">Запази</button></form>
      <div class="small dim">Новият сет е копие на това, което се вижда сега. „${esc(S.tekusht().ime)}“ остава какъвто е.</div>`;
    otvori('kato');
    const inp = pop.querySelector('input');
    inp.focus(); inp.select();
  }
  pop.addEventListener('click', (ev) => {
    const i = ev.target.closest('.pop-i');
    if (i && !i.disabled) dobavi(i.dataset.t);
  });
  pop.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = S.zapaziKato(pop.querySelector('input').value, saberi());
    zatvori();
    risuvaiLenta();
    toast('Запазено като „' + s.ime + '“');
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!pop.hidden && !pop.contains(ev.target) && !ev.target.closest('[data-a="dobavi"],[data-a="kato"]')) zatvori();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !pop.hidden) zatvori(); });

  // ── изнасяне и внасяне ──
  function iznesi() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.iznesi()], { type: 'application/json' }));
    a.download = 'robot-tabla.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try {
      const n = S.vnesi(await f.text());
      pokazhi(S.tekusht());
      toast('Внесени сетове: ' + n);
    } catch (e) { toast(e.message || String(e), true); }
  });

  // ── начало ──
  setUzko(uzko);
  setPodredi(false);
  const start = S.tekusht();
  if (params && params.get('big') && start.id === 'tablo') {         // ?big=cam | 3d: само за този път
    const kam = start.plochki.find((p) => p.t === 'kam'), d3 = start.plochki.find((p) => p.t === '3d');
    if (kam && d3 && (kam.w * kam.h > d3.w * d3.h) !== (params.get('big') === 'cam')) S.razmeni(start.plochki, 'kam', '3d');
  }
  pokazhi(start);
  const pitaj = () => { vkl('vkl').catch(() => { /* стар фърмуер или няма робот: ключето остава „не се знае“ */ }); };
  pitaj();
  setInterval(() => {
    if (currentTab() === 'dash' && !document.hidden && [...plates.values()].some((p) => p.keys.length)) pitaj();
  }, VKL_MS);
  await Promise.all([...plates.values()].map((p) => p.ready));

  return {
    camHost,
    update(c) {
      for (const p of plates.values()) {
        const v = p.view;
        if (!v || !v.update || p.dead) continue;
        try { v.update(c); } catch (e) { p.dead = true; console.error('[' + p.t + ']', e); }
      }
      if (c.slow) for (const p of plates.values()) for (const k of p.keys) k.update();
    },
    show() { for (const p of plates.values()) if (p.view && p.view.show) p.view.show(); },
    hide() { zatvori(); for (const p of plates.values()) if (p.view && p.view.hide) p.view.hide(); },
  };
}
