import { W, H, INV_W, SHIELD_W, SHIELD_H } from './game.js';

const SPRITES = {
  invader: [
    [ '00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000' ],
    [ '00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010' ],
  ],
  player: [ '0000001000000', '0000011100000', '0000011100000', '0111111111110', '1111111111111', '1111111111111', '1111111111111', '1111111111111' ],
  ufo: [ '0000111111000000', '0011111111110000', '0111111111111000', '1101101101101100', '1111111111111100', '0011100011100000', '0001000001000000' ],
};
const COLORS = ['#f55', '#ff5', '#ff5', '#5ff', '#5ff'];

function blit(ctx, bitmap, x, y) {
  for (let r = 0; r < bitmap.length; r++)
    for (let c = 0; c < bitmap[r].length; c++)
      if (bitmap[r][c] === '1') ctx.fillRect(Math.round(x) + c, y + r, 1, 1);
}

export function draw(ctx, state) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#4f4';
  for (const s of state.shields)
    for (let r = 0; r < SHIELD_H; r++)
      for (let c = 0; c < SHIELD_W; c++)
        if (s.cells[r][c]) ctx.fillRect(s.x + c, s.y + r, 1, 1);

  for (const i of state.invaders) {
    if (!i.alive) continue;
    ctx.fillStyle = COLORS[i.row];
    blit(ctx, SPRITES.invader[state.frame], i.x, i.y);
  }
  if (state.ufo) { ctx.fillStyle = '#f5f'; blit(ctx, SPRITES.ufo, state.ufo.x, 24); }

  if (state.phase !== 'gameover' && (state.phase !== 'dying' || state.dyingTimer % 10 < 5)) {
    ctx.fillStyle = '#4f4';
    blit(ctx, SPRITES.player, state.player.x, state.player.y);
  }
  ctx.fillStyle = '#fff';
  if (state.bullet) ctx.fillRect(state.bullet.x, state.bullet.y, 1, 4);
  for (const b of state.bombs) ctx.fillRect(b.x, b.y, 3, 6);

  ctx.fillRect(0, 248, W, 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${state.score}`, 4, 4);
  ctx.fillText(`LEVEL ${state.level}`, 4, 14);
  ctx.textAlign = 'right';
  ctx.fillText(`HI ${state.highScore}`, W - 4, 4);
  ctx.textAlign = 'left';
  ctx.fillText(`LIVES ${state.lives}`, 4, 249 - 0);
  ctx.textAlign = 'center';
  if (state.phase === 'ready') ctx.fillText('SPACE INVADERS - PRESS ENTER', W / 2, 150);
  if (state.phase === 'gameover') ctx.fillText('GAME OVER - PRESS ENTER', W / 2, 150);
}
