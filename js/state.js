// Състоянието на робота, което екранът чете. Пълни го връзката (net_lan.js, после WebRTC) или demo.js.
// Изгледите само четат: всеки кадър рисуват от тук, нищо не пазят свое.
// Единици: градуси, °/s, g, гаус, mm, mm/s, V, A, W, s. null = няма данни.

export const state = {
  t: 0,                       // s, времето на P4 (или на демото)
  link: {
    mode: 'demo',             // 'demo' | 'lan' | 'webrtc'
    connected: false,
    rtt_ms: null,             // закъснение напред и назад
    rx_hz: 0,                 // рамки в секунда от робота
    dropped: 0,               // изпуснати на робота (заседнал клиент)
    lost: 0,                  // изгубени по пътя (по поредния номер)
  },
  head: {                     // MinIMU-9 v6 на главата: рамка X напред, Y наляво, Z нагоре
    ok: false, mag_ok: false,
    pitch: 0,                 // + носът нагоре
    roll: 0,                  // + дясната страна надолу
    heading: 0,               // 0..360, по компаса
    gyro: [0, 0, 0],          // °/s около X, Y, Z (Z + наляво)
    acc: [0, 0, 1],           // g
    mag: [0, 0, 0],           // гаус
  },
  servos: {
    on: false, mode: 'off',   // 'off' | 'on' | 'cent' | 'park'
    cap_deg: 0,               // таванът на хода
    current_a: null,          // токът на сервата
    pan:  { deg: 0, target: 0, us: 1500, speed_dps: 0, cut: false },
    tilt: { deg: 0, target: 0, us: 1500, speed_dps: 0, cut: false },
  },
  tof: {                      // VL53L5CX 8×8 на главата
    ok: false, frame: 0, hz: 0,
    mm: new Int16Array(64).fill(-1),   // -1 = няма цел; ред 0 е горе, колона 0 е вляво (гледано отзад)
    valid: new Uint8Array(64),
    fov_deg: 45,              // зрителното поле по хоризонтала и по вертикала
  },
  rear: { ok: false, mm: null },       // VL53L1X отзад на главата, гледа назад и се върти с нея (драйверът предстои)
  body: {                     // тялото (XIAO ESP32-C5), STATE2 на 100 Hz и STATE на 20 Hz
    online: false,
    state: '—', fault: '—', controller: 0,
    pitch: 0, pitch_ref: 0, pitch_rate: 0, roll: 0,
    speed: 0, speed_ref: 0,   // mm/s
    yaw_rate: 0,              // °/s, + наляво
    pos_mm: 0,
    enc_l: 0, enc_r: 0,       // сурови импулси
    wheel_l_deg: 0, wheel_r_deg: 0,    // завъртане на колелата от енкодерите
    volt_l: 0, volt_r: 0, volt_limit: 0,
    cur_l: 0, cur_r: 0,       // A, по модела
    torque_l: 0, torque_r: 0, // N·m на колелото
    heat_l: 0, heat_r: 0,     // 0..1 от границата
    risk: 0,
    loop_us: 0, loop_max_us: 0,
    flags: 0,
  },
  battery: { v: null, pct: null, a: null, w: null, low: false },
  sound: { playing: false, name: '', volume: 0 },
  camera: { ok: false, w: 0, h: 0, hz: 0, url: null },
  rates: [],                  // [{id, ime, hz, ok}] веднъж в секунда
};

// История за графиките: пръстен на всеки канал, с времето отделно
export class Ring {
  constructor(n) { this.t = new Float64Array(n); this.v = new Float32Array(n); this.n = n; this.i = 0; this.len = 0; }
  push(t, v) { this.t[this.i] = t; this.v[this.i] = v; this.i = (this.i + 1) % this.n; if (this.len < this.n) this.len++; }
  // подредено от най-старото: [времена, стойности]
  arrays() {
    const t = new Float64Array(this.len), v = new Float32Array(this.len);
    const s = (this.i - this.len + this.n) % this.n;
    for (let k = 0; k < this.len; k++) { const j = (s + k) % this.n; t[k] = this.t[j]; v[k] = this.v[j]; }
    return [t, v];
  }
}

const H = 100 * 20;          // 20 s при 100/s
export const hist = {
  pitch: new Ring(H), pitch_ref: new Ring(H), speed: new Ring(H), speed_ref: new Ring(H),
  cur_l: new Ring(H), cur_r: new Ring(H), volt_l: new Ring(H), volt_r: new Ring(H),
  head_pitch: new Ring(H), head_roll: new Ring(H), gyro_x: new Ring(H), gyro_y: new Ring(H), gyro_z: new Ring(H),
  acc_x: new Ring(H), acc_y: new Ring(H), acc_z: new Ring(H),
  bat_v: new Ring(600), bat_w: new Ring(600),
};
