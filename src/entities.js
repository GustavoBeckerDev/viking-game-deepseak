import { GRAVITY, MAX_FALL, TILE, isSolid } from './constants.js';
import { moveX, moveY, tileBelow, rectsOverlap } from './physics.js';
import {
  drawDraugr,
  drawRaven,
  drawMaterial,
  drawBeer,
  drawTorch,
  drawCheckpoint,
  drawGoal,
  drawCauldron,
  drawAlert,
} from './sprites.js';

function ensureEnemyState(e) {
  if (e.state === undefined) e.state = 'patrol';
  if (e.stateT === undefined) e.stateT = 0;
  if (e.attackCd === undefined) e.attackCd = 0;
  if (e.alertT === undefined) e.alertT = 0;
  if (e.struck === undefined) e.struck = false;
  if (e.deathKind === undefined) e.deathKind = null;
  if (e.diveVX === undefined) e.diveVX = 0;
  if (e.diveVY === undefined) e.diveVY = 0;
}

export function updateEntities(game, dt) {
  const level = game.level;
  const player = game.player;
  const playing = game.state === 'playing' && !player.dead;

  for (const e of level.entities) {
    switch (e.type) {
      case 'draugr':
        updateDraugr(game, e, dt);
        break;
      case 'raven':
        updateRaven(game, e, dt);
        break;
      case 'mat':
        if (!e.taken && playing && rectsOverlap(player, e)) game.collectMaterial(e);
        break;
      case 'beer':
        if (!e.taken && playing && rectsOverlap(player, e)) game.collectBeer(e);
        break;
      case 'cauldron':
        if (e.cooldown > 0) e.cooldown = Math.max(0, e.cooldown - dt);
        if (playing && e.cooldown <= 0 && rectsOverlap(player, e) && game.input.wasPressed('down')) {
          game.tryBrew(e);
        }
        break;
      case 'checkpoint':
        if (playing && rectsOverlap(player, e)) game.activateCheckpoint(e);
        break;
      case 'goal':
        if (playing && rectsOverlap(player, { x: e.x + 14, y: e.y + 18, w: 36, h: 62 })) {
          game.completeLevel();
        }
        break;
      default:
        break;
    }
  }
}

function updateDraugr(game, e, dt) {
  if (e.dead) {
    e.deathT -= dt;
    return;
  }
  ensureEnemyState(e);
  const level = game.level;
  const player = game.player;
  const playing = game.state === 'playing' && !player.dead;

  e.phase += dt * 3.2;
  e.attackCd = Math.max(0, e.attackCd - dt);
  e.alertT = Math.max(0, e.alertT - dt);

  const dx = player.cx - (e.x + e.w / 2);
  const dy = player.cy - (e.y + e.h / 2);
  const sees = playing && Math.abs(dx) < 78 && Math.abs(dy) < 46;

  if (e.state === 'windup') {
    e.stateT -= dt;
    e.vx = 0;
    e.dir = Math.sign(dx) || e.dir;
    e.alertT = Math.max(e.alertT, 0.08);
    if (e.stateT <= 0) {
      e.state = 'strike';
      e.stateT = 0.2;
      e.struck = false;
      game.sfx.play('attack');
    }
  } else if (e.state === 'strike') {
    e.stateT -= dt;
    e.vx = e.dir * 58;
    const hb = e.dir > 0
      ? { x: e.x + e.w - 3, y: e.y + 2, w: 23, h: e.h - 2 }
      : { x: e.x - 20, y: e.y + 2, w: 23, h: e.h - 2 };
    if (!e.struck && playing && rectsOverlap(hb, player)) {
      e.struck = true;
      player.damage(1, e.x + e.w / 2, game);
    }
    if (e.stateT <= 0) {
      e.state = 'recover';
      e.stateT = 0.52;
    }
  } else if (e.state === 'recover') {
    e.stateT -= dt;
    e.vx = 0;
    if (e.stateT <= 0) {
      e.state = 'patrol';
      e.attackCd = 0.85;
    }
  } else {
    if (sees && e.attackCd <= 0) {
      e.state = 'windup';
      e.stateT = 0.58;
      e.alertT = 0.72;
      e.dir = Math.sign(dx) || e.dir;
      e.vx = 0;
      game.sfx.play('warn');
    } else if (sees) {
      e.dir = Math.sign(dx) || e.dir;
      e.vx = Math.abs(dx) < 26 ? 0 : e.dir * 26;
    } else {
      e.vx = e.dir * 28;
    }
  }

  e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
  moveX(level, e, e.vx * dt);
  if (e.hitWall && e.state === 'patrol') e.dir *= -1;
  moveY(level, e, e.vy * dt);

  if (e.grounded) {
    const probeX = e.x + (e.dir > 0 ? e.w + 3 : -3);
    if (!isSolid(tileBelow(level, probeX, e.y + e.h + 4)) && e.state === 'patrol') e.dir *= -1;
  }

  if (e.y > level.h * TILE + 60) e.dead = true;
}

function updateRaven(game, e, dt) {
  if (e.dead) {
    e.deathT -= dt;
    return;
  }
  ensureEnemyState(e);
  const level = game.level;
  const player = game.player;
  const playing = game.state === 'playing' && !player.dead;

  e.phase += dt;
  e.attackCd = Math.max(0, e.attackCd - dt);
  e.alertT = Math.max(0, e.alertT - dt);

  const dx = player.cx - (e.x + e.w / 2);
  const dy = player.cy - (e.y + e.h / 2);

  if (e.state === 'windup') {
    e.stateT -= dt;
    e.alertT = Math.max(e.alertT, 0.08);
    e.dir = Math.sign(dx) || e.dir;
    e.y = e.baseY + Math.sin(e.phase * 8) * 1;
    if (e.stateT <= 0) {
      e.state = 'dive';
      e.stateT = 0.5;
      e.struck = false;
      const len = Math.hypot(dx, dy) || 1;
      e.diveVX = (dx / len) * 225;
      e.diveVY = (dy / len) * 225;
      game.sfx.play('screech');
    }
  } else if (e.state === 'dive') {
    e.stateT -= dt;
    e.x += e.diveVX * dt;
    e.y += e.diveVY * dt;
    e.dir = Math.sign(e.diveVX) || e.dir;
    if (!e.struck && playing && rectsOverlap(player, e)) {
      e.struck = true;
      player.damage(1, e.x + e.w / 2, game);
    }
    if (e.stateT <= 0) {
      e.state = 'return';
      e.stateT = 0.9;
    }
  } else if (e.state === 'return') {
    e.stateT -= dt;
    e.x += (e.spawnX - e.x) * Math.min(1, dt * 2.4);
    e.y += (e.baseY - e.y) * Math.min(1, dt * 4);
    if (e.stateT <= 0) {
      e.state = 'circle';
      e.attackCd = 1.5;
    }
  } else {
    e.x += e.dir * 26 * dt;
    if (e.x < e.spawnX - 64) e.dir = 1;
    if (e.x > e.spawnX + 64) e.dir = -1;
    if (playing && Math.abs(dx) < 88 && Math.abs(dy) < 84 && e.attackCd <= 0) {
      e.state = 'windup';
      e.stateT = 0.62;
      e.alertT = 0.78;
      e.dir = Math.sign(dx) || e.dir;
      game.sfx.play('warn');
    }
    e.y = e.baseY + Math.sin(e.phase * 2.2) * 9;
  }

  if (e.y > level.h * TILE + 80) e.dead = true;
}

export function drawEntities(ctx, game) {
  const order = {
    goal: 0,
    cauldron: 1,
    torch: 2,
    checkpoint: 3,
    beer: 4,
    mat: 4,
    raven: 5,
    draugr: 6,
  };
  const list = game.level.entities
    .slice()
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

  for (const e of list) {
    switch (e.type) {
      case 'draugr':
        if (e.dead) {
          if (e.deathT <= 0) continue;
          ctx.save();
          ctx.globalAlpha = Math.max(0, e.deathT * 2);
          const fall = e.deathKind === 'roll' || e.deathKind === 'axe'
            ? Math.min(1, (0.7 - e.deathT) / 0.22)
            : 0;
          ctx.translate(e.x + e.w / 2, e.y + e.h);
          ctx.rotate(fall * (Math.PI / 2) * (e.dir || 1));
          drawDraugr(ctx, 0, 0, { facing: e.dir, phase: e.phase, state: 'dead' });
          ctx.restore();
        } else {
          drawDraugr(ctx, e.x + e.w / 2, e.y + e.h, {
            facing: e.dir,
            phase: e.phase,
            state: e.state,
            stateT: e.stateT,
            alertT: e.alertT,
            vx: e.vx,
          });
          if (e.alertT > 0) drawAlert(ctx, e.x + e.w / 2, e.y - 8, game.time, e.state === 'windup');
        }
        break;
      case 'raven':
        if (e.dead) {
          if (e.deathT <= 0) continue;
          ctx.save();
          ctx.globalAlpha = Math.max(0, e.deathT * 2);
          drawRaven(ctx, e.x + e.w / 2, e.y + e.h / 2, e.phase, e.dir, e.state);
          ctx.restore();
        } else {
          drawRaven(ctx, e.x + e.w / 2, e.y + e.h / 2, e.phase, e.dir, e.state);
          if (e.alertT > 0) drawAlert(ctx, e.x + e.w / 2, e.y - 8, game.time, e.state === 'windup');
        }
        break;
      case 'mat':
        if (!e.taken) drawMaterial(ctx, e.mat, e.x + 5, e.y + 5, game.time);
        break;
      case 'beer':
        if (!e.taken) drawBeer(ctx, e.x + 7, e.y + 9, e.beer, game.time);
        break;
      case 'torch':
        drawTorch(ctx, e.x + 4, e.y + e.h, game.time, e.seed);
        break;
      case 'checkpoint':
        drawCheckpoint(ctx, e.x, e.y + e.h, game.time, e.active);
        break;
      case 'cauldron': {
        const near = Math.abs(game.player.cx - (e.x + e.w / 2)) < 34
          && Math.abs(game.player.cy - (e.y + e.h / 2)) < 40;
        drawCauldron(ctx, e.x + e.w / 2, e.y + e.h, game.time, game.materialsTotal >= 3, near);
        break;
      }
      case 'goal':
        drawGoal(ctx, e.x, e.y + e.h, game.time);
        break;
      default:
        break;
    }
  }
}

export function resetEnemies(level) {
  for (const e of level.entities) {
    if (e.type === 'draugr' || e.type === 'raven') {
      ensureEnemyState(e);
      e.dead = false;
      e.deathT = 0;
      e.deathKind = null;
      e.x = e.spawnX;
      e.y = e.spawnY;
      e.vx = 0;
      e.vy = 0;
      if (e.baseY !== undefined) e.baseY = e.spawnY;
      e.dir = Math.random() < 0.5 ? -1 : 1;
      e.state = e.type === 'raven' ? 'circle' : 'patrol';
      e.stateT = 0;
      e.attackCd = 0.4;
      e.alertT = 0;
      e.struck = false;
      e.diveVX = 0;
      e.diveVY = 0;
    }
  }
}
