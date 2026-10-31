// Карта „Части“ (Настройка): включване и изключване на датчиците и другите части на главата.
// Говори с командата „vkl“ на P4 през /api/konzola; изборът се пази на робота и след рестарт.
// Изключеното се вижда в лентата със здравето като сиво „изкл.“ (rates.js), не като повреда.
import { konzola } from './api.js';
import { esc, toast } from './ui.js';

export function initChasti(card) {
  card.innerHTML = `
    <div class="ct"><span>Части</span><span class="ct-r"><span class="dim">пази се и след рестарт</span></span></div>
    <div class="small dim">Изключената част не мери, не грее и не пие ток. Горе в лентата е сива „изкл.“.</div>
    <div class="parts" data-keep></div>`;
  const list = card.querySelector('.parts');
  let busy = false;

  function draw(parts) {
    list.innerHTML = parts.map((p) => `
      <div class="part${p.e ? '' : ' none'}">
        <span class="part-n">${esc(p.ime)}${p.e ? '' : ' <i class="dim">няма я</i>'}</span>
        <div class="seg seg-part">
          <button type="button" data-id="${esc(p.id)}" data-on="1" class="${p.e && p.on ? 'on' : ''}"${p.e ? '' : ' disabled'}>вкл</button>
          <button type="button" data-id="${esc(p.id)}" data-on="0" class="${p.e && !p.on ? 'on' : ''}"${p.e ? '' : ' disabled'}>изкл</button>
        </div>
      </div>`).join('');
  }

  // командата печата един ред JSON: {"c":[...]} или {"err":"..."}
  async function run(line) {
    const txt = await konzola(line);
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('P4 не познава „vkl“ (стар фърмуер?)');
    const j = JSON.parse(txt.slice(a, b + 1));
    if (j.err) throw new Error(j.err);
    return j.c || [];
  }

  async function load() {
    try { draw(await run('vkl')); }
    catch (e) { list.innerHTML = `<div class="small warnc">${esc(e.message || e)}</div>`; }
  }

  list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-id]');
    if (!btn || busy || btn.classList.contains('on')) return;
    busy = true;
    for (const x of list.querySelectorAll('button')) x.disabled = true;
    try { draw(await run(`vkl ${btn.dataset.id} ${btn.dataset.on === '1' ? 'on' : 'off'}`)); }
    catch (e) { toast(e.message || String(e), true); load(); }
    finally { busy = false; }
  });

  return { show: load };
}
