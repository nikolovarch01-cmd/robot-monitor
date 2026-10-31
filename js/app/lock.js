// Демо: бутоните, които говорят с робота, са видимо изключени и има бележка „Демо: няма робот“.
// Елемент с data-keep остава включен (напр. прегледът на запис работи и в демото).
export function lockDemo(root, on) {
  const note = root.querySelector('.demo-note');
  if (note) note.hidden = !on;
  root.classList.toggle('demo-locked', !!on);
  if (!on) return;
  for (const e of root.querySelectorAll('button, input, select, textarea')) {
    if (e.closest('[data-keep]')) continue;
    e.disabled = true;
    if (!e.title) e.title = 'Демо: няма робот';
  }
  for (const s of root.querySelectorAll('.stick')) s.classList.add('locked');
}
