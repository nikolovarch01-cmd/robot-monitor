// Лента с честотите: всеки датчик с измерено и очаквано Hz. Зелено от 90 %, кехлибар по-ниско, червено без данни.
import { setText, setClass, setStyle, fmt } from './util.js';

export function init(root) {
  let ids = '';
  let chips = [];

  function build(list) {
    root.innerHTML = list.map((r) => `
      <div class="rate" data-id="${r.id}">
        <div class="rate-top"><i class="dot"></i><span class="rate-name">${r.ime}</span><span class="rate-val num"><b></b><span class="rate-exp"></span></span></div>
        <div class="rate-bar"><i></i></div>
      </div>`).join('');
    chips = [...root.querySelectorAll('.rate')].map((e) => ({
      el: e, dot: e.querySelector('.dot'), b: e.querySelector('b'), exp: e.querySelector('.rate-exp'), bar: e.querySelector('.rate-bar i'),
    }));
  }

  return {
    update(ctx) {
      if (!ctx.slow) return;
      const list = ctx.state.rates;
      if (!list || !list.length) return;
      const key = list.map((r) => r.id).join(',');
      if (key !== ids) { ids = key; build(list); }
      for (let i = 0; i < list.length; i++) {
        const r = list[i], c = chips[i], ratio = r.ok > 0 ? r.hz / r.ok : 1;
        const cls = r.hz <= 0 ? 'bad' : ratio >= 0.9 ? 'good' : 'warn';
        setClass(c.el, 'rate ' + cls);
        setText(c.b, fmt(r.hz, r.hz < 100 ? 1 : 1));
        setText(c.exp, ' / ' + r.ok + ' Hz');
        setStyle(c.bar, 'width', Math.min(100, Math.round(ratio * 100)) + '%');
      }
    },
  };
}
