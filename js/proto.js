// Двоичната рамка на P4 (firmware/p4-head/main/monitor.c, описанието е в docs/08-monitor/01_POTOK.md) → state.
// Всичко е little-endian, без подравняване.
import { state, hist } from './state.js';

const STATES = ['BOOT', 'IDLE', 'BALANCING', 'PARKED', 'STANDING_UP', 'FALLEN', 'LOW_BATTERY', 'SHUTDOWN', 'OTA', 'CALIBRATING'];
const STATE_BG = {
  BOOT: 'тръгва', IDLE: 'стои', BALANCING: 'балансира', PARKED: 'паркиран', STANDING_UP: 'изправя се',
  FALLEN: 'паднал', LOW_BATTERY: 'слаба батерия', SHUTDOWN: 'изключва се', OTA: 'нов фърмуер', CALIBRATING: 'калибрира',
};
const FAULTS = ['няма', 'IMU', 'енкодер', 'няма команда', 'слаба батерия', 'паднал', 'прегряване', 'побягнал',
  'запънат', 'горещ мотор', 'голям ток', 'не е калибриран', 'няма батерия', 'числа (NaN)', 'цикълът закъснява'];
const SERVO_MODES = ['off', 'on', 'cent', 'park'];

// Параметрите на тялото (по подразбиране от bc_params.h; /api/params ги дава точно)
export const bodyParams = { wheel_diam_mm: 80, enc_cpr: 2800, motor_kt: 0.37, track_mm: 160 };

let lastSeq = -1;
let lastT = 0;
let rxCount = 0, rxT0 = performance.now();
const servoPrev = [{ deg: 0, t: 0 }, { deg: 0, t: 0 }];

// Батерия 3S: процент по напрежението на клетка (същата крива като chestoti.c)
const LIPO = [3.27, 3.61, 3.69, 3.71, 3.73, 3.75, 3.77, 3.79, 3.80, 3.82, 3.84, 3.85, 3.87, 3.91, 3.95, 3.98, 4.02, 4.08, 4.11, 4.15, 4.20];
export function lipoPct(vCell) {
  if (vCell <= LIPO[0]) return 0;
  for (let i = 1; i < LIPO.length; i++) {
    if (vCell <= LIPO[i]) return Math.round(5 * (i - 1) + 5 * (vCell - LIPO[i - 1]) / (LIPO[i] - LIPO[i - 1]));
  }
  return 100;
}

function body2(dv, o, tSec) {
  const b = state.body;
  b.online = true;
  b.pitch = dv.getInt16(o + 6, true) / 100;
  b.pitch_rate = dv.getInt16(o + 8, true) / 10;
  b.pitch_ref = dv.getInt16(o + 10, true) / 100;
  b.roll = dv.getInt16(o + 12, true) / 100;
  b.speed = dv.getInt16(o + 14, true);
  b.speed_ref = dv.getInt16(o + 16, true);
  b.yaw_rate = dv.getInt16(o + 18, true) / 1000 * 180 / Math.PI;
  b.pos_mm = dv.getInt32(o + 22, true);
  b.volt_l = dv.getInt16(o + 26, true) / 1000;
  b.volt_r = dv.getInt16(o + 28, true) / 1000;
  b.volt_limit = dv.getUint16(o + 30, true) / 1000;
  const vbat = dv.getUint16(o + 32, true) / 1000;
  b.cur_l = dv.getInt16(o + 34, true) / 1000;
  b.cur_r = dv.getInt16(o + 36, true) / 1000;
  const curTot = dv.getUint16(o + 38, true);
  b.heat_l = dv.getUint8(o + 40) / 255;
  b.heat_r = dv.getUint8(o + 41) / 255;
  b.risk = dv.getUint8(o + 42) / 255;
  const st = STATES[dv.getUint8(o + 43)] || '?';
  b.state = STATE_BG[st] || st;
  b.fault = FAULTS[dv.getUint8(o + 44)] || '?';
  b.controller = dv.getUint8(o + 46);
  b.flags = dv.getUint16(o + 48, true);
  b.loop_us = dv.getUint16(o + 50, true);
  b.loop_max_us = dv.getUint16(o + 52, true);
  b.torque_l = b.cur_l * bodyParams.motor_kt;
  b.torque_r = b.cur_r * bodyParams.motor_kt;

  const bat = state.battery;
  if (vbat > 1) {
    bat.v = vbat;
    bat.pct = lipoPct(vbat / 3);
    bat.low = (b.flags & 0x2000) !== 0;
    if (curTot !== 0xFFFF) { bat.a = curTot / 1000; bat.w = bat.v * bat.a; }
  } else {
    bat.v = null; bat.pct = null;
  }

  hist.pitch.push(tSec, b.pitch); hist.pitch_ref.push(tSec, b.pitch_ref);
  hist.speed.push(tSec, b.speed); hist.speed_ref.push(tSec, b.speed_ref);
  hist.cur_l.push(tSec, b.cur_l); hist.cur_r.push(tSec, b.cur_r);
  hist.volt_l.push(tSec, b.volt_l); hist.volt_r.push(tSec, b.volt_r);
}

export function decode(buf) {
  const dv = new DataView(buf);
  if (dv.byteLength < 16 || dv.getUint8(0) !== 0x4D || dv.getUint8(1) !== 1) return false;
  const seq = dv.getUint16(2, true);
  if (lastSeq >= 0) {
    const gap = (seq - lastSeq - 1) & 0xFFFF;
    if (gap > 0 && gap < 1000) state.link.lost += gap;
  }
  lastSeq = seq;
  state.link.dropped = dv.getUint32(4, true);
  const tUs = Number(dv.getBigUint64(8, true));
  const t = tUs / 1e6;
  state.t = t;
  rxCount++;
  const now = performance.now();
  if (now - rxT0 >= 1000) { state.link.rx_hz = rxCount * 1000 / (now - rxT0); rxCount = 0; rxT0 = now; }

  let o = 16;
  while (o + 4 <= dv.byteLength) {
    const id = dv.getUint8(o), count = dv.getUint8(o + 1), len = dv.getUint16(o + 2, true);
    const p = o + 4;
    if (p + len > dv.byteLength) break;
    switch (id) {
      case 1: { // глава
        const h = state.head;
        h.pitch = dv.getInt16(p, true) / 100;
        h.roll = dv.getInt16(p + 2, true) / 100;
        h.heading = dv.getUint16(p + 4, true) / 100;
        for (let i = 0; i < 3; i++) {
          h.gyro[i] = dv.getInt16(p + 6 + 2 * i, true) / 10;
          h.acc[i] = dv.getInt16(p + 12 + 2 * i, true) / 1000;
          h.mag[i] = dv.getInt16(p + 18 + 2 * i, true) / 1000;
        }
        const f = dv.getUint8(p + 24);
        h.ok = (f & 1) !== 0; h.mag_ok = (f & 2) !== 0;
        hist.head_pitch.push(t, h.pitch); hist.head_roll.push(t, h.roll);
        hist.gyro_x.push(t, h.gyro[0]); hist.gyro_y.push(t, h.gyro[1]); hist.gyro_z.push(t, h.gyro[2]);
        hist.acc_x.push(t, h.acc[0]); hist.acc_y.push(t, h.acc[1]); hist.acc_z.push(t, h.acc[2]);
        break;
      }
      case 2: { // серва: общото (8 байта), после по 10 на серво
        const s = state.servos;
        s.mode = SERVO_MODES[dv.getUint8(p)] || 'off';
        s.on = (dv.getUint8(p + 1) & 1) !== 0;
        s.cap_deg = dv.getInt16(p + 2, true) / 100;
        const ma = dv.getInt16(p + 4, true);
        s.current_a = ma < 0 ? null : ma / 1000;
        for (let i = 0; i < count && i < 2; i++) {
          const q = p + 8 + 10 * i, sv = i === 0 ? s.pan : s.tilt;
          sv.deg = dv.getInt16(q, true) / 100;
          sv.target = dv.getInt16(q + 2, true) / 100;
          sv.us = dv.getUint16(q + 4, true);
          sv.cut = (dv.getUint8(q + 8) & 1) !== 0;
          const pr = servoPrev[i];
          if (pr.t && t > pr.t) sv.speed_dps = sv.speed_dps * 0.6 + 0.4 * (sv.deg - pr.deg) / (t - pr.t);
          pr.deg = sv.deg; pr.t = t;
        }
        break;
      }
      case 3: { // 8×8
        const tf = state.tof;
        tf.frame = dv.getUint32(p, true);
        tf.ok = dv.getUint8(p + 5) !== 0;
        tf.hz = dv.getUint16(p + 6, true) / 10;
        for (let i = 0; i < 64; i++) {
          const mm = dv.getInt16(p + 8 + 2 * i, true);
          const st = dv.getUint8(p + 136 + i);
          const ok = mm > 0 && (st === 5 || st === 9);
          tf.mm[i] = ok ? mm : -1;
          tf.valid[i] = ok ? 1 : 0;
        }
        break;
      }
      case 4: // тялото, STATE2 по 60 байта
        for (let i = 0; i < count; i++) {
          const q = p + 60 * i;
          const tMs = dv.getUint32(q + 2, true);
          body2(dv, q, tMs / 1000);
        }
        break;
      case 5: { // старото STATE: енкодерите
        const b = state.body;
        b.enc_l = dv.getInt32(p + 8, true);
        b.enc_r = dv.getInt32(p + 12, true);
        b.wheel_l_deg = b.enc_l * 360 / bodyParams.enc_cpr;
        b.wheel_r_deg = b.enc_r * 360 / bodyParams.enc_cpr;
        break;
      }
      case 6: { // токове на главата
        const tot = dv.getInt16(p, true);
        state.head_current_a = tot < 0 ? null : tot / 1000;
        break;
      }
      case 7: { // звук
        const now = dv.getInt8(p);
        const s = state.sound;
        s.playing = now >= 0;
        s.volume = dv.getUint8(p + 1);
        let name = '';
        for (let i = 0; i < 12; i++) { const c = dv.getUint8(p + 4 + i); if (!c) break; name += String.fromCharCode(c); }
        s.name = name;
        break;
      }
      case 8: { // камера
        const c = state.camera;
        c.w = dv.getUint16(p, true); c.h = dv.getUint16(p + 2, true);
        c.hz = dv.getUint16(p + 4, true) / 10;
        c.ok = dv.getUint8(p + 8) !== 0;
        break;
      }
      case 9: { // отзад
        state.rear.ok = dv.getUint8(p) !== 0;
        const mm = dv.getInt16(p + 2, true);
        state.rear.mm = mm > 0 ? mm : null;
        break;
      }
      case 10: { // честотите, JSON
        try {
          const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, p, len)));
          state.rates = j.r || [];
          state.p4 = j;
        } catch (e) { /* отрязан: следващата секунда */ }
        break;
      }
    }
    o = p + len;
  }
  if (state.battery.v != null && Math.floor(t) !== Math.floor(lastT)) {   // веднъж в секунда: 10 минути история
    hist.bat_v.push(t, state.battery.v);
    if (state.battery.w != null) hist.bat_w.push(t, state.battery.w);
  }
  lastT = t;
  return true;
}
