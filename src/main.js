import { createGame, update, stepsFor, parseHighScore, STEP } from './game.js';
import { draw } from './render.js';
import { attachInput } from './input.js';

const KEY = 'invaders.highscore';
const store = {
  load() { try { return parseHighScore(localStorage.getItem(KEY)); } catch { return 0; } },
  save(n) { try { localStorage.setItem(KEY, String(n)); } catch { /* storage unavailable: keep playing */ } },
};

const ctx = document.getElementById('game').getContext('2d');
const input = attachInput();
const state = createGame({ highScore: store.load() });
let saved = state.highScore, last = performance.now(), acc = 0;

function frame(now) {
  acc = Math.min(acc + (now - last) / 1000, 5 * STEP);
  last = now;
  const n = stepsFor(acc);
  for (let i = 0; i < n; i++) { update(state, input); input.start = false; }
  acc -= n * STEP;
  if (state.highScore !== saved && state.phase === 'gameover') { saved = state.highScore; store.save(saved); }
  draw(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
