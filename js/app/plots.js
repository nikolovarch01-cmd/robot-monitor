// Раздел „Графики“: последните 10 s от тялото (STATE2 на 100 Hz, редовете „pl“ в телеметрията) с uPlot.
// Три графики като в телефона: наклон, скорост, напрежения с таван и риск. Пауза и Изчисти.
import { on } from '../net_ws.js';
import { setT } from './ui.js';

const WIN_S = 10;
const C = { cyan: '#3cc8ff', violet: '#a78bfa', green: '#36d399', white: 'rgba(226,235,245,.7)', grey: 'rgba(150,170,195,.7)', red: '#ff5d6c' };

// ред на STATE2: [t_ms, pitch, pitch_ref, speed, speed_ref, volt_l, volt_r, volt_limit, risk]
const DEFS = [
  { id: 'pitch', title: 'Наклон θ', unit: '°', d: 2, min: 4, wide: false, series: [
    { name: 'наклон θ', color: C.cyan, f: (r) => r[1] }, { name: 'цел θ_ref', color: C.white, dash: [5, 4], f: (r) => r[2] }] },
  { id: 'speed', title: 'Скорост', unit: 'mm/s', d: 0, min: 100, wide: false, series: [
    { name: 'скорост v', color: C.green, f: (r) => r[3] }, { name: 'цел v_ref', color: C.white, dash: [5, 4], f: (r) => r[4] }] },
  { id: 'volt', title: 'Напрежение към моторите', unit: 'V', d: 2, min: 4, wide: true, series: [
    { name: 'ляв V', color: C.cyan, f: (r) => r[5] }, { name: 'десен V', color: C.violet, f: (r) => r[6] },
    { name: 'таван ±', color: C.grey, dash: [3, 3], width: 1, f: (r) => r[7] }, { name: 'таван −', color: C.grey, dash: [3, 3], width: 1, hideLegend: true, f: (r) => -r[7] },
    { name: 'риск (0..1 по височината)', color: C.red, scale: 'risk', fill: 'rgba(255,93,108,.18)', width: 1, f: (r) => r[8] }] },
];

export function init(root) {
  root.innerHTML = `
  <div class="plot-bar">
    <button class="btn" type="button" data-act="pause" data-keep>Пауза</button>
    <button class="btn" type="button" data-act="clear" data-keep>Изчисти</button>
    <span class="small dim">Последните ${WIN_S} s от тялото (STATE2, 100 Hz).</span>
  </div>
  <div class="plots" data-r="plots"></div>`;
  const uPlot = window.uPlot;
  const PL = { rows: [], paused: false };
  const host = root.querySelector('[data-r="plots"]');
  let visible = false;

  const font = '10.5px -apple-system, "Segoe UI", system-ui, sans-serif';
  const axStroke = '#7d90a8', grid = 'rgba(120,150,190,.12)';

  const charts = uPlot ? DEFS.map((def) => {
    const card = document.createElement('div');
    card.className = 'card c-pl' + (def.wide ? ' wide' : '');
    card.innerHTML = `
      <div class="ct"><span>${def.title} <i class="u">${def.unit}</i></span>
        <span class="legend">${def.series.filter((s) => !s.hideLegend).map((s) => `<span class="lg"><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</span></div>
      <div class="plot"></div>`;
    host.appendChild(card);
    const plot = card.querySelector('.plot');
    const hasRisk = def.series.some((s) => s.scale === 'risk');
    const opts = {
      width: 400, height: 200,
      legend: { show: false }, cursor: { show: false }, select: { show: false },
      padding: [8, 12, 0, 0],
      scales: {
        x: { time: false, range: () => [-WIN_S, 0] },
        y: { range: (u, mn, mx) => {
          if (!isFinite(mn) || !isFinite(mx)) return [-def.min / 2, def.min / 2];
          const mid = (mn + mx) / 2, span = Math.max(mx - mn, def.min);
          return [mid - span * 0.55, mid + span * 0.55];
        } },
        ...(hasRisk ? { risk: { auto: false, range: [0, 1] } } : {}),
      },
      axes: [
        { stroke: axStroke, font, size: 22, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
          splits: () => [-10, -8, -6, -4, -2, 0], values: (u, v) => v.map((x) => (x === 0 ? 'сега' : x + ' s')) },
        { stroke: axStroke, font, size: 44, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
          values: (u, v) => v.map((x) => (Math.abs(x) >= 100 || Number.isInteger(x) ? x.toFixed(0) : x.toFixed(def.d > 1 ? 1 : def.d))) },
      ],
      series: [{}].concat(def.series.map((s) => ({
        stroke: s.color, width: s.width || 1.6, points: { show: false }, dash: s.dash, spanGaps: false,
        ...(s.scale ? { scale: s.scale } : {}), ...(s.fill ? { fill: s.fill } : {}),
      }))),
    };
    const u = new uPlot(opts, [[], ...def.series.map(() => [])], plot);
    const ro = new ResizeObserver(() => {
      const r = plot.getBoundingClientRect();
      if (r.width > 20 && r.height > 20) u.setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(plot);
    return { def, u };
  }) : [];
  if (!uPlot) host.innerHTML = '<div class="miss">uPlot не се зареди (няма интернет към jsDelivr)</div>';

  function addRows(rows) {
    if (PL.paused) return;
    for (const r of rows) {
      const n = PL.rows.length;
      if (n && r[0] + 2000 < PL.rows[n - 1][0]) PL.rows.length = 0;      // тялото се рестартира
      else if (n && r[0] <= PL.rows[n - 1][0]) continue;                 // повторен ред
      PL.rows.push(r);
    }
    const tmax = PL.rows.length ? PL.rows[PL.rows.length - 1][0] : 0;
    let k = 0;
    while (k < PL.rows.length && PL.rows[k][0] < tmax - WIN_S * 1000 - 1000) k++;
    if (k) PL.rows.splice(0, k);
  }
  on('st', (m) => { if (m.pl) addRows(m.pl); });

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'pause') { PL.paused = !PL.paused; setT(b, PL.paused ? 'Продължи' : 'Пауза'); }
    if (b.dataset.act === 'clear') { PL.rows.length = 0; draw(); }
  });

  function draw() {
    const rows = PL.rows;
    const tmax = rows.length ? rows[rows.length - 1][0] : 0;
    for (const c of charts) {
      const x = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) x[i] = (rows[i][0] - tmax) / 1000;
      const data = [x];
      for (const s of c.def.series) { const y = new Array(rows.length); for (let i = 0; i < rows.length; i++) y[i] = s.f(rows[i]); data.push(y); }
      c.u.setData(data, true);
    }
  }
  let lastDraw = 0;
  return {
    show() { visible = true; draw(); },
    hide() { visible = false; },
    update(ctx) {
      if (!visible || ctx.now - lastDraw < 60) return;
      lastDraw = ctx.now;
      if (!PL.paused) draw();
    },
  };
}
