// Колоните на CSV от робота: точно PROTO_LOG_CSV_HEADER (firmware/components/robot_common/include/robot_proto.h).
// Единиците са тези, в които ги пише proto_log_rec_to_csv (robot_proto.c). Нищо не е измислено; групите са само за екрана.
export const CSV_HEADER = 't_ms,dt_us,i2c_us,pitch_deg,pitch_dps,pitch_ref_deg,pitch_acc_deg,pos_mm,pos_ref_mm,' +
  'speed_mm_s,speed_ref_mm_s,speed_cmd_mm_s,yaw_rate_dps,yaw_ref_dps,u_bal_v,u_turn_v,' +
  'volt_left_v,volt_right_v,volt_limit_v,vbat_v,cur_total_a,omega_left_rad_s,omega_right_rad_s,' +
  'risk,state,fault,controller,gyro_bias_dps,trim_deg,flags,seq';
export const COLS = CSV_HEADER.split(',');

const CY = '#3cc8ff', VI = '#a78bfa', GR = '#36d399', OR = '#ffb347', WH = 'rgba(226,235,245,.78)', PK = '#ff7ab8', RD = '#ff5d6c';

// [колона, име на екрана, цвят, пунктир?, включена по подразбиране]
export const GROUPS = [
  { id: 'pitch', title: 'Наклон', unit: '°', ch: [['pitch_deg', 'наклон', CY, 0, 1], ['pitch_ref_deg', 'зададен', WH, 1, 1], ['pitch_acc_deg', 'от акселерометъра', OR, 0, 0]] },
  { id: 'rate', title: 'Ъглова скорост на наклона', unit: '°/s', ch: [['pitch_dps', 'pitch_dps', VI, 0, 1]] },
  { id: 'volt', title: 'Напрежение към моторите', unit: 'V', ch: [['volt_left_v', 'ляв', CY, 0, 1], ['volt_right_v', 'десен', VI, 0, 1], ['volt_limit_v', 'таван', WH, 1, 1],
    ['u_bal_v', 'u баланс', GR, 0, 0], ['u_turn_v', 'u завой', OR, 0, 0], ['vbat_v', 'батерия', PK, 0, 0]] },
  { id: 'loop', title: 'Цикъл на баланса', unit: 'µs', ch: [['dt_us', 'dt (време между цикли)', CY, 0, 1], ['i2c_us', 'i2c (четене на IMU)', OR, 0, 0]] },
  { id: 'speed', title: 'Скорост', unit: 'mm/s', ch: [['speed_mm_s', 'скорост', CY, 0, 1], ['speed_ref_mm_s', 'зададена', WH, 1, 1], ['speed_cmd_mm_s', 'команда от P4', OR, 0, 0]] },
  { id: 'yaw', title: 'Завой', unit: '°/s', ch: [['yaw_rate_dps', 'завой', CY, 0, 1], ['yaw_ref_dps', 'зададен', WH, 1, 1]] },
  { id: 'wheel', title: 'Колела (мотор спрямо тялото)', unit: 'rad/s', ch: [['omega_left_rad_s', 'ляво', CY, 0, 1], ['omega_right_rad_s', 'дясно', VI, 0, 1]] },
  { id: 'pos', title: 'Място', unit: 'mm', ch: [['pos_mm', 'път', CY, 0, 1], ['pos_ref_mm', 'пази / следва', WH, 1, 1]] },
  { id: 'cur', title: 'Ток от батерията', unit: 'A', ch: [['cur_total_a', 'общо (−1 = няма)', GR, 0, 1]] },
  { id: 'misc', title: 'Риск, жироскоп, трим', unit: '', ch: [['risk', 'риск 0..1', RD, 0, 1], ['gyro_bias_dps', 'отклонение на жироскопа °/s', OR, 0, 0], ['trim_deg', 'трим °', GR, 0, 0]] },
  { id: 'status', title: 'Състояние (числа от тялото)', unit: '', ch: [['state', 'state', CY, 0, 1], ['fault', 'fault', RD, 0, 1], ['controller', 'controller', VI, 0, 0], ['flags', 'flags', OR, 0, 0], ['seq', 'seq', WH, 0, 0]] },
];
// кои групи са включени, когато се отвори запис
export const DEFAULT_GROUPS = ['pitch', 'rate', 'volt', 'loop'];
