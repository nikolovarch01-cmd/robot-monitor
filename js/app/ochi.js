// Раздел „Очи“ в Настройка (Михаил, 2026-11-01: „сложи раздел в настройки очи, за да можем да ги настройваме“,
// „и големината на ириса там“, „по-видима дупка на зеницата и това около зеницата“, „подсветка зад зеницата“).
// Видът (oci vid), ключето на очите и числата им (oci p) с плъзгачи по групи. Числата, границите, подразбирането
// и обяснението идват от P4 („oci p json“), затова ново число във фърмуера излиза тук само, в „Други“.
// Смяната е на живо и P4 я пази и след рестарт.
import { konzola } from './api.js';
import { esc, toast, toastAct } from './ui.js';
import { klyuche } from '../ui/klyuche.js';

// Имената на екрана. k: множител за показване (0.38 → 38 %), u: единицата. f: „n“ важи само за видовете 1–3,
// „c“ е цяло число (кадри, пъти, праг).
const R = (n, ime, u, k, h, f = '') => ({ n, ime, u, k, h, nov: f.includes('n'), cel: f.includes('c') });
const GRUPI = [
  { ime: 'Ирисът и зеницата', otv: true, p: [
    R('iris', 'Големина на ириса', 'точки', 1, 'Радиусът на ириса. Видът ochi-v1 си е 50.', 'n'),
    R('zenica', 'Зеницата, когато няма никого', '% от ириса', 100, ''),
    R('zenica_cel', 'Зеницата, когато гледа някого', '% от ириса', 100, ''),
    R('zenica_dalb', 'Дълбочина на дупката', 'точки', 1, 'Колко дълбока изглежда зеницата: при поглед встрани се вижда стената ѝ.', 'n'),
    R('zenica_stena', 'Светлина на стената', '×', 1, 'Стената на дупката. 1 е обикновено, повече се вижда по-ясно.', 'n'),
    R('zenica_sianie', 'Сияние на дъното', '%', 100, 'Светлото на дъното на зеницата. 0 е без.', 'n'),
    R('podsvetka', 'Подсветка около зеницата', '%', 100, 'Светлият пръстен зад зеницата. 0 е без.', 'n'),
  ] },
  { ime: 'Отблизо', p: [
    R('zenica_ot_m', 'Зеницата се свива от', 'cm', 100, 'По-близо от толкова зеницата се свива, като при фокусиране.'),
    R('zenica_do_m', '… и е най-малка на', 'cm', 100, ''),
    R('zenica_blizo', 'С колко се свива', '% от ириса', 100, ''),
    R('blizo_ot_m', 'Спира да следи встрани от', 'cm', 100, 'По-близо очите само се събират към носа.'),
    R('blizo_do_m', '… и съвсем не следи встрани на', 'cm', 100, ''),
    R('blizo_gore_dolu', 'Отблизо следи нагоре-надолу', '%', 100, ''),
    R('nos_m', 'Половината разстояние между очите', 'cm', 100, 'Оттук се смята колко се събират към близко нещо.'),
  ] },
  { ime: 'Следене', p: [
    R('sled_tau', 'Бързина на следенето', 'ms', 1000, 'По-малко е по-бързо.'),
    R('skok_tau', 'Скок към нова цел', 'ms', 1000, ''),
    R('mirno', 'Спокойствие', '% от хода', 100, 'По-малките мърдания на целта не се следват. Против нервното.'),
    R('trepet', 'Потрепване', '×', 1, '1 е обикновено, 0 е никакво.'),
    R('izmer_dyal', 'Доверие в новото измерване', '%', 100, ''),
    R('predv_max_s', 'Предвиждане напред, най-много', 'ms', 1000, ''),
    R('zakasn_8x8', 'Закъснение на 8×8', 'кадъра', 1, 'Колко е старо измерването, в кадри на очите.', 'c'),
    R('zakasn_4x4', 'Закъснение на 8×8 при 4×4', 'кадъра', 1, '', 'c'),
    R('cel_zadarzh_ms', 'Целта се държи след изчезване', 'ms', 1, ''),
    R('vrashta_tau', 'Връщане към средата', 'ms', 1000, 'Когато целта изчезне.'),
    R('vrashta_s', 'Стои в средата след загубата', 's', 1, ''),
  ] },
  { ime: 'Мигане и оглеждане', p: [
    R('migane_ot', 'Мига на всеки, от', 's', 1, ''),
    R('migane_do', '… до', 's', 1, ''),
    R('migane_s', 'Колко трае мигането', 'ms', 1000, ''),
    R('migane_dvoyno', 'Двойно мигане', '%', 100, 'Колко често мига два пъти.'),
    R('ogled_ot', 'Без цел се оглежда на всеки, от', 's', 1, ''),
    R('ogled_do', '… до', 's', 1, ''),
    R('ogled_tau', 'Плъзгане при оглеждане', 'ms', 1000, ''),
    R('ogled_golyam', 'Голям поглед встрани', '%', 100, 'Колко често.'),
    R('spi_sled_s', 'Заспива без никого след', 's', 1, ''),
  ] },
  { ime: 'Главата', p: [
    R('naklon', 'Наклон при следене, до ±', '°', 1, ''),
    R('glava_sled_s', 'Тръгва след очите', 'ms', 1000, ''),
    R('glava_mrtva', 'Малкото отклонение остава за очите', '°', 1, ''),
    R('glava_spri', 'Спира толкова близо до целта', '°', 1, ''),
    R('glava_tau', 'Бързина', 'ms', 1000, 'За колко стига целта.'),
    R('glava_dom_s', 'След загубата тръгва към средата след', 's', 1, ''),
    R('glava_dom_tau', 'Връща се за', 's', 1, ''),
  ] },
  { ime: 'Какво следи', p: [
    R('tof_do_mm', '8×8 следи по-близо от', 'cm', 0.1, ''),
    R('tof_lenta_mm', '8×8: едно нещо е до', 'cm', 0.1, 'Зоните до толкова зад най-близката са едно нещо.'),
    R('tof_fon_mm', '8×8: ново нещо е по-близо от фона с', 'cm', 0.1, ''),
    R('kam_prag', 'Камерата: праг за движение', 'от 255', 1, 'Колко да се смени точка, за да е движение.', 'c'),
    R('kam_chast', 'Камерата: над тази част не е цел', '% от кадъра', 100, ''),
    R('kam_uspok_ms', 'Камерата не се вярва след завъртане', 'ms', 1, ''),
    R('kam_pati_ochi', 'Движение поред, за очите', 'пъти', 1, '', 'c'),
    R('kam_pati_glava', 'Движение поред, за главата', 'пъти', 1, '', 'c'),
  ] },
  { ime: 'Екранът', p: [R('kadri', 'Кадри в секунда', '/s', 1, '', 'c')] },
];

// Стъпката на плъзгача: около 200 стъпки от край до край, кръгло число (1, 2, 5 × 10ⁿ). Началото и подразбирането
// трябва да са на стъпка, иначе плъзгачът не стига до тях (5..1000 ms през 2 дава 41 вместо 40): тогава по-малка.
function stapka(lo, hi, d) {
  const r = (hi - lo) / 200;
  if (!(r > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(r))), m = r / e;
  let i = 3 * Math.round(Math.log10(e)) + (m >= 5 ? 2 : m >= 2 ? 1 : 0);     // 1, 2, 5, 10, 20, 50 … като номер
  const ot = (j) => [1, 2, 5][((j % 3) + 3) % 3] * Math.pow(10, Math.floor(j / 3));
  const naStapka = (v, s) => Math.abs(v / s - Math.round(v / s)) < 1e-6;
  for (let k = 0; k < 6 && !(naStapka(lo, ot(i)) && naStapka(d, ot(i))); k++) i--;
  return ot(i);
}
const decimali = (st) => Math.max(0, -Math.floor(Math.log10(st) + 1e-9));
const zaKomanda = (v) => String(+(+v).toPrecision(6));

export function initOchi(box) {
  box.innerHTML = `
    <div class="card oc-glava">
      <div class="ct"><span>Очи</span><span class="ct-r"><span class="dim" data-r="st"></span><span data-r="kl"></span></span></div>
      <div class="small dim">Смяната е на живо и роботът я пази и след рестарт. Пробва се, докато се гледат очите.</div>
      <div class="ct sp-top"><span>Видът</span></div>
      <div class="oc-vidove" data-r="vidove"></div>
    </div>
    <div class="oc-grupi" data-r="grupi"></div>
    <div class="oc-dolu" data-r="dolu" hidden><button class="btn mini bad" type="button" data-r="vsichki">Всички по подразбиране</button></div>`;
  const $ = (r) => box.querySelector(`[data-r="${r}"]`);
  const st = $('st'), vidoveEl = $('vidove'), grupiEl = $('grupi'), dolu = $('dolu');
  const kl = klyuche('ochi', 'Очи');
  $('kl').appendChild(kl.el);

  const P = { byN: {}, vid: 0, vidove: [], loaded: false };
  const otvoreni = {};                  // кои групи са отворени (до презареждане)
  const sost = {};                      // n → { busy, chaka }: една команда наведнъж, после последното
  let busyVid = false, loading = false;

  // ── вид ──
  function drawVidove() {
    vidoveEl.innerHTML = P.vidove.map((ime, i) =>
      `<button class="btn${i === P.vid ? ' acc' : ''}" type="button" data-vid="${i}" aria-pressed="${i === P.vid}">${esc(ime)}</button>`).join('');
    box.classList.toggle('oc-v1', P.vid === 0);
  }
  vidoveEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-vid]');
    if (!b || busyVid) return;
    const n = +b.dataset.vid;
    busyVid = true;
    b.disabled = true;
    try {
      const txt = await konzola('oci vid ' + n);
      if (!new RegExp('^->\\s*' + n + '\\s', 'm').test(txt)) throw new Error(txt.trim() || 'P4 не отговори');
      P.vid = n;
    } catch (e) { toast('Видът: ' + (e.message || e), true); }
    finally { busyVid = false; drawVidove(); }
  });

  // ── числата ──
  function red(d, p) {
    const k = d.k, lo = p.lo * k, hi = p.hi * k, sp0 = stapka(lo, hi, p.d * k), sp = d.cel ? Math.max(1, sp0) : sp0, dc = decimali(sp);
    Object.assign(d, { lo, hi, sp, dc });
    const v = (p.v * k).toFixed(dc), def = (p.d * k).toFixed(dc);
    const dk = hi > lo ? (p.d * k - lo) / (hi - lo) : 0;
    return `<div class="prm oc-p${d.nov ? ' oc-nov' : ''}" data-n="${esc(d.n)}">
      <div class="oc-h"><span class="oc-ime" title="oci p ${esc(d.n)}">${esc(d.ime)}${d.nov ? ' <span class="badge-s">новите видове</span>' : ''}</span>
        <span class="oc-v"><input class="inp oc-num" type="number" inputmode="decimal" step="${sp}" min="${lo.toFixed(dc)}" max="${hi.toFixed(dc)}" value="${v}" aria-label="${esc(d.ime)}"><span class="oc-u">${esc(d.u)}</span></span></div>
      ${d.h ? `<div class="help">${esc(d.h)}</div>` : ''}
      <input class="rng" type="range" min="${lo.toFixed(dc)}" max="${hi.toFixed(dc)}" step="${sp}" value="${v}" style="--dk:${dk.toFixed(4)}" aria-label="${esc(d.ime)}">
      <div class="lim oc-lim"><span>${lo.toFixed(dc)} … ${hi.toFixed(dc)} · по подразбиране ${def}</span><button class="btn mini oc-um" type="button" hidden>↺ ${def}</button></div>
    </div>`;
  }
  // описанията от P4 за числата, които таблицата горе не знае
  const opisi = {};
  function drawGrupi() {
    const znae = new Set();
    let html = '';
    const grupi = GRUPI.map((g) => ({ ...g, p: g.p.filter((d) => P.byN[d.n]) }));
    const drugi = Object.keys(P.byN).filter((n) => !GRUPI.some((g) => g.p.some((d) => d.n === n)));
    if (drugi.length) grupi.push({ ime: 'Други', p: drugi.map((n) => R(n, n, '', 1, P.byN[n].o || '')) });
    for (const g of grupi) {
      if (!g.p.length) continue;
      const otv = otvoreni[g.ime] !== undefined ? otvoreni[g.ime] : !!g.otv;
      html += `<details class="grp card" data-g="${esc(g.ime)}"${otv ? ' open' : ''}><summary>${esc(g.ime)} <span class="dim">(${g.p.length})</span></summary>` +
        (g.p.some((d) => d.nov) ? '<div class="small dim oc-v1-bel">Видът ochi-v1 не ползва числата с „новите видове“. Те важат за другите три вида.</div>' : '') +
        '<div class="prm-grid">' + g.p.map((d) => { opisi[d.n] = d; znae.add(d.n); return red(d, P.byN[d.n]); }).join('') + '</div></details>';
    }
    grupiEl.innerHTML = html;
    for (const n of znae) obnovi(n);
    dolu.hidden = !znae.size;
  }
  grupiEl.addEventListener('toggle', (ev) => { const d = ev.target; if (d.matches && d.matches('details.grp')) otvoreni[d.dataset.g] = d.open; }, true);

  const redEl = (n) => grupiEl.querySelector(`.oc-p[data-n="${CSS.escape(n)}"]`);
  // плъзгачът, полето и ↺ от стойността на P4 (или от командваната, докато върви)
  function obnovi(n, pokazhi) {
    const el = redEl(n), d = opisi[n], p = P.byN[n];
    if (!el || !d || !p) return;
    const v = pokazhi !== undefined ? pokazhi : p.v * d.k;
    const rng = el.querySelector('.rng'), num = el.querySelector('.oc-num');
    const t = (+v).toFixed(d.dc);
    if (document.activeElement !== num) num.value = t;
    if (pokazhi === undefined) rng.value = t;
    rng.style.setProperty('--p', ((v - d.lo) / (d.hi - d.lo || 1) * 100).toFixed(2) + '%');
    el.querySelector('.oc-um').hidden = Math.abs(p.v - p.d) <= Math.abs(p.d) * 1e-6 + 1e-9;
    el.classList.toggle('oc-busy', !!(sost[n] && sost[n].busy));
  }

  // една команда на число наведнъж; докато върви, се пази само последната стойност
  async function prati(n, raw) {
    const s = sost[n] || (sost[n] = { busy: false, chaka: null });
    if (s.busy) { s.chaka = raw; return; }
    s.busy = true;
    obnovi(n, raw * opisi[n].k);
    try {
      const txt = await konzola(`oci p ${n} ${zaKomanda(raw)}`);
      if (!/\(записано\)/.test(txt)) throw new Error(txt.trim() || 'P4 не отговори');
      P.byN[n].v = raw;
    } catch (e) {
      s.chaka = null;
      toast(opisi[n].ime + ': ' + (e.message || e), true);
    } finally {
      s.busy = false;
      const w = s.chaka;
      s.chaka = null;
      if (w !== null && w !== P.byN[n].v) prati(n, w); else obnovi(n);
    }
  }

  grupiEl.addEventListener('input', (ev) => {
    const t = ev.target, el = t.closest('.oc-p');
    if (!el || !t.classList.contains('rng')) return;
    const n = el.dataset.n, d = opisi[n];
    obnovi(n, +t.value);
    prati(n, +t.value / d.k);
  });
  grupiEl.addEventListener('change', (ev) => {
    const t = ev.target, el = t.closest('.oc-p');
    if (!el || !t.classList.contains('oc-num')) return;
    const n = el.dataset.n, d = opisi[n], v = parseFloat(String(t.value).replace(',', '.'));
    if (!isFinite(v) || v < d.lo - 1e-9 || v > d.hi + 1e-9) {
      toast(d.ime + ': от ' + d.lo.toFixed(d.dc) + ' до ' + d.hi.toFixed(d.dc), true);
      t.value = (P.byN[n].v * d.k).toFixed(d.dc);
      return;
    }
    prati(n, v / d.k);
  });
  grupiEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.classList.contains('oc-num')) ev.target.blur(); });
  grupiEl.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.oc-um');
    if (!b) return;
    const n = b.closest('.oc-p').dataset.n;
    if (sost[n] && sost[n].busy) return;
    b.disabled = true;
    try {
      const txt = await konzola(`oci p ${n} umolch`);
      if (!/\(записано\)/.test(txt)) throw new Error(txt.trim() || 'P4 не отговори');
      P.byN[n].v = P.byN[n].d;
    } catch (e) { toast(opisi[n].ime + ': ' + (e.message || e), true); }
    finally { b.disabled = false; obnovi(n); }
  });

  // всички по подразбиране: обратимо, затова без питане, а с „↶ Отмени“ (02_DIZAYN 1.3)
  $('vsichki').addEventListener('click', async () => {
    const smeneni = Object.values(P.byN).filter((p) => p.v !== p.d).map((p) => [p.n, p.v]);
    if (!smeneni.length) { toast('Всички числа на очите са по подразбиране'); return; }
    try {
      const txt = await konzola('oci p umolch');
      if (!/по подразбиране/.test(txt)) throw new Error(txt.trim() || 'P4 не отговори');
      for (const p of Object.values(P.byN)) p.v = p.d;
      for (const n in P.byN) obnovi(n);
      toastAct('Числата на очите са по подразбиране (' + smeneni.length + ' сменени)', '↶ Отмени', async () => {
        for (const [n, v] of smeneni) {
          try {
            const t = await konzola(`oci p ${n} ${zaKomanda(v)}`);
            if (/\(записано\)/.test(t)) P.byN[n].v = v;
          } catch (e) { toast('Не се върна: ' + (e.message || e), true); break; }
          obnovi(n);
        }
      });
    } catch (e) { toast(e.message || String(e), true); }
  });

  // „oci p json“: {"p":[{n,v,d,lo,hi,o}…],"vid":n,"vidove":[…]}
  async function load() {
    if (loading) return;
    loading = true;
    if (!P.loaded) st.innerHTML = '<span class="spin"></span> чете от P4…';
    try {
      const txt = await konzola('oci p json');
      const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
      if (a < 0 || b < a) throw new Error('P4 още не дава числата на очите (идва с новия фърмуер)');
      let j;
      try { j = JSON.parse(txt.slice(a, b + 1)); } catch (e) { throw new Error('Отговорът на P4 е непълен'); }
      P.byN = {};
      for (const p of j.p || []) if (p && typeof p.n === 'string' && isFinite(p.v)) P.byN[p.n] = p;
      P.vidove = Array.isArray(j.vidove) ? j.vidove : [];
      P.vid = +j.vid || 0;
      P.loaded = true;
      st.textContent = '';
      drawVidove();
      drawGrupi();
    } catch (e) {
      st.textContent = '';
      if (!P.loaded) grupiEl.innerHTML = `<div class="card small warnc">${esc(e.message || e)}</div>`;
      else toast(e.message || String(e), true);
    } finally { loading = false; }
  }

  return {
    show: load,
    update(ctx) { if (ctx.slow) kl.update(); },
  };
}
