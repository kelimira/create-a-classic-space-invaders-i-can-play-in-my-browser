import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createGame, update, stepInterval, stepsFor, parseHighScore, W, STEP } from '../src/game.js';

const none = { left: false, right: false, fire: false, start: false };
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const playing = (opts) => { const g = createGame({ rng: seeded(), ...opts }); update(g, { ...none, start: true }); return g; };
const run = (g, n, input = none) => { for (let i = 0; i < n; i++) update(g, input); };
const cells = (g) => g.shields.reduce((a, s) => a + s.cells.flat().reduce((x, y) => x + y, 0), 0);

test('AC-2 player clamped at both bounds', () => {
  const g = playing();
  run(g, 400, { ...none, left: true });
  assert.equal(g.player.x, 0);
  run(g, 400, { ...none, right: true });
  assert.equal(g.player.x, W - g.player.w);
});

test('AC-3 single bullet; despawns at top; can refire', () => {
  const g = playing();
  update(g, { ...none, fire: true });
  const first = g.bullet, y0 = first.y;
  update(g, { ...none, fire: true });
  assert.ok(first && g.bullet && g.bullet === first && g.bullet.y < y0, 'second fire does not spawn a new bullet');
  g.invaders.forEach((i) => (i.alive = false)); g.invaders[0].alive = true; g.invaders[0].x = 0; g.invaders[0].y = 100;
  g.bullet.x = 200;
  run(g, 100);
  assert.equal(g.bullet, null);
  update(g, { ...none, fire: true });
  assert.ok(g.bullet);
});

test('AC-4 55 invaders march, drop and reverse; speed rises', () => {
  const g = playing();
  assert.equal(g.invaders.length, 55);
  const x0 = g.invaders[0].x, y0 = g.invaders[0].y;
  run(g, stepInterval(55) + 1);
  assert.notEqual(g.invaders[0].x, x0);
  run(g, 1500);
  assert.ok(g.invaders[0].y > y0 || g.phase !== 'playing');
  assert.ok(stepInterval(1) < stepInterval(55));
});

test('AC-5 scoring by row, invader removed, bullet consumed', () => {
  for (const [row, pts] of [[0, 30], [1, 20], [4, 10]]) {
    const g = playing();
    const inv = g.invaders.find((i) => i.row === row && i.col === 5);
    g.bullet = { x: inv.x + 5, y: inv.y + 6 };
    update(g, none);
    assert.equal(g.score, pts);
    assert.equal(inv.alive, false);
    assert.equal(g.bullet, null);
  }
});

test('AC-6 at most 3 bombs; bomb on player costs a life', () => {
  const g = playing({ highScore: 0 });
  g.lives = 1e9;
  let max = 0;
  for (let i = 0; i < 2000; i++) { update(g, none); max = Math.max(max, g.bombs.length); }
  assert.ok(max >= 1 && max <= 3);
  const h = playing();
  assert.equal(h.lives, 3);
  h.bombs = [{ x: h.player.x + 5, y: h.player.y - 2 }];
  update(h, none);
  assert.equal(h.lives, 2);
  assert.equal(h.phase, 'dying');
});

test('AC-7 bullet and bomb erode shields', () => {
  const g = playing();
  const before = cells(g);
  const s = g.shields[0];
  g.bullet = { x: s.x + 3, y: s.y + 20 };
  run(g, 5);
  const afterBullet = cells(g);
  assert.ok(afterBullet < before);
  g.bombs = [{ x: s.x + 15, y: s.y - 4 }];
  run(g, 5);
  assert.ok(cells(g) < afterBullet);
});

test('AC-8 UFO spawns and awards valid points', () => {
  const g = playing({ rng: () => 0.3 });
  g.ufoTimer = 0;
  update(g, none);
  assert.ok(g.ufo);
  g.bullet = { x: Math.round(g.ufo.x) + 8, y: 30 };
  update(g, none);
  assert.ok([50, 100, 150, 300].includes(g.score));
  assert.equal(g.ufo, null);
});

test('AC-9 clearing all invaders advances level, keeps score', () => {
  const g = playing();
  g.score = 120;
  g.invaders.forEach((i) => (i.alive = false));
  update(g, none);
  assert.equal(g.level, 2);
  assert.equal(g.score, 120);
  assert.equal(g.invaders.filter((i) => i.alive).length, 55);
});

test('death on the clearing tick wins over level advance', () => {
  const g = playing();
  g.invaders.forEach((i) => (i.alive = false));
  g.bombs = [{ x: g.player.x + 5, y: g.player.y }];
  update(g, none);
  assert.equal(g.phase, 'dying');
  assert.equal(g.level, 1);
});

test('AC-10 game over on 0 lives or invaders reaching line; start restarts', () => {
  const g = playing();
  g.lives = 1;
  g.bombs = [{ x: g.player.x + 5, y: g.player.y }];
  update(g, none);
  assert.equal(g.phase, 'gameover');
  g.score = 77; g.highScore = 77;
  update(g, { ...none, start: true });
  assert.equal(g.phase, 'ready');
  assert.equal(g.score, 0);
  assert.equal(g.highScore, 77);
  update(g, { ...none, start: true });
  assert.equal(g.phase, 'playing');

  const h = playing();
  h.invaders.forEach((i) => (i.y = 230));
  h.stepTimer = 1;
  update(h, none);
  assert.equal(h.phase, 'gameover');
});

test('dying phase resumes playing', () => {
  const g = playing();
  g.bombs = [{ x: g.player.x + 5, y: g.player.y }];
  update(g, none);
  run(g, 61);
  assert.equal(g.phase, 'playing');
});

test('extra life awarded once at 1500', () => {
  const g = playing();
  g.score = 1490;
  g.bullet = { x: g.invaders[0].x + 5, y: g.invaders[0].y + 6 };
  update(g, none);
  assert.equal(g.lives, 4);
  g.score = 1490;
  g.bullet = { x: g.invaders[11].x + 5, y: g.invaders[11].y + 6 };
  update(g, none);
  assert.equal(g.lives, 4);
});

test('AC-12 deterministic; stepsFor capped', () => {
  const sim = () => {
    const g = playing({ rng: seeded(42) });
    for (let i = 0; i < 600; i++) update(g, { ...none, right: i % 50 < 25, left: i % 50 >= 25, fire: i % 7 === 0 });
    return JSON.stringify(g);
  };
  assert.equal(sim(), sim());
  assert.equal(stepsFor(3 * STEP), 3);
  assert.equal(stepsFor(100), 5);
  assert.equal(stepsFor(-1), 0);
});

test('AC-11 parseHighScore validates', () => {
  for (const bad of [NaN, -1, 1.5, 'abc', '-5', '1e3', '9999999999', null, undefined, {}, Infinity]) assert.equal(parseHighScore(bad), 0);
  assert.equal(parseHighScore('1234'), 1234);
  assert.equal(parseHighScore(50), 50);
});

test('AC-14 static security checks', () => {
  const files = ['index.html', ...readdirSync('src').map((f) => `src/${f}`)];
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    assert.ok(!/innerHTML|eval\(|https?:\/\//.test(t), `${f} has forbidden construct`);
  }
  assert.match(readFileSync('index.html', 'utf8'), /Content-Security-Policy/);
});
