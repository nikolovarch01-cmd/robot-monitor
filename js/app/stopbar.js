// Големият червен СТОП: на всеки раздел, винаги на екрана, на живо. Праща точно каквото праща и телефонът (net_ws.doStop).
import { doStop, stopRecent, on } from '../net_ws.js';

export function initStopbar(live) {
  const bar = document.createElement('div');
  bar.className = 'stopbar';
  bar.id = 'stopbar';
  bar.innerHTML = '<button type="button" class="stopb" id="stop">СТОП</button>';
  document.body.appendChild(bar);
  document.body.classList.add('has-stop');
  const b = bar.firstElementChild;
  if (!live) {
    b.disabled = true;
    b.title = 'Демо: няма робот';
    bar.classList.add('demo');
    b.innerHTML = 'СТОП<small>Демо: няма робот</small>';
    document.body.classList.add('demo-stop');
    return;
  }
  document.body.classList.add('live');
  b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); doStop(); });
  b.addEventListener('click', () => { if (!stopRecent()) doStop(); });      // клавиатура, помощни средства
  bar.addEventListener('contextmenu', (ev) => ev.preventDefault());
  on('stop', () => {
    b.classList.add('sent');
    setTimeout(() => b.classList.remove('sent'), 300);
  });
}
