// Демо за приложните раздели: измислена телеметрия „st“ (като build_status_json на P4) и измислени отговори на /api/*.
// Всичко е правдоподобно за вид, без робот. Не се ползва на живо.
import { hist, state } from '../state.js';
import { COLS } from './logcols.js';

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// Телеметрията „st“ от измисленото състояние на монитора (state.js)
export function makeSt(s, tick) {
  const b = s.body, hd = s.head, sv = s.servos, bt = s.battery;
  const rows = [];
  // последните ~10 реда на 100 Hz за графиките (10 Hz × 10 реда)
  const take = (ring) => { const [t, v] = ring.arrays(); return [t, v]; };
  const [tp, vp] = take(hist.pitch), [, vpr] = take(hist.pitch_ref), [, vs] = take(hist.speed), [, vsr] = take(hist.speed_ref);
  const [, vl] = take(hist.volt_l), [, vr] = take(hist.volt_r);
  const nRows = tick === 0 ? 1000 : 10;          // первият път 10 s история, после по 10 реда на 100 ms
  for (let k = Math.max(0, tp.length - nRows); k < tp.length; k++) {
    rows.push([Math.round(tp[k] * 1000), r2(vp[k]), r2(vpr[k]), Math.round(vs[k]), Math.round(vsr[k]), r2(vl[k]), r2(vr[k]), r2(b.volt_limit), r2(b.risk)]);
  }
  const mm = [];
  for (let i = 0; i < 64; i++) mm.push(s.tof.mm[i]);
  return {
    t: 'st', up: Math.round(s.t), demo: true,
    b: {
      on: true, v2: true, age: 8, st: 'BALANCING', fault: 'none',
      p: r2(b.pitch), pr: r2(b.pitch_ref), r: r1(b.pitch_rate), roll: r2(b.roll),
      v: Math.round(b.speed), vr: Math.round(b.speed_ref), w: Math.round(b.yaw_rate * Math.PI / 180 * 1000), wr: 0,
      x: Math.round(b.pos_mm), vb: r2(bt.v || 0), ul: r2(b.volt_l), ur: r2(b.volt_r), ulim: r2(b.volt_limit),
      il: r2(b.cur_l), ir: r2(b.cur_r), it: r2((bt.a || 0)), hl: r2(b.heat_l), hr: r2(b.heat_r), risk: r2(b.risk),
      prof: 1, ctrl: 1, lost: 0, fl: tick % 50 < 3 ? 0x0001 : 0, loop: Math.round(b.loop_us), loopmax: Math.round(b.loop_max_us),
      i2c: 410, trim: 0.35, logfill: 0.12,
    },
    h: {
      imu: true, p: r1(hd.pitch), roll: r1(hd.roll), hd: r1(hd.heading), pan: r1(sv.pan.deg), tilt: r1(sv.tilt.deg), srv: true,
      cut: [false, false], sm: 'on', cal: true, capset: 7.5, cap: [7.5, 7.5], us: [Math.round(sv.pan.us), Math.round(sv.tilt.us)],
      wd: 0, gr: true, rear: true,
    },
    c: { ok: true, w: 1280, h: 960, fps: 29.8, net: 24.1, q: 60, kb: 62, rz: '1280x960', z: 1, bb: 'auto', gr: 1.52, gb: 1.18 },
    cur: r2((bt.a || 0)), isv: r2(sv.current_a || 0), base: 0.42, imot: 0.8,
    g: { fix: false, sats: 0, lat: 0, lon: 0, spd: 0, n: 0, time: '' },
    d: { v: 0, w: 0, prof: 1, fresh: true },
    log: { on: false, f: 'ram', n: 0, lost: 0, drop: 0, ms: 0, s: 0, sd: false },
    sd: true,
    ota: { act: false, st: 0, sent: 0, tot: 0, rt: 0, msg: '' }, oh: { act: false, w: 0 },
    tof: { ok: true, n: s.tof.frame, mm }, pl: rows,
  };
}

// ── параметри на тялото (измислени, правдоподобни; на живо идват от /api/params) ──
const GROUPS = ['Общи', 'Оси и калибровка', 'Механика', 'Мотори', 'Оценка на наклона', 'Стар регулатор', 'Pid2', 'Умен регулатор', 'Място', 'Завой',
  'Профил спокоен', 'Профил нормален', 'Профил пъргав', 'Риск', 'Безопасност', 'Глава', 'Запис и връзка'];
const P = (id, n, u, h, g, f, v, min, max, def) => ({ id, n, u, h, g, f, v, min, max, def });
const PARAMS = [
  P(1, 'wheel_diam_mm', 'mm', 'Диаметър на колелото.', 2, 0x04, 80, 40, 200, 80),
  P(2, 'track_mm', 'mm', 'Разстояние между колелата.', 2, 0x04, 160, 80, 400, 160),
  P(3, 'enc_cpr', 'imp', 'Импулси на енкодера на оборот колело.', 2, 0x04, 2800, 100, 20000, 2800),
  P(4, 'motor_kt', 'N·m/A', 'Въртящ момент на ампер.', 3, 0x01, 0.37, 0.05, 2, 0.37),
  P(5, 'trim_deg', '°', 'Механичният център: резултат от калибровката.', 1, 0x08 | 0x01, 0.35, -10, 10, 0),
  P(6, 'axis_fwd', '', 'Коя ос на IMU гледа напред (знакът е посоката).', 1, 0x08 | 0x02, 1, -3, 3, 1),
  P(7, 'tau_pitch', 's', 'Колко бавно оценката на наклона вярва на акселерометъра.', 4, 0x01, 1.2, 0.1, 10, 1.2),
  P(8, 'k_pitch', '', 'Усилване по наклона (умен регулатор).', 7, 0x01, 38.5, 0, 200, 38.5),
  P(9, 'k_rate', '', 'Усилване по ъгловата скорост.', 7, 0x01, 4.2, 0, 50, 4.2),
  P(10, 'k_speed', '', 'Усилване по скоростта.', 7, 0x01, 0.012, 0, 1, 0.012),
  P(11, 'k_pos', '', 'Усилване по мястото.', 8, 0x01, 0.0005, 0, 0.1, 0.0005),
  P(12, 'turn_gain', '', 'Колко силно следва завоя.', 9, 0x01, 1.1, 0, 10, 1.1),
  P(13, 'calm_vmax', 'mm/s', 'Таван на скоростта, профил спокоен.', 10, 0x01, 150, 0, 1000, 150),
  P(14, 'normal_vmax', 'mm/s', 'Таван на скоростта, профил нормален.', 11, 0x01, 300, 0, 1000, 300),
  P(15, 'agile_vmax', 'mm/s', 'Таван на скоростта, профил пъргав.', 12, 0x01, 500, 0, 1000, 500),
  P(16, 'fall_deg', '°', 'Над този наклон роботът е паднал.', 14, 0x01, 35, 10, 80, 35),
  P(17, 'log_bufsize', '', 'Размер на буфера за запис (само за четене).', 16, 0x10, 4096, 0, 65535, 4096),
];

// ── записите ──
const LOGS = { sd: true, sdTotal: 31 * 1048576 * 1024, sdFree: 29.4 * 1048576 * 1024, files: [
  { f: 'ram', size: 64 + 4800 * 64, n: 4800 }, { f: '0007.bin', size: 64 + 41200 * 64, n: 41200 }, { f: '0006.bin', size: 64 + 8000 * 64, n: 8000 } ] };

const SYS = () => ({
  p4: { ver: 'p4-head 0.9.3 (демо)', date: 'Oct 31 2026', time: '12:00:00', part: 'ota_0', pending: false, idf: 'v5.5.5', heap: 212000, psram: 28 * 1048576, up: 3725 },
  body: { hello: true, fw: 'xiao-body 0.9.1 (демо)', proto: 2, params: PARAMS.length, on: true },
  wifi: 'вкъщи (−52 dBm)', clients: 2,
  link: { ok: 91234, bad: 0, tx: 40122, s2: 90210, s2lost: 3, dlost: 0, s1: 0, hello: 1, logf: 0, reboots: 0 },
  sd: { ok: true, name: 'SD 32G', free: 29.4 * 1048576 * 1024, total: 31 * 1048576 * 1024 },
  guard: { imu: true, tof: true, rear: true, cuts: 0, wdcuts: 0, cal: true, cap: 7.5, ready: true, why: '', thr: 0.5, tmin: 0.3, tmax: 0.7 },
  events: ['12:01:07 Тялото: xiao-body 0.9.1 (демо)', '12:01:05 Сервата са центрирани', '12:00:59 P4 стартира'],
});

// Частите вкл/изкл (командата vkl на P4): в демото се помнят до презареждане
const DEMO_CHASTI = [
  { id: 'kam', ime: 'Камера', on: 1, e: 1 }, { id: 'tof', ime: '8×8 отпред', on: 1, e: 1 }, { id: 'zad', ime: 'Отзад', on: 1, e: 1 },
  { id: 'ochi', ime: 'Очи', on: 1, e: 1 }, { id: 'zvuk', ime: 'Звук', on: 1, e: 1 }, { id: 'servo', ime: 'Серва', on: 1, e: 1 },
];

// Числата на очите (oci p json на P4, фърмуер 4c3eb77 и 5a2ad2a): име, по подразбиране, от, до. В демото се помнят до презареждане.
const DEMO_OCHI = [
  ['kadri', 60, 10, 70], ['skok_tau', 0.035, 0.005, 0.5], ['sled_tau', 0.04, 0.005, 1], ['ogled_tau', 0.15, 0.01, 2],
  ['vrashta_tau', 0.45, 0.05, 3], ['vrashta_s', 3, 0, 20], ['migane_ot', 2, 0.5, 30], ['migane_do', 6, 0.5, 60],
  ['migane_s', 0.17, 0.05, 1], ['migane_dvoyno', 0.15, 0, 1], ['ogled_ot', 0.7, 0.2, 30], ['ogled_do', 3.3, 0.2, 60],
  ['ogled_golyam', 0.25, 0, 1], ['spi_sled_s', 90, 5, 3600], ['nos_m', 0.018, 0, 0.1], ['zenica', 0.38, 0.15, 0.75],
  ['zenica_cel', 0.46, 0.15, 0.75], ['zenica_ot_m', 0.35, 0.05, 1], ['zenica_do_m', 0.08, 0.02, 0.5], ['zenica_blizo', 0.14, 0, 0.4],
  ['mirno', 0.05, 0, 0.3], ['blizo_ot_m', 0.25, 0.03, 0.5], ['blizo_do_m', 0.07, 0.02, 0.4], ['blizo_gore_dolu', 0.3, 0, 1],
  ['trepet', 1, 0, 5], ['cel_zadarzh_ms', 500, 0, 5000], ['tof_do_mm', 500, 100, 4000], ['tof_lenta_mm', 70, 10, 500],
  ['tof_fon_mm', 80, 10, 1000], ['kam_prag', 22, 5, 100], ['kam_chast', 0.33, 0.05, 1], ['kam_uspok_ms', 450, 0, 2000],
  ['kam_pati_ochi', 3, 1, 30], ['kam_pati_glava', 10, 1, 100], ['glava_sled_s', 0.12, 0, 3], ['glava_mrtva', 3, 0, 30],
  ['glava_spri', 0.7, 0.1, 10], ['glava_tau', 0.12, 0.02, 2], ['glava_dom_s', 2, 0, 30], ['glava_dom_tau', 1.5, 0.1, 10],
  ['naklon', 30, 0, 45], ['zakasn_8x8', 5, 0, 7], ['zakasn_4x4', 2, 0, 7], ['predv_max_s', 0.2, 0, 1], ['izmer_dyal', 0.7, 0.05, 1],
  ['iris', 58, 30, 70], ['zenica_dalb', 12, 0, 30], ['zenica_sianie', 0.75, 0, 1.5], ['zenica_stena', 1, 0, 3], ['podsvetka', 0, 0, 1.5],
  ['zenica_stesn', 3.5, 0, 14], ['zenica_prasteni', 0, 0, 8], ['prasteni_sila', 0.6, 0, 1],     // P4 5a2ad2a
].map(([n, d, lo, hi]) => ({ n, v: d, d, lo, hi, o: '' }));
const DEMO_VIDOVE = ['ochi-v1', 'картинката, без движение', 'картинката, слаби вълни', 'картинката, слаби вълни и малко искри'];
let demoVid = 2;
const g3 = (v) => String(+(+v).toPrecision(3));

// „oci p …“ и „oci vid …“: същите отговори като на P4
function demoOchi(line) {
  const a = line.trim().split(/\s+/).slice(1);
  if (a[0] === 'vid') {
    if (a[1] !== undefined) { const n = +a[1]; if (!(n >= 0 && n < DEMO_VIDOVE.length)) return 'oci vid 0..3\n'; demoVid = n; }
    return DEMO_VIDOVE.map((ime, i) => (i === demoVid ? '->' : '  ') + ' ' + i + ' ' + ime).join('\n') + '\n';
  }
  if (a[0] !== 'p') return null;
  if (a[1] === 'json') return JSON.stringify({ p: DEMO_OCHI, vid: demoVid, vidove: DEMO_VIDOVE }) + '\n';
  if (a[1] === 'umolch') { for (const p of DEMO_OCHI) p.v = p.d; return 'всички числа на очите са по подразбиране\n'; }
  const p = DEMO_OCHI.find((x) => x.n === a[1]);
  if (!p) return 'няма такова число; oci p дава списъка\n';
  if (a[2] === 'umolch') p.v = p.d;
  else if (a[2] !== undefined) {
    const f = parseFloat(a[2]);
    if (!isFinite(f) || f < p.lo || f > p.hi) return p.n + ': между ' + g3(p.lo) + ' и ' + g3(p.hi) + '\n';
    p.v = f;
  }
  return p.n + ' = ' + g3(p.v) + ' (записано)\n';
}

export function fixture(path, post, body) {
  const p = path.split('?')[0];
  if (p === '/api/params') return Promise.resolve({ total: PARAMS.length, got: PARAMS.length, v2: true, groups: GROUPS, p: PARAMS });
  if (p === '/api/logs') return Promise.resolve(LOGS);
  if (p === '/api/sys') return Promise.resolve(SYS());
  if (p === '/api/konzola') {
    const line = String(body || '');
    const nv = /^nrav(?:\s+(\w+)(?:\s+(\d+))?)?\s*$/.exec(line.trim());
    if (nv) {
      if (nv[1] === 'sam') { state.nrav.sam = true; state.nrav.ostava_s = 0; }
      else if (nv[1]) { state.nrav.ime = nv[1]; state.nrav.sam = false; state.nrav.ostava_s = 60 * (+nv[2] || 15); }
      return Promise.resolve(JSON.stringify({ nrav: state.nrav.ime, sam: state.nrav.sam ? 1 : 0, ostava_s: state.nrav.ostava_s }) + '\n');
    }
    const v = /^vkl(?:\s+(\w+)\s+(on|off))?\s*$/.exec(line.trim());
    if (v) {
      const c = DEMO_CHASTI.find((x) => x.id === v[1]);
      if (c) {
        c.on = v[2] === 'on' ? 1 : 0; state.izk[c.id] = !c.on;
        if (c.id === 'servo') { state.servos.on = !!c.on; state.servos.mode = c.on ? 'on' : 'off'; }    // сервата: от телеметрията
      }
      return Promise.resolve(JSON.stringify({ c: DEMO_CHASTI }) + '\n');
    }
    const oci = /^oci\s+(p|vid)\b/.test(line.trim()) ? demoOchi(line) : null;
    if (oci !== null) return new Promise((r) => setTimeout(() => r(oci), 60));     // като по Wi-Fi: една заявка трае
    if (/^oci\b/.test(line)) return Promise.resolve('очите включени\nглавата следи: не\nнастройки: inv не\n');
    return Promise.resolve('Демо: няма робот\n');
  }
  return Promise.resolve({ ok: false, err: 'Демо: няма робот' });
}

// ── измислен запис на 400 Hz (около 12 s): люлеене на 1 Hz и трептене на 14 Hz, което расте ──
export function demoTable(n = 4800) {
  const cols = {};
  for (const c of COLS) cols[c] = c === 't_ms' ? new Float64Array(n) : new Float32Array(n);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let pos = 0, bias = 0.04;
  for (let i = 0; i < n; i++) {
    const t = i / 400;
    const trem = 0.15 + 1.1 * Math.max(0, (t - 5) / 7);                 // трептенето расте след 5-ата секунда
    const sway = 1.1 * Math.sin(2 * Math.PI * 0.7 * t) + 0.5 * Math.sin(2 * Math.PI * 0.23 * t + 1);
    const pitch = sway + trem * Math.sin(2 * Math.PI * 14 * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t));
    const pitchRef = 0.35 + 0.4 * Math.sin(2 * Math.PI * 0.11 * t);
    const rate = 2 * Math.PI * 0.7 * 1.1 * Math.cos(2 * Math.PI * 0.7 * t) * 0.9 + trem * 2 * Math.PI * 14 * Math.cos(2 * Math.PI * 14 * t);
    const err = pitchRef - pitch;
    const u = Math.max(-9, Math.min(9, -3.2 * err + 0.11 * -rate));
    const lim = 9;
    const spd = 120 * Math.sin(2 * Math.PI * 0.18 * t) + 4 * Math.sin(2 * Math.PI * 14 * t);
    pos += spd / 400;
    const dt = 2500 + Math.round((rnd() - 0.5) * 60) + (rnd() < 0.004 ? 900 : 0);
    cols.t_ms[i] = 1000 + i * 2.5;
    cols.dt_us[i] = dt; cols.i2c_us[i] = 380 + Math.round(rnd() * 70);
    cols.pitch_deg[i] = pitch; cols.pitch_dps[i] = rate; cols.pitch_ref_deg[i] = pitchRef; cols.pitch_acc_deg[i] = pitch + (rnd() - 0.5) * 1.6;
    cols.pos_mm[i] = pos; cols.pos_ref_mm[i] = pos - 6 * Math.sin(2 * Math.PI * 0.18 * t);
    cols.speed_mm_s[i] = spd; cols.speed_ref_mm_s[i] = 120 * Math.sin(2 * Math.PI * 0.18 * t); cols.speed_cmd_mm_s[i] = 0;
    cols.yaw_rate_dps[i] = 3 * Math.sin(2 * Math.PI * 0.3 * t); cols.yaw_ref_dps[i] = 0;
    cols.u_bal_v[i] = u; cols.u_turn_v[i] = 0.2 * Math.sin(2 * Math.PI * 0.3 * t);
    cols.volt_left_v[i] = Math.max(-lim, Math.min(lim, u - cols.u_turn_v[i])); cols.volt_right_v[i] = Math.max(-lim, Math.min(lim, u + cols.u_turn_v[i]));
    cols.volt_limit_v[i] = lim; cols.vbat_v[i] = 11.7 - 0.02 * t; cols.cur_total_a[i] = 0.9 + 0.5 * Math.abs(u) / 9;
    cols.omega_left_rad_s[i] = spd / 40 + rate * 0.02; cols.omega_right_rad_s[i] = spd / 40 - rate * 0.02;
    cols.risk[i] = Math.min(1, Math.abs(pitch) / 14);
    cols.state[i] = 2; cols.fault[i] = 0; cols.controller[i] = 1;
    bias += (rnd() - 0.5) * 0.0004; cols.gyro_bias_dps[i] = bias; cols.trim_deg[i] = 0.35;
    cols.flags[i] = 0x4000 | (Math.abs(u) > 8.5 ? 1 : 0) | 0x1000; cols.seq[i] = i & 0xffff;
  }
  return { n, cols, header: COLS.slice(), partial: false };
}
