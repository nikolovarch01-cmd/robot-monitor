// Лента с честотите: всеки датчик с измерено и очаквано Hz. Зелено от 90 %, кехлибар по-ниско, червено без данни.
import { setText, setClass, setStyle, fmt } from './util.js';

// Кратките имена: робот дава 12 реда и пълните не се събират; пълното име е в подсказката
const SHORT = {
  kam: 'Камера', dvizh: 'Движение', tof: '8×8', zad: 'Отзад', imu: 'IMU', kompas: 'Компас', tok: 'Ток', gps: 'GPS',
  st2: 'Тяло', rx: 'От тялото', tx: 'Към тялото', ochi: 'Очи',
};

export function init(root) {
  let ids = '';
  let chips = [];

  function build(list) {
    root.innerHTML = list.map((r) => `
      <div class="rate" data-id="${r.id}" title="${r.ime}${r.kakvo ? ' (' + r.kakvo + ')' : ''}">
        <div class="rate-top"><i class="dot"></i><span class="rate-name">${SHORT[r.id] || r.ime}</span><span class="rate-val num"><b></b><span class="rate-exp"></span></span></div>
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
        // без очаквана честота и без данни (GPS вкъщи): сиво, не червено
        const cls = r.ok <= 0 && r.hz <= 0 ? 'off' : r.hz <= 0 ? 'bad' : ratio >= 0.9 ? 'good' : 'warn';
        setClass(c.el, 'rate ' + cls);
        setText(c.b, fmt(r.hz, r.hz < 100 ? 1 : 1));
        setText(c.exp, r.ok > 0 ? ' / ' + r.ok + ' Hz' : ' Hz');
        setStyle(c.bar, 'width', Math.min(100, Math.round(ratio * 100)) + '%');
      }
    },
  };
}
