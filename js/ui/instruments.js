// Уредите на главата в стил „стъклен кокпит“: хоризонт, курс, завой и плъзгане, сурови стойности.
// Целият SVG се рисува веднъж; всеки кадър се сменят само transform атрибути.
import { setText, setAttr, setStyle, fmt, clamp, wrap360, D2R } from './util.js';

const f1 = (n) => Math.round(n * 10) / 10;

// ───────────────────────────── Изкуствен хоризонт ─────────────────────────────
const AW = 276, AH = 188, ACX = 138, ACY = 108, AK = 3.3, AR = 88;   // AK — px на градус

function adiSvg() {
  let ladder = '';
  for (let p = -30; p <= 30; p += 2.5) {
    if (p === 0) continue;
    const a = Math.abs(p), y = f1(-p * AK);
    const len = a % 10 === 0 ? 58 : a % 5 === 0 ? 32 : 12;
    ladder += `<line x1="${-len / 2}" y1="${y}" x2="${len / 2}" y2="${y}"/>`;
    if (a % 10 === 0) {
      ladder += `<text x="${-len / 2 - 7}" y="${f1(y + 3.6)}" text-anchor="end">${a}</text>` +
                `<text x="${len / 2 + 7}" y="${f1(y + 3.6)}" text-anchor="start">${a}</text>`;
    }
  }
  // дъга за крена: ±60°, деления отвън
  const pt = (deg, r) => `${f1(ACX + r * Math.sin(deg * D2R))} ${f1(ACY - r * Math.cos(deg * D2R))}`;
  let ticks = '';
  for (const [d, l] of [[10, 6], [20, 6], [30, 11], [45, 6], [60, 11]]) {
    for (const s of [-1, 1]) ticks += `M${pt(s * d, AR)} L${pt(s * d, AR + l)} `;
  }
  const arc = `M${pt(-60, AR)} A${AR} ${AR} 0 0 1 ${pt(60, AR)}`;
  return `
  <svg viewBox="0 0 ${AW} ${AH}" class="inst-svg" role="img" aria-label="Изкуствен хоризонт">
    <defs>
      <clipPath id="adiClip"><rect width="${AW}" height="${AH}" rx="14"/></clipPath>
      <clipPath id="adiLadClip"><rect x="40" y="38" width="196" height="112"/></clipPath>
      <linearGradient id="adiSky" x1="0" y1="-1" x2="0" y2="0"><stop offset="0" stop-color="#0f3b74"/><stop offset="1" stop-color="#4f9fdd"/></linearGradient>
      <linearGradient id="adiGnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#94673a"/><stop offset="1" stop-color="#2b1d10"/></linearGradient>
    </defs>
    <g clip-path="url(#adiClip)">
      <g id="adiHor" transform="translate(${ACX} ${ACY})">
        <rect x="-420" y="-420" width="840" height="420" fill="url(#adiSky)"/>
        <rect x="-420" y="0" width="840" height="420" fill="url(#adiGnd)"/>
        <line x1="-420" y1="0" x2="420" y2="0" class="adi-hz"/>
      </g>
      <g clip-path="url(#adiLadClip)"><g id="adiLad" class="adi-lad" transform="translate(${ACX} ${ACY})">${ladder}</g></g>
      <g class="adi-scale">
        <path d="${arc}" class="adi-arc"/>
        <path d="${ticks}" class="adi-tick"/>
        <path d="M${ACX} ${f1(ACY - AR - 3)} l-6 -9 h12 z" class="adi-idx"/>
      </g>
      <g id="adiRoll"><path d="M${ACX} ${f1(ACY - AR + 2)} l-6.5 11 h13 z" class="adi-ptr"/></g>
      <g class="adi-ac">
        <path d="M66 ${ACY} H108 V${ACY + 10} M210 ${ACY} H168 V${ACY + 10}" class="ac-out"/>
        <path d="M66 ${ACY} H108 V${ACY + 10} M210 ${ACY} H168 V${ACY + 10}" class="ac-in"/>
        <rect x="${ACX - 5}" y="${ACY - 5}" width="10" height="10" rx="2" class="ac-dot"/>
      </g>
      <text x="12" y="${AH - 24}" class="adi-lbl">ТАНГАЖ</text><text x="12" y="${AH - 9}" class="adi-val" id="adiP">0.0°</text>
      <text x="${AW - 12}" y="${AH - 24}" class="adi-lbl" text-anchor="end">КРЕН</text><text x="${AW - 12}" y="${AH - 9}" class="adi-val" text-anchor="end" id="adiR">0.0°</text>
    </g>
    <rect width="${AW}" height="${AH}" rx="14" class="inst-frame"/>
  </svg>`;
}

// ───────────────────────────── Курс (HSI) ─────────────────────────────
const HW = 276, HH = 190, HCX = 138, HCY = 113, HR = 76;
function hsiSvg() {
  let minor = '', major = '', labels = '';
  for (let a = 0; a < 360; a += 5) {
    const l = a % 30 === 0 ? 11 : a % 10 === 0 ? 8 : 4.5;
    const x1 = f1(HCX + HR * Math.sin(a * D2R)), y1 = f1(HCY - HR * Math.cos(a * D2R));
    const x2 = f1(HCX + (HR - l) * Math.sin(a * D2R)), y2 = f1(HCY - (HR - l) * Math.cos(a * D2R));
    (a % 30 === 0 ? (major += `M${x1} ${y1}L${x2} ${y2}`) : (minor += `M${x1} ${y1}L${x2} ${y2}`));
  }
  const card = { 0: 'С', 90: 'И', 180: 'Ю', 270: 'З' };
  for (let a = 0; a < 360; a += 30) {
    const isC = card[a] !== undefined;
    labels += `<text transform="rotate(${a} ${HCX} ${HCY})" x="${HCX}" y="${HCY - HR + 28}" text-anchor="middle" class="${isC ? (a === 0 ? 'hsi-n' : 'hsi-c') : 'hsi-d'}">${isC ? card[a] : a / 10}</text>`;
  }
  return `
  <svg viewBox="0 0 ${HW} ${HH}" class="inst-svg" role="img" aria-label="Курс">
    <circle cx="${HCX}" cy="${HCY}" r="${HR + 1}" class="hsi-bg"/>
    <g id="hsiRose" transform="rotate(0 ${HCX} ${HCY})">
      <path d="${minor}" class="hsi-minor"/><path d="${major}" class="hsi-major"/>
      ${labels}
      <g id="hsiBody" transform="rotate(0 ${HCX} ${HCY})"><path d="M${HCX} ${HCY - HR - 1} l7 8.5 l-7 8.5 l-7 -8.5 z" class="hsi-bmark"/></g>
    </g>
    <path d="M${HCX} ${HCY} L${f1(HCX - 62 * Math.sin(22.5 * D2R))} ${f1(HCY - 62 * Math.cos(22.5 * D2R))} A62 62 0 0 1 ${f1(HCX + 62 * Math.sin(22.5 * D2R))} ${f1(HCY - 62 * Math.cos(22.5 * D2R))} Z" class="hsi-fov"/>
    <g id="hsiBot" transform="rotate(0 ${HCX} ${HCY})">
      <rect x="${HCX - 5}" y="${HCY - 17}" width="10" height="30" rx="3" class="hsi-body"/>
      <rect x="${HCX - 11}" y="${HCY - 9}" width="4" height="14" rx="1.5" class="hsi-wheel"/>
      <rect x="${HCX + 7}" y="${HCY - 9}" width="4" height="14" rx="1.5" class="hsi-wheel"/>
      <circle cx="${HCX}" cy="${HCY - 14}" r="3.2" class="hsi-head"/>
    </g>
    <path d="M${HCX} ${HCY - HR + 1} l-7 -11 h14 z" class="hsi-lub"/>
    <rect x="${HCX - 40}" y="1" width="80" height="22" rx="7" class="hsi-box"/>
    <text x="${HCX - 33}" y="16" class="hsi-lbl">КУРС</text>
    <text x="${HCX + 34}" y="17.5" text-anchor="end" class="hsi-hdg" id="hsiV">000°</text>
    <text x="10" y="${HH - 8}" class="adi-lbl">▲ тяло</text><text x="${HW - 10}" y="${HH - 8}" class="adi-lbl" text-anchor="end">▭ поле 8×8</text>
  </svg>`;
}

// ───────────────────────────── Завой и плъзгане ─────────────────────────────
const TW = 276, TH = 112, TCX = 138, TCY = 172, TR = 132, TSC = 38 / 90, TUBE_Y = 94;
function turnSvg() {
  const pt = (deg, r) => `${f1(TCX + r * Math.sin(deg * D2R))} ${f1(TCY - r * Math.cos(deg * D2R))}`;
  let ticks = '', labels = '';
  for (const v of [-90, -60, -30, 0, 30, 60, 90]) {
    const a = v * TSC, l = v === 0 || Math.abs(v) === 90 ? 11 : 6;
    ticks += `M${pt(a, TR)} L${pt(a, TR + l)} `;
  }
  const arc = `M${pt(-38, TR)} A${TR} ${TR} 0 0 1 ${pt(38, TR)}`;
  return `
  <svg viewBox="0 0 ${TW} ${TH}" class="inst-svg" role="img" aria-label="Завой и плъзгане">
    <text x="12" y="16" class="adi-lbl">ЗАВОЙ</text>
    <text x="${TW - 12}" y="16" class="adi-lbl" text-anchor="end">±90 °/s</text>
    <path d="${arc}" class="adi-arc"/>
    <path d="${ticks}" class="adi-tick"/>
    <text x="40" y="52" class="turn-lr" text-anchor="middle">Л</text><text x="${TW - 40}" y="52" class="turn-lr" text-anchor="middle">Д</text>
    <g id="turnPtr"><path d="M${TCX} ${TCY - TR + 2} l-6.5 11 h13 z" class="adi-ptr"/></g>
    <text x="${TCX}" y="74" text-anchor="middle" class="turn-val" id="turnV">0 °/s</text>
    <path d="M${TCX - 84} ${TUBE_Y + 8} Q${TCX} ${TUBE_Y - 8} ${TCX + 84} ${TUBE_Y + 8}" class="slip-tube"/>
    <path d="M${TCX - 84} ${TUBE_Y + 8} Q${TCX} ${TUBE_Y - 8} ${TCX + 84} ${TUBE_Y + 8}" class="slip-bore"/>
    <path d="M${TCX - 9} ${TUBE_Y - 8} v16 M${TCX + 9} ${TUBE_Y - 8} v16" class="slip-ref"/>
    <circle id="slipBall" cx="${TCX}" cy="${TUBE_Y}" r="6.6" class="slip-ball"/>
  </svg>`;
}

// ───────────────────────────── Сурови стойности ─────────────────────────────
const RAW = [
  { id: 'g', title: 'Жироскоп', unit: '°/s', max: 120, d: 1, get: (h) => h.gyro },
  { id: 'a', title: 'Ускорение', unit: 'g', max: 1.3, d: 2, get: (h) => h.acc },
  { id: 'm', title: 'Компас', unit: 'G', max: 0.5, d: 2, get: (h) => h.mag },
];
function rawHtml() {
  return RAW.map((r) => `
    <div class="raw-row">
      <div class="raw-h"><span>${r.title}</span><i>${r.unit}</i></div>
      ${['X', 'Y', 'Z'].map((ax, i) => `
        <div class="raw-c" data-r="${r.id}${i}">
          <span class="ax">${ax}</span><b>0.0</b>
          <span class="mb"><i class="n"></i><i class="p"></i></span>
        </div>`).join('')}
    </div>`).join('');
}

export function init(root) {
  root.innerHTML = `
    <div class="card inst c-adi"><div class="v-adi">${adiSvg()}</div></div>
    <div class="card inst c-hsi"><div class="v-hsi">${hsiSvg()}</div></div>
    <div class="card inst c-turn"><div class="v-turn">${turnSvg()}</div></div>
    <div class="card inst c-raw"><div class="raw">${rawHtml()}</div></div>`;

  const hor = root.querySelector('#adiHor'), lad = root.querySelector('#adiLad'), rollPtr = root.querySelector('#adiRoll');
  const adiP = root.querySelector('#adiP'), adiR = root.querySelector('#adiR');
  const rose = root.querySelector('#hsiRose'), bodyMk = root.querySelector('#hsiBody'), bot = root.querySelector('#hsiBot');
  const hsiV = root.querySelector('#hsiV');
  const turnPtr = root.querySelector('#turnPtr'), turnV = root.querySelector('#turnV'), ball = root.querySelector('#slipBall');
  const raw = RAW.map((r) => {
    const cells = [0, 1, 2].map((i) => {
      const c = root.querySelector(`[data-r="${r.id}${i}"]`);
      return { b: c.querySelector('b'), p: c.querySelector('.p'), n: c.querySelector('.n') };
    });
    return { def: r, cells };
  });

  return {
    update(ctx) {
      const s = ctx.state, h = s.head;
      // хоризонт: rotate(-крен) после преместване по тангаж; кръгът се върти около центъра
      const pitch = clamp(h.pitch, -45, 45), roll = h.roll;
      const ht = `translate(${ACX} ${ACY}) rotate(${f1(-roll)}) translate(0 ${f1(pitch * AK)})`;
      setAttr(hor, 'transform', ht); setAttr(lad, 'transform', ht);
      setAttr(rollPtr, 'transform', `rotate(${f1(clamp(roll, -62, 62))} ${ACX} ${ACY})`);

      // курс: розата се върти обратно, маркерът на тялото стои на курса на тялото, иконата — на −пан
      const hdg = wrap360(h.heading), pan = s.servos.pan.deg;
      setAttr(rose, 'transform', `rotate(${f1(-hdg)} ${HCX} ${HCY})`);
      setAttr(bodyMk, 'transform', `rotate(${f1(hdg - pan)} ${HCX} ${HCY})`);
      setAttr(bot, 'transform', `rotate(${f1(-pan)} ${HCX} ${HCY})`);

      // завой (дясно +): жироскопът Z е + наляво → завой надясно е −gz
      const turn = -h.gyro[2];
      setAttr(turnPtr, 'transform', `rotate(${f1(clamp(turn * TSC, -40, 40))} ${TCX} ${TCY})`);
      // плъзгане: ускорение Y (+ наляво) тегли топчето надясно
      const off = clamp(-h.acc[1] / 0.15 * 66, -66, 66);
      setAttr(ball, 'cx', String(f1(TCX + off)));
      setAttr(ball, 'cy', String(f1(TUBE_Y + 8 * (off / 84) * (off / 84))));

      // лентите
      for (let g = 0; g < raw.length; g++) {
        const v3 = raw[g].def.get(h), mx = raw[g].def.max;
        for (let i = 0; i < 3; i++) {
          const k = clamp(v3[i] / mx, -1, 1), c = raw[g].cells[i];
          setStyle(c.p, 'transform', `scaleX(${k > 0 ? f1(k * 100) / 100 : 0})`);
          setStyle(c.n, 'transform', `scaleX(${k < 0 ? f1(-k * 100) / 100 : 0})`);
        }
      }
      if (ctx.slow) {
        setText(adiP, fmt(h.pitch, 1, true) + '°');
        setText(adiR, fmt(h.roll, 1, true) + '°');
        setText(hsiV, String(Math.round(hdg) % 360).padStart(3, '0') + '°');
        setText(turnV, (turn > 0.5 ? 'Д ' : turn < -0.5 ? 'Л ' : '') + Math.abs(turn).toFixed(0) + ' °/s');
        for (let g = 0; g < raw.length; g++) {
          const v3 = raw[g].def.get(h), d = raw[g].def.d;
          for (let i = 0; i < 3; i++) setText(raw[g].cells[i].b, fmt(v3[i], d, true));
        }
      }
    },
  };
}
