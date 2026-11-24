const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire' };

/** Returns a live input object. `start` is edge-triggered: the caller clears it after consuming. */
export function attachInput(win = window, doc = document) {
  const input = { left: false, right: false, fire: false, start: false };
  win.addEventListener('keydown', (e) => {
    const k = KEYS[e.key];
    if (k || e.key === 'Enter') e.preventDefault();
    if (k) input[k] = true;
    if ((k === 'fire' || e.key === 'Enter') && !e.repeat) input.start = true;
  });
  win.addEventListener('keyup', (e) => { const k = KEYS[e.key]; if (k) input[k] = false; });
  win.addEventListener('blur', () => { input.left = input.right = input.fire = false; });
  for (const btn of doc.querySelectorAll('#touch button')) {
    const k = btn.dataset.key;
    const set = (v) => (e) => { e.preventDefault(); input[k] = v; if (v && k === 'fire') input.start = true; };
    btn.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, set(false));
  }
  doc.getElementById('game').addEventListener('pointerdown', () => { input.start = true; });
  return input;
}
