export const W = 224, H = 256, STEP = 1 / 60;
export const COLS = 11, ROWS = 5, INV_W = 12, INV_H = 8;
export const SHIELD_Y = 192, SHIELD_W = 22, SHIELD_H = 16;
export const PLAYER_Y = 232, PLAYER_W = 13, PLAYER_H = 8;
const UFO_POINTS = [50, 100, 150, 300];
const MAX_BOMBS = 3, MAX_STEPS = 5, DYING_TICKS = 60, EXTRA_LIFE = 1500;

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rowPoints = (row) => (row === 0 ? 30 : row < 3 ? 20 : 10);

/** Ticks per invader step: fewer invaders (and later levels) march faster. */
export function stepInterval(alive, level = 1) {
  return Math.max(2, Math.round(alive * 0.8) - 2 * (level - 1));
}

/** Whole fixed steps to run for `elapsed` seconds, capped so a hidden tab can't stall the page. */
export function stepsFor(elapsed) {
  return Math.max(0, Math.min(MAX_STEPS, Math.floor(elapsed / STEP + 1e-9)));
}

/** Storage is untrusted: accept only a non-negative integer of at most 9 digits. */
export function parseHighScore(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 && raw <= 999999999 ? raw : 0;
  return typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
}

function makeShield(x) {
  const cells = [];
  for (let r = 0; r < SHIELD_H; r++) {
    const row = [];
    for (let c = 0; c < SHIELD_W; c++) {
      const corner = r === 0 && (c < 2 || c >= SHIELD_W - 2);
      const notch = r >= SHIELD_H - 6 && c >= 7 && c < SHIELD_W - 7;
      row.push(corner || notch ? 0 : 1);
    }
    cells.push(row);
  }
  return { x, y: SHIELD_Y, cells };
}

/** Erase shield cells touched by rect (grown by `grow` px). Returns true if anything was hit. */
function erodeShields(state, rect, grow) {
  const r = { x: rect.x - grow, y: rect.y - grow, w: rect.w + 2 * grow, h: rect.h + 2 * grow };
  let hit = false;
  for (const s of state.shields) {
    if (!overlap(r, { x: s.x, y: s.y, w: SHIELD_W, h: SHIELD_H })) continue;
    const core = { x: rect.x - s.x, y: rect.y - s.y, w: rect.w, h: rect.h };
    let touched = false;
    for (let cy = Math.max(0, Math.floor(core.y)); cy < Math.min(SHIELD_H, core.y + core.h) && !touched; cy++)
      for (let cx = Math.max(0, Math.floor(core.x)); cx < Math.min(SHIELD_W, core.x + core.w); cx++)
        if (s.cells[cy][cx]) { touched = true; break; }
    if (!touched) continue;
    hit = true;
    for (let cy = Math.max(0, Math.floor(r.y - s.y)); cy < Math.min(SHIELD_H, r.y - s.y + r.h); cy++)
      for (let cx = Math.max(0, Math.floor(r.x - s.x)); cx < Math.min(SHIELD_W, r.x - s.x + r.w); cx++)
        s.cells[cy][cx] = 0;
  }
  return hit;
}

export function createGame({ rng = Math.random, highScore = 0 } = {}) {
  const state = { rng, phase: 'ready', score: 0, highScore, lives: 3, level: 1, extraLife: false,
    player: { x: (W - PLAYER_W) / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H } };
  startLevel(state);
  return state;
}

export function startLevel(state) {
  const y0 = 40 + Math.min(state.level - 1, 6) * 8;
  state.invaders = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++)
      state.invaders.push({ x: 16 + col * 16, y: y0 + row * 16, row, col, alive: true });
  state.dir = 1;
  state.frame = 0;
  state.bullet = null;
  state.bombs = [];
  state.ufo = null;
  state.ufoTimer = Math.floor(900 + state.rng() * 600);
  state.stepTimer = stepInterval(ROWS * COLS, state.level);
  state.dyingTimer = 0;
  state.shields = [0, 1, 2, 3].map((i) => makeShield(27 + 49 * i));
}

function addScore(state, n) {
  state.score += n;
  if (!state.extraLife && state.score >= EXTRA_LIFE) { state.extraLife = true; state.lives++; }
  if (state.score > state.highScore) state.highScore = state.score;
}

function hitPlayer(state) {
  state.lives--;
  state.bullet = null;
  state.bombs = [];
  state.dyingTimer = DYING_TICKS;
  state.phase = state.lives > 0 ? 'dying' : 'gameover';
}

function marchInvaders(state) {
  const alive = state.invaders.filter((i) => i.alive);
  const dx = 4 * state.dir;
  const blocked = alive.some((i) => i.x + dx < 0 || i.x + INV_W + dx > W);
  for (const i of alive) {
    if (blocked) i.y += 8; else i.x += dx;
  }
  if (blocked) state.dir = -state.dir;
  state.frame ^= 1;
  for (const i of alive) {
    erodeShields(state, { x: i.x, y: i.y, w: INV_W, h: INV_H }, 0);
    if (i.y + INV_H >= SHIELD_Y + SHIELD_H) state.phase = 'gameover';
  }
}

function spawnBomb(state) {
  const level = state.level;
  if (state.bombs.length >= MAX_BOMBS || state.rng() >= Math.min(0.05, 0.02 + 0.004 * (level - 1))) return;
  const shooters = [];
  for (let col = 0; col < COLS; col++) {
    const col_inv = state.invaders.filter((i) => i.alive && i.col === col);
    if (col_inv.length) shooters.push(col_inv[col_inv.length - 1]);
  }
  if (!shooters.length) return;
  const s = shooters[Math.floor(state.rng() * shooters.length) % shooters.length];
  state.bombs.push({ x: s.x + INV_W / 2 - 1, y: s.y + INV_H });
}

function moveBullet(state) {
  const b = state.bullet;
  b.y -= 4;
  const rect = { x: b.x, y: b.y, w: 1, h: 4 };
  const u = state.ufo;
  if (u && overlap(rect, { x: u.x, y: 24, w: 16, h: 7 })) {
    addScore(state, u.points);
    state.ufo = null; state.bullet = null;
    return;
  }
  const inv = state.invaders.find((i) => i.alive && overlap(rect, { x: i.x, y: i.y, w: INV_W, h: INV_H }));
  if (inv) {
    inv.alive = false;
    addScore(state, rowPoints(inv.row));
    state.bullet = null;
    return;
  }
  if (erodeShields(state, rect, 1) || b.y < 0) state.bullet = null;
}

function moveBombs(state) {
  const p = state.player;
  const kept = [];
  for (const bomb of state.bombs) {
    bomb.y += 2;
    const rect = { x: bomb.x, y: bomb.y, w: 3, h: 6 };
    const b = state.bullet;
    if (b && overlap(rect, { x: b.x, y: b.y, w: 1, h: 4 })) { state.bullet = null; continue; }
    if (overlap(rect, p)) { hitPlayer(state); return; }
    if (erodeShields(state, rect, 1) || bomb.y > H) continue;
    kept.push(bomb);
  }
  state.bombs = kept;
}

function moveUfo(state) {
  if (state.ufo) {
    state.ufo.x += state.ufo.dir * 0.75;
    if (state.ufo.x < -16 || state.ufo.x > W) state.ufo = null;
  } else if (--state.ufoTimer <= 0) {
    const dir = state.rng() < 0.5 ? 1 : -1;
    state.ufo = { x: dir > 0 ? -16 : W, dir, points: UFO_POINTS[Math.floor(state.rng() * 4) % 4] };
    state.ufoTimer = Math.floor(900 + state.rng() * 600);
  }
}

/** One fixed tick. Mutates state. */
export function update(state, input, dt = STEP) {
  if (state.phase === 'ready') { if (input.start) state.phase = 'playing'; return; }
  if (state.phase === 'gameover') {
    if (input.start) {
      Object.assign(state, { score: 0, lives: 3, level: 1, extraLife: false, phase: 'ready' });
      state.player.x = (W - PLAYER_W) / 2;
      startLevel(state);
    }
    return;
  }
  if (state.phase === 'dying') {
    if (--state.dyingTimer <= 0) state.phase = 'playing';
    return;
  }

  const p = state.player;
  const speed = 90 * dt;
  p.x = Math.min(W - p.w, Math.max(0, p.x + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * speed));
  if (input.fire && !state.bullet) state.bullet = { x: Math.floor(p.x + p.w / 2), y: p.y - 4 };

  if (state.bullet) moveBullet(state);
  if (--state.stepTimer <= 0) {
    marchInvaders(state);
    state.stepTimer = stepInterval(state.invaders.filter((i) => i.alive).length, state.level);
    if (state.phase !== 'playing') return;
  }
  spawnBomb(state);
  moveBombs(state);
  moveUfo(state);

  // Player death wins over a same-tick level clear; clear is re-checked once playing resumes.
  if (state.phase === 'playing' && !state.invaders.some((i) => i.alive)) {
    state.level++;
    startLevel(state);
  }
}
