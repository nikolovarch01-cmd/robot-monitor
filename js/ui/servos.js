// Серви: пан и тилт като дъги — позиция, цел (призрак), скорост, импулс, режим, ток.
import { setText, setAttr, setClass, fmt, clamp } from './util.js';

const GCX = 70, GCY = 62, GR = 47, SWEEP = 110;      // дъгата е ±110° от върха
const ARC_LEN = GR * SWEEP * Math.PI / 180;
const MODES = { off: ['ИЗКЛ', 'off'], on: ['ВКЛ', 'accent'], cent: ['ЦЕНТЪР', 'warn'], park: ['ПАРК', 'warn'] };
const S = (d) => Math.sin(d * Math.PI / 180), C = (d) => Math.cos(d * Math.PI / 180);

function gaugeSvg(key, range) {
  const pt = (d, r = GR) => `${(GCX + r * S(d)).toFixed(2)} ${(GCY - r * C(d)).toFixed(2)}`;
  const full = `M${pt(-SWEEP)} A${GR} ${GR} 0 1 1 ${pt(SWEEP)}`;
  const right = `M${pt(0)} A${GR} ${GR} 0 0 1 ${pt(SWEEP)}`;
  const left = `M${pt(0)} A${GR} ${GR} 0 0 0 ${pt(-SWEEP)}`;
  let ticks = '';
  for (let i = -3; i <= 3; i++) {
    const d = i * SWEEP / 3, l = (i === 0 || Math.abs(i) === 3) ? 8 : 5;
    ticks += `M${pt(d, GR + 8)}L${pt(d, GR + 8 - l)}`;
  }
  return `
  <svg viewBox="0 0 140 98" class="sv-svg" aria-hidden="true">
    <path d="${full}" class="sv-track"/>
    <path d="${ticks}" class="sv-tick"/>
    <path id="${key}R" d="${right}" class="sv-val" stroke-dasharray="${ARC_LEN.toFixed(2)}" stroke-dashoffset="${ARC_LEN.toFixed(2)}"/>
    <path id="${key}L" d="${left}" class="sv-val" stroke-dasharray="${ARC_LEN.toFixed(2)}" stroke-dashoffset="${ARC_LEN.toFixed(2)}"/>
    <g id="${key}T" transform="rotate(0 ${GCX} ${GCY})"><circle cx="${GCX}" cy="${GCY - GR}" r="5.6" class="sv-ghost"/></g>
    <g id="${key}P" transform="rotate(0 ${GCX} ${GCY})"><circle cx="${GCX}" cy="${GCY - GR}" r="5.2" class="sv-dot"/></g>
    <text x="${GCX}" y="${GCY + 2}" text-anchor="middle" class="sv-num" id="${key}N">0°</text>
    <text x="${GCX}" y="${GCY + 17}" text-anchor="middle" class="sv-lbl">${key === 'pan' ? 'ПАН' : 'ТИЛТ'}</text>
    <text x="10" y="94" class="sv-end">−${range}°</text><text x="130" y="94" text-anchor="end" class="sv-end">+${range}°</text>
  </svg>`;
}

export function init(root) {
  root.innerHTML = `
    <div class="ct"><span>Серви на главата</span><span class="ct-r"><b class="num" id="svA">—</b> <span class="chip" id="svMode">—</span></span></div>
    <div class="sv-grid">
      ${['pan', 'tilt'].map((k) => `
        <div class="sv">
          ${gaugeSvg(k, k === 'pan' ? 90 : 45)}
          <div class="sv-rows num">
            <div><span class="k">Цел</span><b id="${k}Tg">—</b></div>
            <div><b id="${k}Sp">—</b><b id="${k}Us">—</b></div>
          </div>
        </div>`).join('')}
    </div>`;

  const $ = (s) => root.querySelector(s);
  const g = {};
  for (const k of ['pan', 'tilt']) {
    g[k] = { R: $(`#${k}R`), L: $(`#${k}L`), T: $(`#${k}T`), P: $(`#${k}P`), N: $(`#${k}N`), Tg: $(`#${k}Tg`), Sp: $(`#${k}Sp`), Us: $(`#${k}Us`), range: k === 'pan' ? 90 : 45 };
  }
  const mode = $('#svMode'), amp = $('#svA');

  return {
    update(ctx) {
      const sv = ctx.state.servos;
      for (const k of ['pan', 'tilt']) {
        const s = sv[k], e = g[k];
        // пан е ±90, тилт ±45 → върху ±110° по дъгата
        const sc = SWEEP / e.range;
        const pos = clamp(s.deg, -e.range, e.range), tgt = clamp(s.target, -e.range, e.range);
        setAttr(e.P, 'transform', `rotate(${(pos * sc).toFixed(2)} ${GCX} ${GCY})`);
        setAttr(e.T, 'transform', `rotate(${(tgt * sc).toFixed(2)} ${GCX} ${GCY})`);
        const f = Math.abs(pos) / e.range;
        const off = (ARC_LEN * (1 - f)).toFixed(1);
        setAttr(pos >= 0 ? e.R : e.L, 'stroke-dashoffset', off);
        setAttr(pos >= 0 ? e.L : e.R, 'stroke-dashoffset', ARC_LEN.toFixed(1));
        if (ctx.slow) {
          setText(e.N, fmt(s.deg, 1, true) + '°');
          setText(e.Tg, fmt(s.target, 1, true) + '°');
          setText(e.Sp, fmt(Math.abs(s.speed_dps), 0) + ' °/s');
          setText(e.Us, Math.round(s.us) + ' µs');
          setClass(e.N, 'sv-num' + (s.cut ? ' cut' : ''));
        }
      }
      if (ctx.slow) {
        const md = MODES[sv.mode] || [String(sv.mode).toUpperCase(), 'off'];
        setText(mode, sv.on ? md[0] : 'ИЗКЛ');
        setClass(mode, 'chip ' + (sv.on ? md[1] : 'off'));
        setText(amp, sv.current_a == null ? '—' : fmt(sv.current_a, 2) + ' A');
      }
    },
  };
}
