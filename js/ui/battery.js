// Батерия 3S: голяма иконка, която се изпразва, с %, V, A, W. Зелено над 40 %, кехлибар 20–40 %, червено под 20 %.
import { setText, fmt, makeBatteryIcon } from './util.js';

export function init(root) {
  root.innerHTML = `
    <div class="ct"><span>Батерия</span><span class="ct-r" id="batNote">3S LiPo 1300 mAh</span></div>
    <div class="bat-row">
      <div class="bat-icon"></div>
      <div class="bat-nums">
        <div class="bat-pct num" id="batPct">—</div>
        <div class="bat-sub num"><b id="batV">—</b> V · <b id="batA">—</b> A · <b id="batW">—</b> W</div>
      </div>
    </div>`;
  const icon = makeBatteryIcon(root.querySelector('.bat-icon'), { w: 96, h: 43 });
  const pct = root.querySelector('#batPct'), v = root.querySelector('#batV'), a = root.querySelector('#batA'), w = root.querySelector('#batW');
  const note = root.querySelector('#batNote');
  return {
    update(ctx) {
      const b = ctx.state.battery;
      icon.update(b.pct);
      if (ctx.slow) {
        setText(pct, b.pct == null ? '—' : Math.round(b.pct) + '%');
        setText(v, fmt(b.v, 2)); setText(a, fmt(b.a, 2)); setText(w, fmt(b.w, 1));
        setText(note, b.low ? 'ниска!' : '3S LiPo 1300 mAh');
        note.classList.toggle('bad', !!b.low);
      }
    },
  };
}
