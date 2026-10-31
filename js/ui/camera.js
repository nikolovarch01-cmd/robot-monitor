// Камера: поток (img) или заместител, отгоре HUD като при FPV дрон: хоризонт по наклона на главата и лента с курса.
import { setText, setAttr, setStyle, fmt, wrap360 } from './util.js';

const KH = 8.6;            // px на градус по вертикала (640×480, ~56° вертикално поле)
const KT = 5.6;            // px на градус по лентата на курса
const CARD = { 0: 'С', 90: 'И', 180: 'Ю', 270: 'З' };

function tapeSvg() {
  let ticks = '', labels = '';
  for (let a = -90; a <= 450; a += 5) {
    const x = a * KT, l = a % 15 === 0 ? 10 : 5;
    ticks += `M${x} 0v${l}`;
    if (a % 15 === 0) {
      const n = ((a % 360) + 360) % 360;
      const c = CARD[n];
      labels += `<text x="${x}" y="${c ? 27 : 24}" class="${c ? (n === 0 ? 'cam-tn' : 'cam-tc') : 'cam-td'}">${c || n}</text>`;
    }
  }
  return { ticks, labels };
}

function horizonSvg(withText) {
  let g = '';
  const seg = (y, len, gap, lab) => {
    let s = `<path d="M${-gap - len} ${y} h${len} M${gap} ${y} h${len}"/>`;
    if (lab && withText) s += `<text x="${-gap - len - 6}" y="${y + 3.5}" text-anchor="end">${lab}</text><text x="${gap + len + 6}" y="${y + 3.5}" text-anchor="start">${lab}</text>`;
    return s;
  };
  g += seg(0, 150, 56, '');
  for (const p of [10, 20, 30]) { g += seg(-p * KH, 34, 34, p); g += seg(p * KH, 34, 34, p); }
  return g;
}

export function init(root) {
  const tape = tapeSvg();
  root.innerHTML = `
    <div class="cam-stage">
      <img class="cam-img" alt="" decoding="async" hidden>
      <div class="cam-ph">
        <svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">
          <rect x="6" y="18" width="40" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="3"/>
          <path d="M46 28l12-7v22l-12-7z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
          <path d="M10 54L54 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <div class="cam-ph-t">Камера: няма връзка</div>
        <div class="cam-ph-s">само HUD от IMU на главата</div>
      </div>
      <svg class="cam-hud" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs><clipPath id="camTapeClip"><rect x="170" y="8" width="300" height="38" rx="6"/></clipPath>
          <clipPath id="camHorClip"><rect x="36" y="92" width="568" height="322"/></clipPath></defs>
        <g clip-path="url(#camHorClip)"><g id="camHor" transform="translate(320 240)" class="cam-hor"><g class="cam-sh">${horizonSvg(false)}</g><g class="cam-fg">${horizonSvg(true)}</g></g></g>
        <g class="cam-ret"><circle cx="320" cy="240" r="3.5"/><path d="M296 240h14M330 240h14M320 216v10"/></g>
        <rect x="170" y="8" width="300" height="38" rx="6" class="cam-tapebg"/>
        <g clip-path="url(#camTapeClip)"><g id="camTape" transform="translate(320 12)">
          <path d="${tape.ticks}" class="cam-tick"/>${tape.labels}</g></g>
        <path d="M320 47 l-6 9 h12 z" class="cam-caret"/>
        <text x="320" y="72" text-anchor="middle" class="cam-hdg" id="camHdg">000°</text>
        <text x="16" y="462" class="cam-info" id="camInfo">— к/с</text>
        <text x="624" y="462" text-anchor="end" class="cam-info" id="camSpd">0.00 м/с</text>
        <text x="16" y="34" class="cam-info dim">ГЛАВА</text>
      </svg>
    </div>`;
  const img = root.querySelector('.cam-img'), ph = root.querySelector('.cam-ph');
  const hor = root.querySelector('#camHor'), tp = root.querySelector('#camTape');
  const hdg = root.querySelector('#camHdg'), info = root.querySelector('#camInfo'), spd = root.querySelector('#camSpd');
  let url = null;
  img.addEventListener('load', () => { img.hidden = false; ph.hidden = true; });
  img.addEventListener('error', () => { img.hidden = true; ph.hidden = false; });

  return {
    update(ctx) {
      const s = ctx.state, h = s.head, c = s.camera;
      if (c.url !== url) {
        url = c.url;
        if (url) img.src = url; else { img.removeAttribute('src'); img.hidden = true; ph.hidden = false; }
      }
      const pitch = Math.max(-40, Math.min(40, h.pitch));
      setAttr(hor, 'transform', `translate(320 240) rotate(${(-h.roll).toFixed(1)}) translate(0 ${(pitch * KH).toFixed(1)})`);
      const hd = wrap360(h.heading);
      setAttr(tp, 'transform', `translate(${(320 - hd * KT).toFixed(1)} 12)`);
      if (ctx.slow) {
        setText(hdg, String(Math.round(hd) % 360).padStart(3, '0') + '°');
        setText(info, c.ok ? `${fmt(c.hz, 0)} к/с · ${c.w}×${c.h}` : `няма поток · ${c.w || 640}×${c.h || 480}`);
        setText(spd, fmt(s.body.speed / 1000, 2, true) + ' м/с');
      }
    },
  };
}
