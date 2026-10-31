// Тяло и колела: две колела, които се въртят, скорост, наклон срещу заданието, по мотор: V, A, W, N·m, нагряване, цикъл на баланса.
import { setText, setAttr, setStyle, setClass, fmt, clamp, wrap360 } from './util.js';

const LOOP_BUDGET_US = 2500;   // 400 Hz

function dialSvg(id) {
  let spokes = '', ticks = '';
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    spokes += `<line x1="0" y1="-11" x2="0" y2="-34" transform="rotate(${a})" class="${i === 0 ? 'wh-sp0' : 'wh-sp'}"/>`;
  }
  for (let a = 0; a < 360; a += 30) ticks += `<line x1="0" y1="-47" x2="0" y2="${a % 90 === 0 ? -42 : -44.5}" transform="rotate(${a})"/>`;
  return `
  <svg viewBox="-50 -50 100 100" class="wh-svg" aria-hidden="true">
    <circle r="47" class="wh-rim"/>
    <g class="wh-ticks">${ticks}</g>
    <g id="${id}">
      <circle r="38" class="wh-tire"/>
      <circle r="35" class="wh-inner"/>
      ${spokes}
      <circle cx="0" cy="-34" r="3.2" class="wh-dot"/>
      <circle r="9.5" class="wh-hub"/><circle r="3.2" class="wh-axle"/>
    </g>
    <path d="M0 -50 l-3.4 -5 h6.8 z" class="wh-ptr"/>
  </svg>`;
}

export function init(root) {
  root.innerHTML = `
    <div class="ct"><span>Тяло и колела</span><span class="ct-r"><span class="chip" id="bFault">—</span><span class="chip" id="bState">—</span></span></div>
    <div class="wheels">
      <div class="wh">${dialSvg('whL')}<div class="wh-cap"><i>Л</i><b class="num" id="bWl">0°</b></div></div>
      <div class="spd">
        <div class="spd-v num"><b id="bV">0</b><u>mm/s</u></div>
        <div class="spd-k num" id="bKmh">0.00 km/h</div>
        <div class="spd-r num">зад. <span id="bVref">0</span></div>
      </div>
      <div class="wh">${dialSvg('whR')}<div class="wh-cap"><i>Д</i><b class="num" id="bWr">0°</b></div></div>
    </div>
    <div class="pit">
      <div class="pit-h"><span>Наклон на тялото</span>
        <span class="num"><b id="bPit">0.0°</b> <span class="dim">зададен <span id="bPref">0.0°</span></span></span></div>
      <svg viewBox="0 0 260 30" class="pit-svg" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="12" width="260" height="6" rx="3" class="pit-track"/>
        <path d="M130 6v18M65 9v12M195 9v12M0 10v10M260 10v10" class="pit-tick"/>
        <rect id="pitErr" x="130" y="12" width="0" height="6" class="pit-err"/>
        <path id="pitRef" d="M0 3 l5 -3 h-10 z M0 3 v24" class="pit-ref" transform="translate(130 0)"/>
        <path id="pitMk" d="M0 27 l-6 -9 h12 z" class="pit-mk" transform="translate(130 0)"/>
      </svg>
    </div>
    <div class="mtab num">
      <span></span><span class="h">Л</span><span class="h">Д</span>
      <span class="k">Напрежение</span><b id="mVl">—</b><b id="mVr">—</b>
      <span class="k">Ток</span><b id="mAl">—</b><b id="mAr">—</b>
      <span class="k">Мощност</span><b id="mWl">—</b><b id="mWr">—</b>
      <span class="k">Момент</span><b id="mNl">—</b><b id="mNr">—</b>
      <span class="k">Нагряване</span>
      <span class="heat"><i id="hL"></i></span><span class="heat"><i id="hR"></i></span>
    </div>
    <div class="loop">
      <div class="loop-h"><span>Цикъл на баланса</span><span class="num"><b id="lpV">—</b> µs <span class="dim">макс <span id="lpM">—</span></span></span></div>
      <div class="loop-bar"><i id="lpBar"></i><u id="lpMax"></u></div>
    </div>
    `;

  const $ = (s) => root.querySelector(s);
  const whL = $('#whL'), whR = $('#whR'), wl = $('#bWl'), wr = $('#bWr');
  const v = $('#bV'), kmh = $('#bKmh'), vref = $('#bVref');
  const st = $('#bState'), flt = $('#bFault');
  const pit = $('#bPit'), pref = $('#bPref'), pitErr = $('#pitErr'), pitRef = $('#pitRef'), pitMk = $('#pitMk');
  const m = {
    vl: $('#mVl'), vr: $('#mVr'), al: $('#mAl'), ar: $('#mAr'), wl: $('#mWl'), wr: $('#mWr'), nl: $('#mNl'), nr: $('#mNr'),
    hl: $('#hL'), hr: $('#hR'),
  };
  const lpV = $('#lpV'), lpM = $('#lpM'), lpBar = $('#lpBar'), lpMax = $('#lpMax');
  const card = root;

  return {
    update(ctx) {
      const b = ctx.state.body;
      setAttr(whL, 'transform', `rotate(${(b.wheel_l_deg % 360).toFixed(1)})`);
      setAttr(whR, 'transform', `rotate(${(b.wheel_r_deg % 360).toFixed(1)})`);

      // наклон: мащаб ±10° върху 260 единици
      const k = 13, pp = clamp(b.pitch, -10, 10), rr = clamp(b.pitch_ref, -10, 10);
      setAttr(pitMk, 'transform', `translate(${(130 + pp * k).toFixed(1)} 0)`);
      setAttr(pitRef, 'transform', `translate(${(130 + rr * k).toFixed(1)} 0)`);
      const x0 = Math.min(pp, rr) * k + 130, wd = Math.abs(pp - rr) * k;
      setAttr(pitErr, 'x', x0.toFixed(1)); setAttr(pitErr, 'width', wd.toFixed(1));

      setStyle(m.hl, 'transform', `scaleX(${clamp(b.heat_l, 0, 1).toFixed(3)})`);
      setStyle(m.hr, 'transform', `scaleX(${clamp(b.heat_r, 0, 1).toFixed(3)})`);
      setClass(m.hl, b.heat_l > 0.8 ? 'hot' : b.heat_l > 0.55 ? 'warm' : '');
      setClass(m.hr, b.heat_r > 0.8 ? 'hot' : b.heat_r > 0.55 ? 'warm' : '');

      if (!ctx.slow) return;
      setText(wl, Math.round(wrap360(b.wheel_l_deg)) + '°');
      setText(wr, Math.round(wrap360(b.wheel_r_deg)) + '°');
      setText(v, Math.round(b.speed) + '');
      setText(kmh, fmt(b.speed * 0.0036, 2) + ' km/h');
      setText(vref, Math.round(b.speed_ref) + '');
      setText(pit, fmt(b.pitch, 1, true) + '°');
      setText(pref, fmt(b.pitch_ref, 1, true) + '°');
      setText(m.vl, fmt(b.volt_l, 2) + ' V'); setText(m.vr, fmt(b.volt_r, 2) + ' V');
      setText(m.al, fmt(b.cur_l, 2) + ' A'); setText(m.ar, fmt(b.cur_r, 2) + ' A');
      setText(m.wl, fmt(b.volt_l * b.cur_l, 1) + ' W'); setText(m.wr, fmt(b.volt_r * b.cur_r, 1) + ' W');
      setText(m.nl, fmt(b.torque_l, 3) + ' N·m'); setText(m.nr, fmt(b.torque_r, 3) + ' N·m');

      const lp = b.loop_us, mx = b.loop_max_us;
      setText(lpV, fmt(lp, 0)); setText(lpM, fmt(mx, 0));
      setStyle(lpBar, 'width', clamp(lp / LOOP_BUDGET_US * 100, 0, 100).toFixed(1) + '%');
      setStyle(lpMax, 'left', clamp(mx / LOOP_BUDGET_US * 100, 0, 100).toFixed(1) + '%');
      setClass(lpBar, lp > LOOP_BUDGET_US * 0.8 ? 'warn' : '');

      const online = b.online;
      setText(st, online ? b.state : 'няма връзка');
      setClass(st, 'chip ' + (!online ? 'off' : (b.fault && b.fault !== '—' ? 'bad' : 'accent')));
      const fault = !!(b.fault && b.fault !== '—');
      setText(flt, fault ? 'грешка: ' + b.fault : 'без грешка');
      setClass(flt, 'chip ' + (fault ? 'bad' : 'off'));
      card.classList.toggle("stale", !online);
      flt.hidden = !online;
    },
  };
}
