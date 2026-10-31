// Джойстик с допир и мишка (pointer events). Преведен от телефонното приложение.
// Връща {place, release}: release пуска хванатия пръст (СТОП, скрита страница).
// Допир извън кръга (ъгъл на квадратната кутия, етикет) не е джойстик и се пренебрегва, както и допир в ивицата
// точно над СТОП: пръст, който цели СТОП, никога не хваща джойстик.
const STOP_GUARD_PX = 24;
const nearStop = (ev) => {
  const s = document.getElementById('stopbar');      // СТОП е горе в лентата: пазим около него, не под него
  if (!s) return false;
  const r = s.getBoundingClientRect();
  return ev.clientY < r.bottom + STOP_GUARD_PX && ev.clientX > r.left - STOP_GUARD_PX && ev.clientX < r.right + STOP_GUARD_PX;
};

export function stick(el, onMove, onEnd, recenter) {
  const knob = el.querySelector('.knob');
  let id = null;
  const place = (x, y) => {
    const r = el.getBoundingClientRect();
    const R = r.width * 0.31;
    knob.style.transform = 'translate(' + (x * R) + 'px,' + (y * R) + 'px)';
  };
  const raw = (ev) => {
    const r = el.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width - 0.5) * 2, ((ev.clientY - r.top) / r.height - 0.5) * 2];
  };
  const pos = (ev) => {
    let [x, y] = raw(ev);
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return [x, y];
  };
  const end = () => {
    if (id === null) return;
    const p = id;
    id = null;
    try { el.releasePointerCapture(p); } catch (e) { /* вече пуснат */ }
    if (recenter) place(0, 0);
    el.classList.remove('held');
    onEnd();
  };
  el.addEventListener('pointerdown', (ev) => {
    if (el.classList.contains('locked')) return;
    const [rx, ry] = raw(ev);
    if (Math.hypot(rx, ry) > 1 || nearStop(ev)) return;
    ev.preventDefault();
    if (id !== null) return;                  // втори пръст: първият държи джойстика
    id = ev.pointerId;
    el.setPointerCapture(id);
    el.classList.add('held');
    const [x, y] = pos(ev);
    place(x, y);
    onMove(x, y);
  });
  el.addEventListener('pointermove', (ev) => { if (ev.pointerId !== id) return; const [x, y] = pos(ev); place(x, y); onMove(x, y); });
  const up = (ev) => { if (ev.pointerId === id) end(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return { place, release: end, held: () => id !== null };
}
