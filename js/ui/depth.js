// Карта 8×8 на VL53L5CX (2D) плюс разстоянието отзад. Рисува се само при нов кадър.
import { setText, fmt, distCss, DIST_GRADIENT_CSS } from './util.js';

export function init(root) {
  root.innerHTML = `
    <div class="ct"><span>Дълбочина 8×8</span><span class="ct-r num" id="dpHz">— к/с</span></div>
    <div class="dp-wrap"><canvas class="dp-cv"></canvas></div>
    <div class="dp-leg"><span>0.2 м</span><i style="background:${DIST_GRADIENT_CSS}"></i><span>3 м</span></div>
    <div class="dp-row">
      <div><span class="k">Най-близо</span><b class="num" id="dpMin">—</b></div>
      <div><span class="k">Отзад</span><b class="num" id="dpRear">—</b></div>
    </div>`;
  const cv = root.querySelector('.dp-cv'), ctx2 = cv.getContext('2d');
  const hz = root.querySelector('#dpHz'), mn = root.querySelector('#dpMin'), rear = root.querySelector('#dpRear');
  let cw = 0, ch = 0, dpr = 1, lastFrame = -1, dirty = true;

  const ro = new ResizeObserver(() => {
    const r = cv.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const side = Math.floor(Math.min(r.width, r.height));
    if (side < 10) return;
    cw = ch = side;
    cv.width = Math.round(side * dpr); cv.height = Math.round(side * dpr);
    cv.style.width = side + 'px'; cv.style.height = side + 'px';
    dirty = true;
  });
  ro.observe(cv.parentElement);

  function draw(tof) {
    const g = ctx2, S = cw * dpr, cell = S / 8, pad = Math.max(1.5, cell * 0.05), rr = cell * 0.16;
    g.clearRect(0, 0, S, S);
    g.font = `600 ${Math.round(cell * 0.27)}px -apple-system, "Segoe UI", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const i = r * 8 + c, mm = tof.mm[i], x = c * cell + pad, y = r * cell + pad, w = cell - pad * 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w, w, rr); else g.rect(x, y, w, w);
        if (mm >= 0 && tof.valid[i]) {
          g.fillStyle = distCss(mm); g.fill();
          g.fillStyle = 'rgba(8,12,18,.78)';
          g.fillText((mm / 1000).toFixed(2), x + w / 2, y + w / 2 + 0.5);
        } else {
          g.fillStyle = 'rgba(255,255,255,.04)'; g.fill();
          g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = dpr; g.stroke();
          g.fillStyle = 'rgba(255,255,255,.22)';
          g.fillText('—', x + w / 2, y + w / 2);
        }
      }
    }
  }

  return {
    update(ctx) {
      const tof = ctx.state.tof;
      if (tof.frame !== lastFrame || dirty) {
        lastFrame = tof.frame; dirty = false;
        if (cw) draw(tof);
        let min = 1e9;
        for (let i = 0; i < 64; i++) if (tof.valid[i] && tof.mm[i] >= 0 && tof.mm[i] < min) min = tof.mm[i];
        setText(mn, min < 1e9 ? (min / 1000).toFixed(2) + ' м' : '—');
      }
      if (ctx.slow) {
        setText(hz, fmt(tof.hz, 1) + ' к/с');
        const r = ctx.state.rear;
        setText(rear, r.ok && r.mm != null ? (r.mm / 1000).toFixed(2) + ' м' : '—');
      }
    },
  };
}
