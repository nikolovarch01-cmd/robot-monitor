// Измислени данни за екрана: пълни state и hist на 100 Hz, докато няма истинска връзка.
// Без алокации в стъпката (освен веднъж в секунда за списъка с честотите).
import { state, hist } from './state.js';

const DT = 0.01;                 // стъпка 100 Hz
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const TAU = Math.PI * 2;
const WHEEL_MM_PER_REV = Math.PI * 80;   // колело 80 mm
const DEG_PER_MM = 360 / WHEEL_MM_PER_REV;
const TRACK_MM = 170;            // междуосие

// Повторяем генератор (mulberry32): снимките и опитите са едни и същи всеки път.
let seed = 20261031;
function rand() {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sin = Math.sin, cos = Math.cos, abs = Math.abs, exp = Math.exp;

const m = {
  T: 0,
  speedTarget: 0, speedRef: 0, speed: 0, nextSpeed: 1.5,
  pushAmp: 0, pushT0: -100, nextPush: 4,
  pitch: 0, pitchPrev: 0, pitchRate: 0, pitchRef: 0, roll: 0,
  yawRate: 0, bodyHeading: 40,
  pos: 0, wl: 0, wr: 0,
  heatL: 0.12, heatR: 0.12,
  loopMax: 2000,
  pan: 0, tilt: 0, panPrev: 0, tiltPrev: 0, panSpd: 0, tiltSpd: 0,
  headPitchPrev: 0, headRollPrev: 0, headPitch: 0, headRoll: 0,
  speedPrev: 0, accX: 0,
  tofAcc: 0, rate1s: 0, batAcc: 0,
  v0: 11.8, bat: 11.8,
  rates: 0,
};

const SPEEDS = [0, 180, 320, -150, 420, 90, -260, 240];
const SOUNDS = ['Здравей', 'Бип', 'Мелодия 2', 'Търся те'];

export function startDemo() {
  const q = new URLSearchParams(location.search);
  const bat = parseFloat(q.get('bat'));      // ?bat=15 — начален процент на батерията (за опити)
  if (isFinite(bat)) m.v0 = 9.0 + 3.6 * clamp(bat, 0, 100) / 100;
  m.bat = m.v0;

  state.link.mode = 'demo';
  state.link.connected = true;
  state.head.ok = true; state.head.mag_ok = true;
  state.servos.on = true; state.servos.mode = 'on'; state.servos.cap_deg = 90;
  state.tof.ok = true; state.tof.fov_deg = 45;
  state.rear.ok = true;
  state.body.online = true; state.body.state = 'БАЛАНС'; state.body.fault = '—'; state.body.controller = 1;
  state.body.volt_limit = 9.0;
  state.camera.ok = false; state.camera.w = 640; state.camera.h = 480; state.camera.hz = 0; state.camera.url = null;

  // Предварително пълним историята (15 s), за да има какво да се види още при зареждане.
  for (let i = 0; i < 1500; i++) step();

  let last = performance.now(), acc = 0;
  setInterval(() => {
    const now = performance.now();
    acc += Math.min(now - last, 25000);       // след фон на раздела наваксваме до 25 s
    last = now;
    let n = 0;
    while (acc >= 10 && n < 2600) { step(); acc -= 10; n++; }
    if (n === 2600) acc = 0;
  }, 10);
}

function step() {
  const t = (m.T += DT);
  const b = state.body, hd = state.head, sv = state.servos;

  // ── скорост: плавна заповед, която се сменя на 4–9 s ──
  if (t >= m.nextSpeed) {
    m.speedTarget = SPEEDS[(rand() * SPEEDS.length) | 0];
    m.nextSpeed = t + 4 + rand() * 5;
  }
  m.speedRef += (m.speedTarget - m.speedRef) * (DT / 0.55);
  m.speed += (m.speedRef - m.speed) * (DT / 0.45);
  const accel = (m.speed - m.speedPrev) / DT;     // mm/s²
  m.speedPrev = m.speed;
  const speedMeas = m.speed + 5 * m.pitchRate;

  // ── завой ──
  m.yawRate = 22 * sin(TAU * t / 17) + 9 * sin(TAU * t / 6.1 + 1.3);   // °/s, + наляво
  m.bodyHeading -= m.yawRate * DT;            // ляв завой намалява курса (по часовниковата стрелка е +)
  if (m.bodyHeading < 0) m.bodyHeading += 360; else if (m.bodyHeading >= 360) m.bodyHeading -= 360;

  // ── наклон на тялото: трептене около заданието + от време на време бутване ──
  if (t >= m.nextPush) {
    m.pushAmp = (rand() < 0.5 ? -1 : 1) * (4 + rand() * 4);
    m.pushT0 = t; m.nextPush = t + 7 + rand() * 7;
  }
  const dp = t - m.pushT0;
  const push = m.pushAmp * (1 - exp(-dp / 0.09)) * exp(-dp / 0.6) * sin(TAU * 1.2 * dp) * 1.6;
  m.pitchRef = 0.5 * sin(TAU * 0.11 * t) + 0.006 * (m.speedRef - m.speed);
  m.pitch = m.pitchRef + 1.9 * sin(TAU * 0.55 * t) + 0.7 * sin(TAU * 1.1 * t + 0.7) + 0.25 * sin(TAU * 2.3 * t + 2) + push;
  const pr = (m.pitch - m.pitchPrev) / DT;
  m.pitchRate += (pr - m.pitchRate) * 0.35;
  m.pitchPrev = m.pitch;
  m.roll = 0.6 * sin(TAU * 0.31 * t + 1) + 0.02 * m.yawRate;

  // ── колела ──
  const wv = m.yawRate * D2R * TRACK_MM / 2;     // mm/s разлика
  const vl = m.speed - wv, vr = m.speed + wv;
  m.pos += m.speed * DT;
  m.wl += vl * DEG_PER_MM * DT;
  m.wr += vr * DEG_PER_MM * DT;

  // ── токове, напрежения, въртящ момент, нагряване ──
  const e = abs(m.pitch - m.pitchRef);
  const effort = 0.28 + 0.16 * e + 0.006 * abs(m.pitchRate) + 0.0011 * abs(m.speed);
  const curL = clamp(effort - 0.004 * m.yawRate + 0.03 * sin(TAU * 2.3 * t), 0.2, 2.0);
  const curR = clamp(effort + 0.004 * m.yawRate + 0.03 * sin(TAU * 2.1 * t + 1.7), 0.2, 2.0);
  const voltL = clamp(0.9 + 3.2 * curL + 0.004 * abs(vl), 0, 9.0);
  const voltR = clamp(0.9 + 3.2 * curR + 0.004 * abs(vr), 0, 9.0);
  m.heatL += (clamp(voltL * curL / 14, 0, 1) - m.heatL) * (DT / 18);
  m.heatR += (clamp(voltR * curR / 14, 0, 1) - m.heatR) * (DT / 18);

  // ── цикъл на баланса ──
  const loop = 1750 + 90 * sin(TAU * 1.7 * t) + 45 * sin(TAU * 7.3 * t) + (rand() < 0.002 ? 380 : 0);
  m.loopMax = Math.max(m.loopMax * 0.9998, loop);

  b.pitch = m.pitch; b.pitch_ref = m.pitchRef; b.pitch_rate = m.pitchRate; b.roll = m.roll;
  b.speed = speedMeas; b.speed_ref = m.speedRef; b.yaw_rate = m.yawRate; b.pos_mm = m.pos;
  b.wheel_l_deg = m.wl; b.wheel_r_deg = m.wr;
  b.enc_l = Math.round(m.wl * 4); b.enc_r = Math.round(m.wr * 4);
  b.volt_l = voltL; b.volt_r = voltR; b.cur_l = curL; b.cur_r = curR;
  b.torque_l = 0.25 * curL; b.torque_r = 0.25 * curR;
  b.heat_l = m.heatL; b.heat_r = m.heatR;
  b.risk = clamp(abs(m.pitch) / 25, 0, 1);
  b.loop_us = loop; b.loop_max_us = m.loopMax;

  // ── серва: целта води, позицията изостава ──
  const panT = 30 * sin(TAU * t / 9);
  const tiltT = 15 * sin(TAU * t / 6.5 + 1);
  m.pan += (panT - m.pan) * (DT / 0.18);
  m.tilt += (tiltT - m.tilt) * (DT / 0.18);
  m.panSpd += (((m.pan - m.panPrev) / DT) - m.panSpd) * 0.2;
  m.tiltSpd += (((m.tilt - m.tiltPrev) / DT) - m.tiltSpd) * 0.2;
  m.panPrev = m.pan; m.tiltPrev = m.tilt;
  sv.pan.deg = m.pan; sv.pan.target = panT; sv.pan.speed_dps = m.panSpd; sv.pan.us = 1500 + m.pan * (1000 / 180);
  sv.tilt.deg = m.tilt; sv.tilt.target = tiltT; sv.tilt.speed_dps = m.tiltSpd; sv.tilt.us = 1500 + m.tilt * (1000 / 180);
  sv.current_a = 0.06 + 0.0032 * abs(m.panSpd) + 0.0032 * abs(m.tiltSpd);

  // ── глава (IMU): курсът е на тялото + пан ──
  let hh = m.bodyHeading + m.pan + 0.25 * sin(TAU * 1.1 * t);
  hh = hh < 0 ? hh + 360 : hh >= 360 ? hh - 360 : hh;
  const hp = m.pitch + m.tilt, hr = m.roll;
  const gx = (hr - m.headRollPrev) / DT, gy = -(hp - m.headPitchPrev) / DT;
  m.headPitchPrev = hp; m.headRollPrev = hr;
  hd.heading = hh; hd.pitch = hp; hd.roll = hr;
  hd.gyro[0] = gx + 0.4 * sin(TAU * 5.3 * t);
  hd.gyro[1] = gy + 0.4 * sin(TAU * 4.1 * t + 1);
  hd.gyro[2] = m.yawRate + m.panSpd + 0.4 * sin(TAU * 6.7 * t + 2);
  const sp = sin(hp * D2R), cp = cos(hp * D2R), sr = sin(hr * D2R), cr = cos(hr * D2R);
  const lat = (m.speed / 1000) * (m.yawRate * D2R) / 9.81;          // центростремително, g
  hd.acc[0] = sp + accel / 9810;
  hd.acc[1] = cp * sr + lat + 0.045 * sin(TAU * 0.4 * t) + 0.012 * sin(TAU * 2.3 * t);
  hd.acc[2] = cp * cr;
  // Земно магнитно поле (≈ София): хоризонтално 0.24 G, надолу 0.42 G; завъртяно по курс, наклон, крен.
  {
    const H = 0.24, V = 0.42, ps = hh * D2R;
    const c = cos(ps), s = sin(ps);
    let x = H * c, y = -H * s, z = V;                 // NED → курс
    let x2 = cp * x - sp * z, z2 = sp * x + cp * z;   // тангаж (нос нагоре +)
    let y3 = cr * y + sr * z2, z3 = -sr * y + cr * z2;// крен (дясно надолу +)
    hd.mag[0] = x2; hd.mag[1] = -y3; hd.mag[2] = -z3;
  }

  // ── 8×8 на 15 Hz ──
  m.tofAcc += DT;
  if (m.tofAcc >= 1 / 15) { m.tofAcc -= 1 / 15; tofFrame(t); }

  // ── зад ──
  state.rear.mm = Math.round(clamp(1200 + 700 * sin(TAU * t / 17) + 90 * sin(TAU * t / 3.3), 400, 2000));

  // ── батерия (на 10 Hz) ──
  m.bat = m.v0 - 0.0012 * t;
  const a = curL + curR + 0.4;
  const v = m.bat - 0.1 * a;
  const bt = state.battery;
  bt.v = v; bt.a = a; bt.w = v * a; bt.pct = clamp((v - 9.0) / 3.6 * 100, 0, 100); bt.low = bt.pct < 20;

  // ── звук: на всеки 14 s по 3.5 s ──
  {
    const ph = (t - 18) % 14;
    const playing = t >= 18 && ph < 3.5;
    state.sound.playing = playing;
    if (playing) { state.sound.name = SOUNDS[(((t - 18) / 14) | 0) % SOUNDS.length]; state.sound.volume = 0.6; }
    else if (state.sound.name === '') { state.sound.name = SOUNDS[0]; state.sound.volume = 0.6; }
  }

  // ── връзка ──
  state.t = t;
  state.link.rtt_ms = 22 + 6 * sin(TAU * t / 7) + 2 * sin(TAU * t / 1.3);
  state.link.rx_hz = 100 + 0.8 * sin(TAU * t / 3.1);

  // ── история на графиките ──
  hist.pitch.push(t, m.pitch); hist.pitch_ref.push(t, m.pitchRef);
  hist.speed.push(t, speedMeas); hist.speed_ref.push(t, m.speedRef);
  hist.cur_l.push(t, curL); hist.cur_r.push(t, curR);
  hist.volt_l.push(t, voltL); hist.volt_r.push(t, voltR);
  hist.head_pitch.push(t, hp); hist.head_roll.push(t, hr);
  hist.gyro_x.push(t, hd.gyro[0]); hist.gyro_y.push(t, hd.gyro[1]); hist.gyro_z.push(t, hd.gyro[2]);
  hist.acc_x.push(t, hd.acc[0]); hist.acc_y.push(t, hd.acc[1]); hist.acc_z.push(t, hd.acc[2]);
  if (++m.batAcc >= 10) { m.batAcc = 0; hist.bat_v.push(t, v); hist.bat_w.push(t, v * a); }

  // ── честоти, веднъж в секунда ──
  m.rate1s += DT;
  if (m.rate1s >= 1) { m.rate1s -= 1; updateRates(t); }
}

// Дълбочинна карта: стена на ~1.2 m и ръка 0.3–0.5 m, която се движи; няколко зони без цел.
function tofFrame(t) {
  const tof = state.tof, fov = tof.fov_deg, zone = fov / 8;
  const D = 1150 + 90 * sin(TAU * t / 11);
  const az0 = 13 * sin(TAU * t / 5.3), el0 = 7 * sin(TAU * t / 3.7 + 0.6);
  const Dh = 400 + 80 * sin(TAU * t / 4.1);
  const rho = 8.5 + 1.2 * sin(TAU * t / 2.3);
  const tick = (t * 3) | 0;
  for (let r = 0; r < 8; r++) {
    const el = (3.5 - r) * zone;
    for (let c = 0; c < 8; c++) {
      const i = r * 8 + c, az = (c - 3.5) * zone;
      const cc = cos(az * D2R) * cos(el * D2R);
      const da = az - az0, de = el - el0;
      const dist = Math.sqrt(da * da + de * de);
      let mm, ok = true;
      if (dist < rho) mm = Dh / cc + 10 * sin(i * 1.7 + t * 3);
      else mm = D / cc + 14 * sin(i * 2.3 + t * 1.9);
      // зони без цел: горният ляв ъгъл (над стената), ръбът на ръката и случайни изпускания
      if (r === 0 && c < 2) ok = false;
      else if (dist >= rho && dist < rho + 2.2 && ((i * 7919 + tick * 104729) % 100) < 35) ok = false;
      else if (((i * 2654435761 + tick * 40503) >>> 7) % 100 < 2) ok = false;
      tof.mm[i] = ok ? Math.round(mm) : -1;
      tof.valid[i] = ok ? 1 : 0;
    }
  }
  tof.frame++;
  tof.ok = true;
  tof.hz = (t % 25 > 21.5 && t % 25 < 24) ? 12.6 : 14.8 + 0.2 * sin(t);
}

function updateRates(t) {
  const dip = (t % 25 > 21.5 && t % 25 < 24);
  const j = (a) => a * (1 + 0.004 * (rand() - 0.5));
  state.rates = [
    { id: 'cam', ime: 'Камера', hz: +(j(36)).toFixed(1), ok: 30 },
    { id: 'tof', ime: 'Дълбочина 8×8', hz: dip ? 12.6 : +(j(14.8)).toFixed(1), ok: 15 },
    { id: 'imu', ime: 'IMU на главата', hz: +(j(199.6)).toFixed(1), ok: 200 },
    { id: 'mag', ime: 'Компас', hz: +(j(40)).toFixed(1), ok: 40 },
    { id: 'body', ime: 'Тяло', hz: +(j(100)).toFixed(1), ok: 100 },
    { id: 'eyes', ime: 'Очи', hz: +(j(62)).toFixed(1), ok: 60 },
  ];
}
