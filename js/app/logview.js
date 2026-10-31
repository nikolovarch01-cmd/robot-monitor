// Преглед на запис от тялото (400 Hz): свалява CSV от /api/log?f=...&fmt=csv и го рисува с uPlot.
// Колоните са точно тези на робота (logcols.js). Увеличаване и местене: влачене = избор на отсечка, колело = мащаб,
// Shift+влачене или среден бутон = местене, двоен клик = всичко; на телефон: влачене с пръст = местене, два пръста =
// мащаб; бутоните − + ◀ ▶ Всичко работят навсякъде. Групите (наклон, напрежения, цикъл ...) са отделни графики с общо
// време; всеки канал се включва поотделно.
import { url, isLive } from './api.js';
import { esc, toast } from './ui.js';
import { GROUPS, DEFAULT_GROUPS } from './logcols.js';
import { demoTable } from './demo_st.js';

const SEL_KEY = 'monitor.lv.sel';

function loadSel() {
  try { const j = JSON.parse(localStorage.getItem(SEL_KEY)); if (j && typeof j === 'object') return new Set(j); } catch (e) { /* няма */ }
  return null;
}
function saveSel(set) { try { localStorage.setItem(SEL_KEY, JSON.stringify([...set])); } catch (e) { /* без памет */ } }

// Сваляне и разчитане на CSV на парчета (до 12 MB за 164 s): колоните са Float32Array, времето Float64Array.
async function fetchCsv(u, hint, onProg, signal) {
  const r = await fetch(u, { signal, cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  let cap = Math.max(1024, (hint || 0) + 16);
  let names = null, arrs = null, n = 0, bytes = 0, tail = '';
  const alloc = (c) => names.map((nm) => (nm === 't_ms' ? new Float64Array(c) : new Float32Array(c)));
  const grow = () => {
    cap *= 2;
    arrs = arrs.map((a, i) => { const b = names[i] === 't_ms' ? new Float64Array(cap) : new Float32Array(cap); b.set(a); return b; });
  };
  const feed = (text, last) => {
    const lines = (tail + text).split('\n');
    tail = last ? '' : lines.pop();
    if (last && lines.length && lines[lines.length - 1] === '') lines.pop();
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].replace(/\r$/, '');
      if (!line) continue;
      if (!names) { names = line.split(','); arrs = alloc(cap); continue; }
      const f = line.split(',');
      if (f.length < names.length) continue;                 // непълен ред (прекъснато сваляне)
      if (n >= cap) grow();
      for (let c = 0; c < names.length; c++) arrs[c][n] = +f[c];
      n++;
    }
  };
  if (r.body && r.body.getReader) {
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      bytes += value.length;
      feed(dec.decode(value, { stream: true }), false);
      onProg(bytes, n);
    }
    feed(dec.decode(), true);
  } else {
    const t = await r.text();
    bytes = t.length;
    feed(t, true);
  }
  if (!names) throw new Error('празен отговор');
  const cols = {};
  names.forEach((nm, i) => { cols[nm] = arrs[i].subarray(0, n); });
  return { n, cols, header: names, partial: false, bytes };
}

const fmtS = (s) => (Math.abs(s) >= 100 ? s.toFixed(1) : Math.abs(s) >= 10 ? s.toFixed(2) : s.toFixed(3)) + ' s';
const fv = (v) => (v == null || !isFinite(v) ? '—' : Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3));

export function initViewer(root) {
  root.innerHTML = `
    <div class="ct"><span>Преглед на запис <span class="dim" data-r="title"></span></span>
      <span class="ct-r"><button class="btn mini" type="button" data-act="close" data-keep>Затвори</button></span></div>
    <div class="lv-status small" data-r="status"></div>
    <div class="lv-summary" data-r="summary"></div>
    <details class="lv-pick" open data-keep><summary>Канали</summary><div class="lv-groups" data-r="groups"></div></details>
    <div class="lv-tools" data-keep>
      <button class="btn mini" type="button" data-z="out" title="По-широко">−</button>
      <button class="btn mini" type="button" data-z="in" title="По-тясно">+</button>
      <button class="btn mini" type="button" data-z="left" title="Наляво">◀</button>
      <button class="btn mini" type="button" data-z="right" title="Надясно">▶</button>
      <button class="btn mini acc" type="button" data-z="all">Всичко</button>
      <span class="small dim" data-r="win">—</span>
      <span class="small dim lv-hint">влачене = увеличи отсечката · колело = мащаб · Shift+влачене = мести · двоен клик = всичко</span>
    </div>
    <div class="lv-plots" data-r="plots"></div>`;
  const R = {};
  for (const e of root.querySelectorAll('[data-r]')) R[e.dataset.r] = e;
  root.hidden = true;
  if (window.innerWidth <= 700) root.querySelector('.lv-pick').open = false;      // на телефон изборът на канали е свит

  const uPlot = window.uPlot;
  let table = null, x = null, t0 = 0, tEnd = 1;
  let view = [0, 1];
  let plots = [];                   // [{g, u}]
  let sel = loadSel() || new Set(GROUPS.filter((g) => DEFAULT_GROUPS.includes(g.id)).flatMap((g) => g.ch.filter((c) => c[4]).map((c) => c[0])));
  let abort = null;

  // ── избор на канали ──
  function drawPicker() {
    R.groups.innerHTML = GROUPS.map((g) => `
      <div class="lv-g"><span class="lv-gt">${esc(g.title)}${g.unit ? ' <i>' + esc(g.unit) + '</i>' : ''}</span>
      ${g.ch.map((c) => `<button type="button" class="lv-ch ${sel.has(c[0]) ? 'on' : ''}" data-ch="${c[0]}" style="--c:${c[2]}" ${table && !table.cols[c[0]] ? 'disabled' : ''}><i></i>${esc(c[1])}</button>`).join('')}</div>`).join('');
  }
  R.groups.addEventListener('click', (ev) => {
    const b = ev.target.closest('.lv-ch');
    if (!b || b.disabled) return;
    const c = b.dataset.ch;
    if (sel.has(c)) sel.delete(c); else sel.add(c);
    saveSel(sel);
    b.classList.toggle('on', sel.has(c));
    buildPlots();
  });

  // ── обхват по времето (общ за всички графики) ──
  // uPlot прилага мащабите на пакет, затова петлята се прекъсва със сравнение с view (виж куката setScale долу)
  function setX(min, max) {
    const full = tEnd - t0;
    const minSpan = Math.min(full, 0.02);
    let span = Math.max(minSpan, max - min);
    if (span > full) span = full;
    min = Math.min(Math.max(t0, min), tEnd - span);
    max = min + span;
    view = [min, max];
    for (const p of plots) p.u.setScale('x', { min, max });
    R.win.textContent = 'прозорец ' + fmtS(min - t0) + ' … ' + fmtS(max - t0) + ' (' + fmtS(max - min) + ')';
  }
  const zoomAt = (f, c) => { const [a, b] = view; const cc = c == null ? (a + b) / 2 : c; setX(cc - (cc - a) * f, cc + (b - cc) * f); };
  root.querySelector('.lv-tools').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-z]');
    if (!b || !table) return;
    const [a, c] = view, w = c - a;
    switch (b.dataset.z) {
      case 'out': zoomAt(1.6); break;
      case 'in': zoomAt(1 / 1.6); break;
      case 'left': setX(a - w * 0.25, c - w * 0.25); break;
      case 'right': setX(a + w * 0.25, c + w * 0.25); break;
      default: setX(t0, tEnd);
    }
  });

  // ── графиките ──
  function destroyPlots() { for (const p of plots) { try { p.u.destroy(); } catch (e) { /* няма значение */ } } plots = []; R.plots.innerHTML = ''; }
  function buildPlots() {
    destroyPlots();
    if (!table || !uPlot) { if (!uPlot) R.plots.innerHTML = '<div class="miss">uPlot не се зареди (няма интернет към jsDelivr)</div>'; return; }
    const font = '10.5px -apple-system, "Segoe UI", system-ui, sans-serif';
    const axStroke = '#7d90a8', grid = 'rgba(120,150,190,.12)';
    for (const g of GROUPS) {
      const chs = g.ch.filter((c) => sel.has(c[0]) && table.cols[c[0]]);
      if (!chs.length) continue;
      const card = document.createElement('div');
      card.className = 'lv-p';
      card.innerHTML = `<div class="lv-pt">${esc(g.title)}${g.unit ? ' <i>' + esc(g.unit) + '</i>' : ''}</div><div class="lv-plot"></div>`;
      R.plots.appendChild(card);
      const host = card.querySelector('.lv-plot');
      const opts = {
        width: Math.max(300, host.clientWidth || 600), height: 190,
        padding: [6, 12, 0, 0],
        cursor: { drag: { x: true, y: false, setScale: true }, sync: { key: 'rec', setSeries: false }, points: { size: 6 } },
        legend: { show: true, live: true },
        select: { show: true },
        scales: { x: { time: false }, y: { auto: true } },
        axes: [
          { stroke: axStroke, font, size: 24, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
            values: (u, v) => v.map((s) => (s - t0).toFixed(Math.abs(view[1] - view[0]) < 2 ? 3 : 1) + ' s') },
          { stroke: axStroke, font, size: 52, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
            values: (u, v) => v.map((s) => (Math.abs(s) >= 1000 ? s.toFixed(0) : +s.toPrecision(4))) },
        ],
        series: [{ label: 'време', value: (u, v) => (v == null ? '—' : fmtS(v - t0)) }].concat(chs.map((c) => ({
          label: c[1], stroke: c[2], width: 1.3, dash: c[3] ? [5, 4] : undefined, points: { show: false }, spanGaps: false,
          value: (u, v) => fv(v),
        }))),
        hooks: {
          setScale: [(u, key) => {
            if (key !== 'x') return;
            const { min, max } = u.scales.x;
            if (min == null || max == null) return;
            if (Math.abs(min - view[0]) < 1e-9 && Math.abs(max - view[1]) < 1e-9) return;
            setX(min, max);             // избор с мишката: останалите графики го следват
          }],
        },
      };
      const data = [x].concat(chs.map((c) => table.cols[c[0]]));
      const u = new uPlot(opts, data, host);
      bindPointer(u);
      plots.push({ g, u });
    }
    if (!plots.length) R.plots.innerHTML = '<div class="small dim">Няма избран канал.</div>';
    setX(view[0], view[1]);
  }

  // колело = мащаб; Shift/среден бутон = местене; пръст = местене, два пръста = мащаб; двоен клик = всичко
  function bindPointer(u) {
    const over = u.over;
    over.style.touchAction = 'pan-y';
    over.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = over.getBoundingClientRect();
      const frac = (e.clientX - r.left) / r.width;
      const c = view[0] + frac * (view[1] - view[0]);
      zoomAt(e.deltaY < 0 ? 0.75 : 1.33, c);
    }, { passive: false });
    over.addEventListener('dblclick', () => setX(t0, tEnd));
    const ptrs = new Map();
    let pan = null, pinch = null;
    u.root.addEventListener('pointerdown', (e) => {
      const touch = e.pointerType === 'touch';
      if (!touch && !(e.shiftKey || e.button === 1)) return;       // мишка: избор на отсечка (uPlot)
      if (e.target !== over && !over.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      over.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, e.clientX);
      if (ptrs.size === 1) pan = { x: e.clientX, v: view.slice() };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.abs(a - b) || 1, v: view.slice(), c: (a + b) / 2 }; pan = null; }
    }, true);
    over.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, e.clientX);
      const r = over.getBoundingClientRect();
      if (ptrs.size === 1 && pan) {
        const dt = -(e.clientX - pan.x) / r.width * (pan.v[1] - pan.v[0]);
        setX(pan.v[0] + dt, pan.v[1] + dt);
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const f = pinch.d / (Math.abs(a - b) || 1);
        const cc = pinch.v[0] + ((pinch.c - r.left) / r.width) * (pinch.v[1] - pinch.v[0]);
        setX(cc - (cc - pinch.v[0]) * f, cc + (pinch.v[1] - cc) * f);
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); pan = null; pinch = null; };
    over.addEventListener('pointerup', up);
    over.addEventListener('pointercancel', up);
  }
  new ResizeObserver(() => {
    for (const p of plots) { const w = p.u.root.parentNode.clientWidth; if (w > 100) p.u.setSize({ width: w, height: 190 }); }
  }).observe(R.plots);

  // ── обобщение: числа, по които се вижда трептенето ──
  function stats(c) {
    const out = [];
    const n = table.n;
    const dur = (x[n - 1] - x[0]);
    out.push(['записа', n.toLocaleString('bg')], ['продължителност', dur.toFixed(2) + ' s'], ['средна честота', dur > 0 ? (n / dur).toFixed(0) + ' Hz' : '—']);
    const dt = c.dt_us;
    if (dt) {
      let mn = Infinity, mx = -Infinity, sum = 0;
      for (let i = 0; i < n; i++) { const v = dt[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
      const mean = sum / n;
      let late = 0;
      for (let i = 0; i < n; i++) if (dt[i] > mean * 1.5) late++;
      out.push(['dt_us (цикъл)', `${mn.toFixed(0)} / ${mean.toFixed(0)} / ${mx.toFixed(0)} µs`], ['закъснели цикли (>1,5× средния)', String(late)]);
    }
    const p = c.pitch_deg;
    if (p) {
      let s = 0, s2 = 0, pk = 0;
      for (let i = 0; i < n; i++) { const v = p[i]; s += v; s2 += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
      const m = s / n;
      out.push(['наклон средно', m.toFixed(2) + '°'], ['наклон σ', Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(2) + '°'], ['наклон най-много', '±' + pk.toFixed(2) + '°']);
    }
    const w = c.pitch_dps;
    if (w) { let s2 = 0; for (let i = 0; i < n; i++) s2 += w[i] * w[i]; out.push(['pitch_dps RMS', Math.sqrt(s2 / n).toFixed(1) + ' °/s']); }
    return out;
  }

  async function open(name, nHint) {
    if (abort) abort.abort();
    abort = new AbortController();
    const my = abort;
    root.hidden = false;
    destroyPlots();
    table = null;
    R.title.textContent = '· ' + (name === 'ram' ? 'паметта на P4 (ram)' : name);
    R.summary.innerHTML = '';
    R.status.textContent = 'тегли се…';
    drawPicker();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t0w = performance.now();
    try {
      let tb;
      if (!isLive()) { tb = demoTable(); }
      else tb = await fetchCsv(url('/api/log?f=' + encodeURIComponent(name) + '&fmt=csv'), nHint, (bytes, n) => {
        R.status.textContent = 'тегли се… ' + (bytes / 1024).toFixed(0) + ' KB' + (nHint ? ', ' + Math.min(100, Math.round(n / nHint * 100)) + '%' : '') + ' (' + n + ' записа)';
      }, my.signal);
      if (my.signal.aborted) return;
      if (!tb.n || !tb.cols.t_ms) { R.status.textContent = 'записът е празен'; return; }
      table = tb;
      const tm = tb.cols.t_ms;
      x = new Float64Array(tb.n);
      for (let i = 0; i < tb.n; i++) x[i] = tm[i] / 1000;
      t0 = x[0]; tEnd = x[tb.n - 1] > t0 ? x[tb.n - 1] : t0 + 0.01;
      view = [t0, tEnd];
      R.status.textContent = (isLive() ? 'свален и разчетен за ' + ((performance.now() - t0w) / 1000).toFixed(1) + ' s' : 'Демо: измислен запис на 400 Hz');
      R.summary.innerHTML = stats(tb.cols).map(([k, v]) => `<div><span class="k">${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
      drawPicker();
      buildPlots();
    } catch (e) {
      if (my.signal.aborted) return;
      R.status.textContent = 'не се свали: ' + e;
      toast('Записът не се свали: ' + e, true);
    }
  }
  function close() {
    if (abort) abort.abort();
    destroyPlots();
    table = null; x = null;
    root.hidden = true;
  }
  root.addEventListener('click', (ev) => { if (ev.target.closest('[data-act="close"]')) close(); });

  return { open, close, isOpen: () => !root.hidden };
}
