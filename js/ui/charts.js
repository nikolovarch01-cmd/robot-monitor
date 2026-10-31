// Графики на живо с uPlot (MIT): последните 15 s, най-много 16 прерисувания в секунда.
import { setText, fmt } from './util.js';

const WINDOW_S = 15;
const REDRAW_MS = 62;

const C = { cyan: '#3cc8ff', violet: '#a78bfa', green: '#36d399', white: 'rgba(226,235,245,.6)' };

const DEFS = [
  { id: 'ch-pitch', title: 'Наклон', unit: '°', d: 1, min: 6, series: [
    { key: 'pitch', name: 'наклон', color: C.cyan }, { key: 'pitch_ref', name: 'зададен', color: C.white, dash: [5, 4] } ] },
  { id: 'ch-speed', title: 'Скорост', unit: 'mm/s', d: 0, min: 300, series: [
    { key: 'speed', name: 'скорост', color: C.cyan }, { key: 'speed_ref', name: 'зададена', color: C.white, dash: [5, 4] } ] },
  { id: 'ch-cur', title: 'Ток на мотори', unit: 'A', d: 2, min: 1.2, lo: 0, series: [
    { key: 'cur_l', name: 'ляв', color: C.cyan }, { key: 'cur_r', name: 'десен', color: C.violet } ] },
  { id: 'ch-gyro', title: 'Жироскоп (глава)', unit: '°/s', d: 0, min: 40, series: [
    { key: 'gyro_x', name: 'X', color: C.cyan }, { key: 'gyro_y', name: 'Y', color: C.green }, { key: 'gyro_z', name: 'Z', color: C.violet } ] },
];

export function init(root, ctx0) {
  const uPlot = window.uPlot;
  if (!uPlot) {
    root.innerHTML = '<div class="card c-chart"><div class="ct"><span>Графики</span></div><div class="miss">uPlot не се зареди (няма интернет към jsDelivr)</div></div>';
    return { update() {} };
  }
  const hist = ctx0.hist;
  const font = '10.5px -apple-system, "Segoe UI", system-ui, sans-serif';
  const axStroke = '#7d90a8', grid = 'rgba(120,150,190,.12)';

  const charts = DEFS.map((def) => {
    const card = document.createElement('div');
    card.className = 'card c-chart';
    card.innerHTML = `
      <div class="ct"><span>${def.title} <i class="u">${def.unit}</i></span>
        <span class="legend">${def.series.map((s, i) => `<span class="lg"><i style="background:${s.color}"></i>${s.name} <b class="num" data-v="${i}">—</b></span>`).join('')}</span></div>
      <div class="plot"></div>`;
    root.appendChild(card);
    const plot = card.querySelector('.plot');
    const vals = [...card.querySelectorAll('[data-v]')];

    const opts = {
      width: 300, height: 140,
      legend: { show: false }, cursor: { show: false }, select: { show: false },
      padding: [6, 16, 0, 0],
      scales: {
        x: { time: false, range: () => [-WINDOW_S, 0] },
        y: { range: (u, mn, mx) => {
          const half = def.min;
          if (def.lo != null) return [def.lo, Math.max(mx * 1.1, def.min)];
          const a = Math.max(Math.abs(mn), Math.abs(mx), half) * 1.08;
          return [-a, a];
        } },
      },
      axes: [
        { stroke: axStroke, font, size: 22, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
          splits: () => [-15, -10, -5, 0], values: (u, v) => v.map((x) => (x === 0 ? 'сега' : x + ' s')) },
        { stroke: axStroke, font, size: 40, gap: 2, ticks: { show: false }, grid: { stroke: grid, width: 1 },
          values: (u, v) => v.map((x) => (Math.abs(x) >= 100 || Number.isInteger(x) ? x.toFixed(0) : x.toFixed(def.d > 1 ? 1 : def.d))) },
      ],
      series: [{}].concat(def.series.map((s) => ({
        stroke: s.color, width: 1.6, points: { show: false }, dash: s.dash, spanGaps: false,
      }))),
    };
    const data = [new Float64Array(0)].concat(def.series.map(() => new Float32Array(0)));
    const u = new uPlot(opts, data, plot);
    const ro = new ResizeObserver(() => {
      const r = plot.getBoundingClientRect();
      if (r.width > 20 && r.height > 20) u.setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(plot);
    return { def, u, vals, data: null };
  });

  // Рамките на всеки пръстен са последни N записа; взимаме общата дължина и подравняваме по края.
  function build(c, tNow) {
    const keys = c.def.series, pairs = keys.map((s) => hist[s.key].arrays());
    let n = Infinity;
    for (const p of pairs) n = Math.min(n, p[0].length);
    if (!isFinite(n) || n < 2) return null;
    const x = new Float64Array(n), t = pairs[0][0], off = t.length - n;
    for (let i = 0; i < n; i++) x[i] = t[off + i] - tNow;
    const out = [x];
    for (const p of pairs) out.push(p[1].subarray(p[1].length - n));
    return out;
  }

  let last = 0, lastTxt = 0;
  return {
    update(ctx) {
      if (ctx.now - last < REDRAW_MS) return;
      last = ctx.now;
      const tNow = ctx.state.t;
      const txt = ctx.now - lastTxt > 150;
      if (txt) lastTxt = ctx.now;
      for (const c of charts) {
        const d = build(c, tNow);
        if (!d) continue;
        c.u.setData(d, true);
        if (txt) {
          for (let i = 0; i < c.vals.length; i++) {
            const arr = d[i + 1];
            setText(c.vals[i], fmt(arr[arr.length - 1], c.def.d, true));
          }
        }
      }
    },
  };
}
