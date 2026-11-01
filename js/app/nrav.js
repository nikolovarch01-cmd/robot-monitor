// Карта „Нрав“ (Управление): роботът сам избира нрава си по ситуацията, а тук може да се наложи един за известно
// време (docs/10-ochi-koncepciya.md, Михаил: „и двете“). Командата „nrav“ на P4 през /api/konzola.
// Сегашният нрав се вижда и на Табло, в картата със звука (ui/sound.js).
import { konzola } from './api.js';
import { esc, toast } from './ui.js';
import { NRAVI } from '../ui/util.js';
import { state } from '../state.js';

const VREME = [[5, '5 min'], [15, '15 min'], [60, '1 h']];

export function initNrav(card) {
  card.innerHTML = `
    <div class="ct"><span>Нрав</span><span class="ct-r"><span class="dim" data-r="st">—</span></span></div>
    <div class="nravi" data-keep>
      <button class="btn" type="button" data-n="sam">Сам избира</button>
      ${Object.entries(NRAVI).map(([id, ime]) => `<button class="btn" type="button" data-n="${id}">${esc(ime[0].toUpperCase() + ime.slice(1))}</button>`).join('')}
    </div>
    <div class="ct sp-top"><span>За колко</span></div>
    <div class="seg" data-r="vreme" data-keep>${VREME.map(([m, t]) => `<button type="button" data-m="${m}"${m === 15 ? ' class="on"' : ''}>${t}</button>`).join('')}</div>`;
  const st = card.querySelector('[data-r="st"]'), grid = card.querySelector('.nravi'), vreme = card.querySelector('[data-r="vreme"]');
  let busy = false, min = 15;

  function draw(n) {
    for (const b of grid.querySelectorAll('button')) {
      const sel = n.sam ? b.dataset.n === 'sam' : b.dataset.n === n.nrav;
      b.classList.toggle('acc', sel);
      b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    const ime = NRAVI[n.nrav] || '—';
    st.textContent = n.sam ? 'сам: ' + ime : 'наложен още ' + Math.max(1, Math.round((n.ostava_s || 0) / 60)) + ' min';
  }

  // командата печата един ред JSON: {"nrav":...} или {"err":"..."}
  async function run(line) {
    const txt = await konzola(line);
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('P4 още не познава „nrav“ (идва с новия фърмуер)');
    const j = JSON.parse(txt.slice(a, b + 1));
    if (j.err) throw new Error(j.err);
    return j;
  }

  async function load() {
    try { draw(await run('nrav')); }
    catch (e) { st.textContent = e.message || String(e); }
  }

  vreme.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-m]');
    if (!b) return;
    min = +b.dataset.m;
    for (const x of vreme.querySelectorAll('button')) x.classList.toggle('on', x === b);
  });
  grid.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-n]');
    if (!b || busy) return;
    busy = true;
    try { draw(await run(b.dataset.n === 'sam' ? 'nrav sam' : `nrav ${b.dataset.n} ${min}`)); }
    catch (e) { toast(e.message || String(e), true); }
    finally { busy = false; }
  });

  return {
    show: load,
    // докато разделът се вижда: от телеметрията (веднъж в секунда), без да се пита
    update(ctx) { if (ctx.slow && state.nrav.ime && !busy) draw({ nrav: state.nrav.ime, sam: state.nrav.sam, ostava_s: state.nrav.ostava_s }); },
  };
}
