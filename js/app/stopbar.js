// СТОП: малък червен бутон горе в лентата, на всеки раздел (Михаил, 2026-10-31: „махни гадния огромен стоп бутон“).
// Праща точно каквото праща и телефонът (net_ws.doStop). Space също е СТОП (в Управление).
import { doStop, stopRecent, on } from '../net_ws.js';

function place(bar, tries) {
  const spacer = document.querySelector('#topbar .tb-spacer');
  if (spacer) { spacer.after(bar); return; }
  if (tries > 0) { requestAnimationFrame(() => place(bar, tries - 1)); return; }
  bar.classList.add('loose');            // няма лента: горе вдясно, над всичко
  document.body.appendChild(bar);
}

export function initStopbar(live) {
  const bar = document.createElement('span');
  bar.className = 'stopbar';
  bar.id = 'stopbar';
  bar.innerHTML = '<button type="button" class="stopb" id="stop">СТОП</button>';
  place(bar, 120);
  const b = bar.firstElementChild;
  if (!live) {
    b.disabled = true;
    b.title = 'Демо: няма робот';
    bar.classList.add('demo');
    return;
  }
  b.title = 'СТОП (Space)';
  // Space е СТОП на всеки раздел, освен докато се пише в поле
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  document.addEventListener('keydown', (ev) => {
    if (ev.code !== 'Space' || typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    ev.preventDefault();
    if (!ev.repeat) doStop();
  });
  b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); doStop(); });
  b.addEventListener('click', () => { if (!stopRecent()) doStop(); });      // клавиатура, помощни средства
  bar.addEventListener('contextmenu', (ev) => ev.preventDefault());
  on('stop', () => {
    b.classList.add('sent');
    setTimeout(() => b.classList.remove('sent'), 300);
  });
}
