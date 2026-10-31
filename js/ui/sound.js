// Звук: високоговорител с играещи ленти, име и сила.
import { setText, setStyle, setClass, clamp } from './util.js';

const N = 7;

export function init(root) {
  root.innerHTML = `
    <div class="snd">
      <svg class="snd-ic" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/>
        <path d="M21 11.5a6.5 6.5 0 0 1 0 9M24 8a11 11 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="snd-w"/>
      </svg>
      <div class="snd-bars">${'<i></i>'.repeat(N)}</div>
      <div class="snd-txt">
        <div class="snd-name" id="sndName">тишина</div>
        <div class="snd-vol num" id="sndVol">сила —</div>
      </div>
    </div>`;
  const box = root.querySelector('.snd'), bars = [...root.querySelectorAll('.snd-bars i')];
  const name = root.querySelector('#sndName'), vol = root.querySelector('#sndVol');
  const lvl = new Float32Array(N).fill(0.1);

  return {
    update(ctx) {
      const s = ctx.state.sound, t = ctx.now * 0.001, on = !!s.playing;
      const v = s.volume > 1 ? s.volume / 100 : s.volume;
      for (let i = 0; i < N; i++) {
        const target = on ? 0.18 + (0.45 + 0.37 * clamp(v, 0, 1)) * Math.abs(Math.sin(t * (4.1 + i * 1.37) + i * 1.9) * (0.65 + 0.35 * Math.sin(t * 2.3 + i))) : 0.1;
        lvl[i] += (target - lvl[i]) * (on ? 0.35 : 0.15);
        setStyle(bars[i], 'transform', `scaleY(${lvl[i].toFixed(2)})`);
      }
      setClass(box, on ? 'snd on' : 'snd');
      if (ctx.slow) {
        setText(name, on ? (s.name || 'звук') : 'тишина');
        setText(vol, 'сила ' + Math.round(clamp(v, 0, 1) * 100) + '%');
      }
    },
  };
}
