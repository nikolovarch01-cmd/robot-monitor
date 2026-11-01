// Карта „Части“ (Настройка и плочка на Табло): включване и изключване на датчиците и другите части на главата.
// Всяка част е ред с име и ключе (ui/klyuche.js, командата „vkl“ на P4); изборът се пази на робота и след рестарт.
// Изключеното се вижда в лентата със здравето като сиво „изкл.“ (rates.js), не като повреда.
import { vkl, klyuche } from '../ui/klyuche.js';
import { esc } from './ui.js';

export function initChasti(card) {
  card.innerHTML = `
    <div class="ct"><span>Части</span><span class="ct-r"><span class="dim">пази се и след рестарт</span></span></div>
    <div class="small dim">Изключената част не мери, не грее и не пие ток. Горе в лентата е сива „изкл.“.</div>
    <div class="parts" data-keep></div>`;
  const list = card.querySelector('.parts');
  let keys = [];

  function draw(parts) {
    for (const k of keys) k.destroy();
    keys = [];
    list.innerHTML = parts.map((p) => `
      <div class="part${p.e ? '' : ' none'}">
        <span class="part-n">${esc(p.ime)}${p.e ? '' : ' <i class="dim">няма я</i>'}</span>
      </div>`).join('');
    [...list.children].forEach((row, i) => {
      const k = klyuche(parts[i].id, parts[i].ime);
      row.appendChild(k.el);
      keys.push(k);
    });
  }

  async function load() {
    try { draw(await vkl('vkl')); }
    catch (e) { for (const k of keys) k.destroy(); keys = []; list.innerHTML = `<div class="small warnc">${esc(e.message || e)}</div>`; }
  }

  return {
    show: load,
    // състоянието идва и от честотите (веднъж в секунда): ключетата се сверяват с тях
    update(ctx) { if (ctx.slow) for (const k of keys) k.update(); },
    destroy() { for (const k of keys) k.destroy(); keys = []; },
  };
}
