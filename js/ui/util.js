// Малки помощници за изгледите: без зависимости, без алокации в горещите пътища.

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;

export function wrap360(a) { a %= 360; return a < 0 ? a + 360 : a; }
export function wrap180(a) { a = wrap360(a); return a > 180 ? a - 360 : a; }

// Записва текст само ако се е променил (без излишно преподреждане).
export function setText(node, s) {
  if (node._s !== s) { node._s = s; node.textContent = s; }
}
// Записва атрибут само ако се е променил.
export function setAttr(node, k, v) {
  const key = '_a_' + k;
  if (node[key] !== v) { node[key] = v; node.setAttribute(k, v); }
}
export function setStyle(node, k, v) {
  const key = '_s_' + k;
  if (node[key] !== v) { node[key] = v; node.style[k] = v; }
}
export function setClass(node, c) {
  if (node._c !== c) { node._c = c; node.setAttribute('class', c); }
}

// Число за показване: d знака, незадължителен знак +.
export function fmt(v, d = 1, signed = false) {
  if (v == null || !isFinite(v)) return '—';
  const s = v.toFixed(d);
  return signed && v >= 0 ? '+' + s : s;
}

export function $(sel, root) { return (root || document).querySelector(sel); }

// Цветова скала за разстояние: близо топло, далеко студено. Входът е mm.
const STOPS = [
  [200, 255, 92, 64],
  [600, 255, 178, 74],
  [1100, 160, 232, 120],
  [1900, 60, 205, 255],
  [3200, 92, 120, 255],
];
export function distRGB(mm, out, o) {
  let i = 0;
  if (mm <= STOPS[0][0]) i = 0;
  else if (mm >= STOPS[STOPS.length - 1][0]) i = STOPS.length - 2;
  else { while (mm > STOPS[i + 1][0]) i++; }
  const a = STOPS[i], b = STOPS[i + 1];
  let k = (mm - a[0]) / (b[0] - a[0]); k = k < 0 ? 0 : k > 1 ? 1 : k;
  out[o] = (a[1] + (b[1] - a[1]) * k) / 255;
  out[o + 1] = (a[2] + (b[2] - a[2]) * k) / 255;
  out[o + 2] = (a[3] + (b[3] - a[3]) * k) / 255;
}
// Таблица с CSS цветове (стъпка 20 mm до 4 m) за 2D картата.
const _tmp = [0, 0, 0];
export const DIST_CSS = (() => {
  const t = [];
  for (let mm = 0; mm <= 4000; mm += 20) {
    distRGB(mm, _tmp, 0);
    t.push(`rgb(${Math.round(_tmp[0] * 255)},${Math.round(_tmp[1] * 255)},${Math.round(_tmp[2] * 255)})`);
  }
  return t;
})();
export function distCss(mm) { return DIST_CSS[clamp((mm / 20) | 0, 0, DIST_CSS.length - 1)]; }
export const DIST_GRADIENT_CSS = (() => {
  const parts = [];
  for (let mm = 200; mm <= 3200; mm += 300) {
    distRGB(mm, _tmp, 0);
    parts.push(`rgb(${Math.round(_tmp[0] * 255)},${Math.round(_tmp[1] * 255)},${Math.round(_tmp[2] * 255)})`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
})();

// Иконка на батерия (SVG). Връща { update(pct) } и работи за голямата и за малката.
export function makeBatteryIcon(host, opts = {}) {
  const w = opts.w || 110, h = opts.h || 50;
  host.innerHTML =
    `<svg class="bat-svg" viewBox="0 0 116 52" width="${w}" height="${h}" aria-hidden="true">
      <rect x="1.5" y="1.5" width="104" height="49" rx="10" class="bat-shell"/>
      <rect x="108" y="16" width="6" height="20" rx="2.5" class="bat-cap"/>
      <rect x="7" y="7" width="0" height="38" rx="6" class="bat-fill"/>
      <path d="M33 7v38M59 7v38M85 7v38" class="bat-seg"/>
    </svg>`;
  const svg = host.firstElementChild;
  const fill = svg.querySelector('.bat-fill');
  const full = 92;
  return {
    update(pct) {
      const has = pct != null && isFinite(pct);
      const p = has ? clamp(pct, 0, 100) : 0;
      const wd = Math.round(full * p / 100 * 10) / 10;
      setAttr(fill, 'width', String(wd < 3 && has && p > 0 ? 3 : wd));
      setClass(svg, 'bat-svg ' + (!has ? 'bat-na' : p > 40 ? 'bat-good' : p >= 20 ? 'bat-warn' : 'bat-bad'));
    },
  };
}
