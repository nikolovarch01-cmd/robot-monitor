// Каталогът на плочките на Табло (05_TABLA): какво има, как се казва, какво прави, кой изглед го рисува.
//   ime     — името (едно и също навсякъде, 02_DIZAYN 1.11); kakvo — едно изречение за списъка „+ Добави“
//   grupa   — групата в списъка; mod/fn/arg — изгледът: (await import(mod))[fn](host, ctx, arg) → { update, destroy, ... }
//   vid     — рамката: karta (текст и числа), ured (уред, поле 6), kartina (камера, 3D: до ръба), grafika, gola (без карта)
//   chast   — частта, чието ключе е в заглавието (vkl <id>); w,h — размерът по подразбиране; minW,minH — най-малкият
//   edna    — само една на таблото; red — редът на телефона (по важност, 02_DIZAYN 2.2); redT — на таблета, ако е друг
//   cyal    — на таблета взима целия ред
export const GRUPI = [
  ['glava', 'Главата'], ['vizhda', 'Какво вижда'], ['tyalo', 'Тялото'], ['grafiki', 'Графики'], ['upr', 'Управление'],
];

export const PLOCHKI = {
  zdrave: { ime: 'Здраве', grupa: 'glava', vid: 'gola', mod: '../ui/rates.js', fn: 'init', w: 24, h: 2, minW: 8, minH: 2, red: 0, cyal: true,
    kakvo: 'Честотата на всеки датчик: зелено работи, жълто е под нормата, сиво е изключен.' },
  adi: { ime: 'Хоризонт', grupa: 'glava', vid: 'ured', mod: '../ui/instruments.js', fn: 'initAdi', w: 4, h: 7, minW: 3, minH: 4, red: 4,
    kakvo: 'Наклонът и кренът на главата, като в самолет.' },
  hsi: { ime: 'Компас', grupa: 'glava', vid: 'ured', mod: '../ui/instruments.js', fn: 'initHsi', w: 4, h: 7, minW: 3, minH: 4, red: 5,
    kakvo: 'Курсът на главата и на тялото и полето на 8×8.' },
  turn: { ime: 'Завой', grupa: 'glava', vid: 'ured', mod: '../ui/instruments.js', fn: 'initTurn', w: 4, h: 5, minW: 3, minH: 3, red: 6,
    kakvo: 'Колко бързо се върти главата и дали се плъзга.' },
  raw: { ime: 'Сурово IMU', grupa: 'glava', vid: 'ured', mod: '../ui/instruments.js', fn: 'initRaw', w: 4, h: 5, minW: 3, minH: 4, red: 7,
    kakvo: 'Жироскопът, ускорението и компасът по осите X, Y, Z.' },
  servo: { ime: 'Серви на главата', grupa: 'glava', vid: 'karta', mod: '../ui/servos.js', fn: 'init', chast: 'servo', w: 5, h: 7, minW: 4, minH: 5, red: 9,
    kakvo: 'Пан и тилт: къде са, накъде отиват, токът. Ключето ги пуска и спира.' },

  kam: { ime: 'Камера', grupa: 'vizhda', vid: 'kartina', kam: true, chast: 'kam', edna: true, w: 6, h: 10, minW: 4, minH: 5, red: 1,
    kakvo: 'Картината от главата с хоризонта и курса отгоре. Само една: роботът дава картина на един зрител.' },
  tof: { ime: '8×8', grupa: 'vizhda', vid: 'karta', mod: '../ui/depth.js', fn: 'init', chast: 'tof', w: 6, h: 14, minW: 4, minH: 8, red: 11, cyal: true,
    kakvo: 'Разстоянията пред главата в 64 точки и разстоянието отзад.' },
  '3d': { ime: '3D', grupa: 'vizhda', vid: 'kartina', mod: '../ui/scene3d.js', fn: 'init', edna: true, w: 9, h: 24, minW: 5, minH: 8, red: 2,
    kakvo: 'Роботът и облакът от 8×8 в пространството. Само едно: тежко е за видеокартата.' },

  bat: { ime: 'Батерия', grupa: 'tyalo', vid: 'karta', mod: '../ui/battery.js', fn: 'init', w: 5, h: 3, minW: 4, minH: 3, red: 3,
    kakvo: 'Колко е останало, напрежението, токът и мощността.' },
  tyalo: { ime: 'Тяло и колела', grupa: 'tyalo', vid: 'karta', mod: '../ui/body.js', fn: 'init', w: 5, h: 12, minW: 4, minH: 10, red: 8,
    kakvo: 'Колелата, скоростта, наклонът, моторите и цикълът на баланса.' },
  zvuk: { ime: 'Нрав и звук', grupa: 'tyalo', vid: 'karta', mod: '../ui/sound.js', fn: 'init', chast: 'zvuk', w: 5, h: 2, minW: 4, minH: 2, red: 10, redT: 3.5,
    kakvo: 'Какво изразява роботът: нравът и какво свири. Ключето пуска и спира звука.' },

  'gr-naklon': { ime: 'Наклон', grupa: 'grafiki', vid: 'grafika', mod: '../ui/charts.js', fn: 'initChart', arg: 'ch-pitch', w: 6, h: 4, minW: 4, minH: 3, red: 12,
    kakvo: 'Наклонът на тялото и зададеният за последните 15 s.' },
  'gr-skorost': { ime: 'Скорост', grupa: 'grafiki', vid: 'grafika', mod: '../ui/charts.js', fn: 'initChart', arg: 'ch-speed', w: 6, h: 4, minW: 4, minH: 3, red: 13,
    kakvo: 'Скоростта и зададената за последните 15 s.' },
  'gr-tok': { ime: 'Ток на мотори', grupa: 'grafiki', vid: 'grafika', mod: '../ui/charts.js', fn: 'initChart', arg: 'ch-cur', w: 6, h: 4, minW: 4, minH: 3, red: 14,
    kakvo: 'Токът на левия и на десния мотор за последните 15 s.' },
  'gr-zhiro': { ime: 'Жироскоп (глава)', grupa: 'grafiki', vid: 'grafika', mod: '../ui/charts.js', fn: 'initChart', arg: 'ch-gyro', w: 6, h: 4, minW: 4, minH: 3, red: 15,
    kakvo: 'Въртенето на главата по X, Y, Z за последните 15 s.' },

  dvizh: { ime: 'Джойстик: движение', grupa: 'upr', vid: 'palka', mod: '../app/upravlenie.js', fn: 'plDvizh', w: 5, h: 8, minW: 3, minH: 5, red: 16,
    kakvo: 'Кара робота, докато го държиш; пуснат, спира. Стрелките карат също.' },
  glava: { ime: 'Джойстик: глава', grupa: 'upr', vid: 'palka', mod: '../app/upravlenie.js', fn: 'plGlava', w: 5, h: 8, minW: 3, minH: 5, red: 17,
    kakvo: 'Върти главата в тавана на хода; пуснат, главата остава.' },
  rezhimi: { ime: 'Режими', grupa: 'upr', vid: 'karta', mod: '../app/upravlenie.js', fn: 'plRezhimi', w: 7, h: 3, minW: 5, minH: 3, red: 18, cyal: true,
    kakvo: 'Баланс, Паркирай, Изправи, Покой.' },
  profil: { ime: 'Профил', grupa: 'upr', vid: 'karta', mod: '../app/upravlenie.js', fn: 'plProfil', w: 6, h: 3, minW: 4, minH: 3, red: 19,
    kakvo: 'Колко бързо кара: Бавен, Нормален, Пъргав.' },
  nrav: { ime: 'Нрав', grupa: 'upr', vid: 'karta', mod: '../app/upravlenie.js', fn: 'plNrav', w: 5, h: 10, minW: 4, minH: 9, red: 20,
    kakvo: 'Налага нрав за 5, 15 или 60 min, или оставя робота сам да избира.' },
  chasti: { ime: 'Части', grupa: 'upr', vid: 'karta', mod: '../app/upravlenie.js', fn: 'plChasti', w: 5, h: 13, minW: 4, minH: 10, red: 21,
    kakvo: 'Всички части с ключетата им наведнъж: камера, 8×8, задният датчик, очите, звукът, сервата.' },
};
