import { VIEW_W, VIEW_H, TILE, T, THEMES, isSolid } from './constants.js';
import { drawText, textWidth } from './font.js';
import {
  drawHeart,
  drawPine,
  drawRuin,
  drawRock,
  drawLongship,
  drawMaterialIcon,
  drawBeerIcon,
  drawAxeIcon,
  drawAxeProjectile,
} from './sprites.js';
import { MATERIAL_ORDER, MATERIALS, BEERS } from './beers.js';
import { drawEntities } from './entities.js';

function R(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const rampCache = new Map();
function skyColor(theme, t) {
  let ramp = rampCache.get(theme);
  if (!ramp) {
    ramp = theme.sky.map(hexRgb);
    rampCache.set(theme, ramp);
  }
  const scaled = t * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(scaled));
  return mix(ramp[i], ramp[i + 1], scaled - i);
}

export function renderGame(ctx, game) {
  const theme = THEMES[game.level.theme];
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  drawBackground(ctx, game, theme);

  const cam = game.camera;
  ctx.save();
  ctx.translate(
    -Math.round(cam.x) + game.shakeX + Math.round(game.swayX || 0),
    -Math.round(cam.y) + game.shakeY + Math.round(game.swayY || 0)
  );
  drawDecor(ctx, game, theme);
  drawTiles(ctx, game, theme);
  drawEntities(ctx, game);
  drawProjectiles(ctx, game);
  drawPlayerAura(ctx, game);
  game.player.draw(ctx);
  drawShield(ctx, game);
  drawParticles(ctx, game);
  drawLights(ctx, game);
  ctx.restore();

  drawWeather(ctx, game, theme);
  drawBeerTint(ctx, game);
  drawVignette(ctx);
  drawDangerEdge(ctx, game);
  drawHUD(ctx, game);
  drawFlash(ctx, game);
}

/* ------------------------------------------------------------ background -- */

function drawBackground(ctx, game, theme) {
  const cam = game.camera;
  const t = game.time;

  const bands = 30;
  for (let i = 0; i < bands; i++) {
    const f = i / (bands - 1);
    const [r, g, b] = skyColor(theme, Math.pow(f, 0.85));
    R(ctx, 0, (i * VIEW_H) / bands, VIEW_W, VIEW_H / bands + 1, `rgb(${r},${g},${b})`);
  }

  if (theme.stars > 0) {
    for (let i = 0; i < 90; i++) {
      const sx = ((hash(i, 3) * VIEW_W - cam.x * 0.015) % VIEW_W + VIEW_W) % VIEW_W;
      const sy = hash(i, 7) * VIEW_H * 0.6;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + i * 1.7));
      ctx.globalAlpha = theme.stars * tw * 0.9;
      R(ctx, sx, sy, hash(i, 9) > 0.85 ? 2 : 1, 1, '#eaf2ff');
    }
    ctx.globalAlpha = 1;
  }

  if (theme.aurora) drawAurora(ctx, cam, t);

  drawSun(ctx, theme, cam, t);

  // clouds
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 127 - cam.x * 0.03 + t * (2 + i * 0.3)) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
    const cy = 34 + hash(i, 4) * 60;
    ctx.globalAlpha = 0.05 + hash(i, 6) * 0.04;
    R(ctx, cx, cy, 46, 3, '#ffffff');
    R(ctx, cx + 8, cy - 3, 26, 3, '#ffffff');
    R(ctx, cx + 16, cy + 3, 20, 2, '#ffffff');
  }
  ctx.restore();

  // mountains
  const layers = [
    { p: 0.04, base: 158, amp: 46, color: theme.mountains[3], snow: 118, seed: 1 },
    { p: 0.09, base: 190, amp: 38, color: theme.mountains[2], snow: 154, seed: 7 },
    { p: 0.17, base: 218, amp: 28, color: theme.mountains[1], snow: 0, seed: 13 },
  ];
  for (const layer of layers) drawMountain(ctx, cam, layer);

  if (game.level.index === 0) {
    const shipX = 312 - cam.x * 0.055;
    if (shipX > -80 && shipX < VIEW_W + 80) {
      drawLongship(ctx, shipX, 216, 0.9, theme.mountains[0]);
    }
  }

  // distant pines on the horizon
  const step = 52;
  const start = Math.floor((cam.x * 0.32) / step) * step;
  for (let wx = start; wx < start + VIEW_W + step * 2; wx += step) {
    const sx = wx - cam.x * 0.32;
    const h = 24 + hash(wx, 21) * 26;
    drawPine(ctx, sx, 226, h, wx, theme.pines, '#cfd9e6');
  }

  // fog bands
  const fogY = 186 - cam.y * 0.2;
  ctx.save();
  ctx.globalAlpha = 0.07;
  R(ctx, 0, fogY, VIEW_W, 34, theme.fog);
  ctx.globalAlpha = 0.05;
  R(ctx, 0, fogY + 26, VIEW_W, 22, theme.fog);
  ctx.restore();
}

function drawAurora(ctx, cam, t) {
  const colors = ['#45e0a0', '#3fb8e0', '#9a6be0'];
  ctx.save();
  for (let band = 0; band < 3; band++) {
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = colors[band];
    for (let x = 0; x < VIEW_W; x += 2) {
      const wx = x + cam.x * 0.02 + t * (3 + band);
      const y = 26 + band * 17 + Math.sin(wx * 0.018 + t * 0.5 + band * 1.7) * 9
        + Math.sin(wx * 0.05 - t * 0.3) * 3;
      const h = 12 + Math.sin(wx * 0.03 + band * 2) * 7;
      ctx.fillRect(x, y, 2, h);
    }
  }
  ctx.restore();
}

function drawSun(ctx, theme, cam, t) {
  const sun = theme.sun;
  const x = sun.x - cam.x * 0.008;
  const y = sun.y - cam.y * 0.05;
  ctx.save();
  for (let i = 5; i > 0; i--) {
    ctx.globalAlpha = 0.035 * (6 - i);
    ctx.fillStyle = sun.glow;
    ctx.beginPath();
    ctx.arc(x, y, sun.r + i * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = sun.color;
  for (let dy = -sun.r; dy <= sun.r; dy++) {
    const span = Math.floor(Math.sqrt(Math.max(0, sun.r * sun.r - dy * dy)));
    ctx.fillRect(Math.round(x - span), Math.round(y + dy), span * 2 + 1, 1);
  }

  if (theme.aurora) {
    R(ctx, x - 10, y - 8, 5, 4, 'rgba(150,170,200,0.5)');
    R(ctx, x + 5, y + 3, 7, 5, 'rgba(150,170,200,0.45)');
    R(ctx, x - 3, y + 10, 4, 3, 'rgba(150,170,200,0.4)');
    R(ctx, x - 12, y + 2, 3, 3, 'rgba(150,170,200,0.35)');
  } else {
    R(ctx, x - 12, y + 4, 20, 2, 'rgba(255,235,200,0.25)');
    R(ctx, x - 4, y - 10, 16, 2, 'rgba(255,235,200,0.2)');
  }
}

function ridge(worldX, base, amp, seed) {
  const a = Math.sin(worldX * 0.0045 + seed) * 0.5 + 0.5;
  const b = Math.sin(worldX * 0.012 + seed * 2.3) * 0.5 + 0.5;
  const c = Math.sin(worldX * 0.0017 + seed * 4.1) * 0.5 + 0.5;
  return base - (a * 0.6 + b * 0.25 + c * 0.4) * amp;
}

function drawMountain(ctx, cam, layer) {
  const offset = cam.x * layer.p;
  const pts = [];
  for (let x = -8; x <= VIEW_W + 8; x += 6) {
    const y = ridge(x + offset, layer.base, layer.amp, layer.seed);
    pts.push([x, y]);
  }

  ctx.beginPath();
  ctx.moveTo(-8, VIEW_H);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(VIEW_W + 8, VIEW_H);
  ctx.closePath();
  ctx.fillStyle = layer.color;
  ctx.fill();

  if (layer.snow > 0) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(226,235,246,0.82)';
    for (let x = -8; x < VIEW_W + 8; x += 4) {
      const jitter = Math.floor(hash(x, layer.seed) * 7);
      ctx.fillRect(x, 0, 4, layer.snow + jitter);
    }
    ctx.restore();
  }
}

/* ----------------------------------------------------------------- world -- */

function drawDecor(ctx, game, theme) {
  const cam = game.camera;
  for (const d of game.level.decor) {
    if (d.x < cam.x - 140 || d.x > cam.x + VIEW_W + 140) continue;
    if (d.kind === 'pine') drawPine(ctx, d.x, d.y, d.h, d.seed, theme.pines, '#dfe8f2');
    else if (d.kind === 'ruin') drawRuin(ctx, d.x, d.y, d.h, d.seed, '#dfe8f2');
    else if (d.kind === 'rock') drawRock(ctx, d.x, d.y, d.r, d.seed, '#dfe8f2');
  }
}

function drawTiles(ctx, game, theme) {
  const level = game.level;
  const cam = game.camera;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const x1 = Math.min(level.w - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const y1 = Math.min(level.h - 1, Math.ceil((cam.y + VIEW_H) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.get(tx, ty);
      if (t === T.EMPTY) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const above = level.get(tx, ty - 1);
      if (t === T.ROCK) {
        drawRockTile(ctx, x, y, tx, ty, above);
      } else if (t === T.SNOW) {
        drawRockTile(ctx, x, y, tx, ty, above);
        if (!isSolid(above)) drawSnowCap(ctx, x, y, tx, ty);
      } else if (t === T.WOOD) {
        drawWoodTile(ctx, x, y, tx, ty, above);
      } else if (t === T.ICE) {
        drawIceTile(ctx, x, y, tx, ty, above);
      } else if (t === T.SPIKE) {
        drawSpikeTile(ctx, x, y, tx, ty);
      } else if (t === T.WATER) {
        drawWaterTile(ctx, x, y, tx, ty, game.time, above);
      }
    }
  }
}

function drawRockTile(ctx, x, y, tx, ty, above) {
  const n = hash(tx, ty);
  const base = n > 0.66 ? '#48505f' : n > 0.33 ? '#424a58' : '#3c4351';
  R(ctx, x, y, 16, 16, base);
  R(ctx, x, y, 2, 16, '#4d5665');
  R(ctx, x + 13, y, 3, 16, '#333a47');

  if (n > 0.5) {
    R(ctx, x + 3, y + 6, 4, 3, '#4f5868');
    R(ctx, x + 3, y + 9, 4, 1, '#343b48');
    R(ctx, x + 4, y + 6, 2, 1, '#5a6475');
  }
  if (n < 0.42) {
    R(ctx, x + 9, y + 9, 4, 4, '#39404e');
    R(ctx, x + 9, y + 9, 4, 1, '#505a6a');
    R(ctx, x + 10, y + 11, 1, 1, '#2c3340');
  }
  if (n > 0.72) {
    R(ctx, x + 6, y + 2, 1, 5, '#2c3340');
    R(ctx, x + 7, y + 7, 2, 1, '#2c3340');
    R(ctx, x + 9, y + 8, 1, 2, '#2c3340');
  }
  if (n < 0.22) {
    R(ctx, x + 1, y + 11, 2, 1, '#3f5a45');
    R(ctx, x + 2, y + 12, 1, 1, '#4c6b52');
    R(ctx, x + 12, y + 3, 1, 1, '#3f5a45');
  }
  if (isSolid(above)) {
    R(ctx, x, y, 16, 1, '#2f3542');
  }
}

function drawSnowCap(ctx, x, y, tx, ty) {
  const capH = 4 + Math.floor(hash(tx, ty + 77) * 3);
  for (let i = 0; i < 16; i++) {
    const hh = capH + (hash(tx * 17 + i, ty * 5) > 0.55 ? 1 : 0);
    R(ctx, x + i, y, 1, hh, '#dfe8f2');
  }
  R(ctx, x, y, 16, 1, '#ffffff');
  R(ctx, x, y + 1, 3, 1, '#f2f7fc');
  R(ctx, x + 12, y + 1, 2, 1, '#f2f7fc');
  R(ctx, x, y + capH, 16, 1, '#b9c7d8');
  if (hash(tx, ty + 5) > 0.7) {
    R(ctx, x + 4, y + capH + 1, 1, 1, '#dfe8f2');
    R(ctx, x + 10, y + capH + 1, 2, 1, '#dfe8f2');
  }
  if (hash(tx, ty + 9) > 0.82) R(ctx, x + 8, y + 1, 1, 1, '#ffffff');
}

function drawWoodTile(ctx, x, y, tx, ty, above) {
  R(ctx, x, y, 16, 16, '#6b4226');
  R(ctx, x, y, 16, 2, '#8a5a32');
  R(ctx, x, y, 16, 1, '#a3703f');
  R(ctx, x, y + 6, 16, 1, '#4e2f1a');
  R(ctx, x, y + 12, 16, 1, '#4e2f1a');
  R(ctx, x + 14, y, 2, 16, '#4a2c18');
  R(ctx, x, y + 15, 16, 1, '#3a2212');
  R(ctx, x + 2, y + 3, 5, 1, '#875531');
  R(ctx, x + 9, y + 4, 4, 1, '#7d4d2c');
  R(ctx, x + 4, y + 9, 6, 1, '#875531');
  R(ctx, x + 8, y + 14, 5, 1, '#7d4d2c');
  R(ctx, x + 2, y + 2, 1, 1, '#c3cedb');
  R(ctx, x + 13, y + 8, 1, 1, '#aab5c4');
  R(ctx, x + 2, y + 13, 1, 1, '#aab5c4');
  if (!isSolid(above)) {
    R(ctx, x, y, 16, 1, '#eef4fb');
    R(ctx, x + 2, y + 1, 5, 1, '#e8eef5');
    R(ctx, x + 11, y + 1, 3, 1, '#e8eef5');
  }
}

function drawIceTile(ctx, x, y, tx, ty, above) {
  R(ctx, x, y, 16, 16, '#6fa8cc');
  R(ctx, x, y, 16, 2, '#a8d6ee');
  R(ctx, x, y + 14, 16, 2, '#4f7fa3');
  R(ctx, x + 13, y, 3, 16, '#5c90b4');
  R(ctx, x + 2, y + 3, 2, 7, '#bfe2f2');
  R(ctx, x + 2, y + 3, 1, 4, '#e6f6ff');
  R(ctx, x + 5, y + 7, 1, 1, '#ffffff');
  R(ctx, x + 9, y + 3, 1, 6, '#4f7fa3');
  R(ctx, x + 10, y + 9, 2, 1, '#4f7fa3');
  R(ctx, x + 12, y + 12, 2, 1, '#8fc4de');
  if (!isSolid(above)) R(ctx, x, y, 16, 1, '#dff3ff');
}

function drawSpikeTile(ctx, x, y, tx, ty) {
  R(ctx, x, y + 13, 16, 3, '#2c3340');
  R(ctx, x, y + 13, 16, 1, '#3d4553');
  for (let i = 0; i < 3; i++) {
    const sx = x + i * 5 + 1;
    R(ctx, sx + 1, y + 3, 2, 1, '#eef4fb');
    R(ctx, sx, y + 4, 4, 2, '#c3cedb');
    R(ctx, sx - 1, y + 6, 6, 3, '#9aa7b8');
    R(ctx, sx - 1, y + 9, 6, 4, '#7c8798');
    R(ctx, sx, y + 12, 4, 2, '#5b6576');
    R(ctx, sx, y + 6, 1, 6, '#dfe8f2');
    R(ctx, sx + 2, y + 5, 1, 2, '#ffffff');
  }
}

function drawWaterTile(ctx, x, y, tx, ty, time, above) {
  R(ctx, x, y, 16, 4, '#2a5c80');
  R(ctx, x, y + 4, 16, 4, '#1f4a6c');
  R(ctx, x, y + 8, 16, 4, '#193d5b');
  R(ctx, x, y + 12, 16, 4, '#142f48');

  const ca = Math.sin(time * 1.7 + tx * 0.8 + ty * 1.4);
  if (ca > 0.35) {
    R(ctx, x + 2, y + 5, 5, 1, '#2c6688');
    R(ctx, x + 9, y + 9, 4, 1, '#255a7a');
  }
  if (ca < -0.5) {
    R(ctx, x + 5, y + 11, 6, 1, '#16334d');
    R(ctx, x + 1, y + 7, 4, 1, '#16334d');
  }
  if (hash(tx, ty) > 0.9) R(ctx, x + 5, y + 12, 1, 1, '#2f6f94');

  if (!isSolid(above) && above !== T.WATER) {
    R(ctx, x, y + 2, 16, 2, '#245474');
    for (let i = 0; i < 16; i++) {
      const wy = Math.round(Math.sin(time * 2.4 + (tx * 16 + i) * 0.18) * 1.5);
      R(ctx, x + i, y + wy, 1, 3, '#2f6f94');
      if (i % 4 === 0) R(ctx, x + i, y + wy, 1, 1, '#7fc4e8');
      if (i % 7 === 0) R(ctx, x + i, y + wy + 2, 1, 1, '#4f8fb8');
    }
    const sp = Math.floor((time * 10 + tx * 5) % 16);
    R(ctx, x + sp, y + 1, 2, 1, '#a8e0f2');
    R(ctx, x + ((sp + 7) % 16), y + 2, 1, 1, '#8fd0e6');

    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 3; i++) {
      const rx = x + 3 + i * 5 + Math.sin(time * 1.4 + i) * 1;
      R(ctx, rx, y + 4, 1, 7, '#8fd0e6');
    }
    ctx.restore();
  }
}

/* -------------------------------------------------------------- projectiles -- */

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) drawAxeProjectile(ctx, p);
}

/* -------------------------------------------------------------- particles -- */

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    R(ctx, p.x, p.y, p.size, p.size, p.color);
  }
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------------- lights -- */

function drawLights(ctx, game) {
  const t = game.time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of game.level.entities) {
    let x;
    let y;
    let r;
    let col;
    let a;
    if (e.type === 'torch') {
      x = e.x + 4;
      y = e.y + 8;
      r = 52;
      col = '255,150,60';
      a = 0.09 + Math.sin(t * 9 + e.seed) * 0.02;
    } else if (e.type === 'cauldron') {
      x = e.x + e.w / 2;
      y = e.y + 8;
      r = 44;
      col = '255,170,70';
      a = 0.08;
    } else if (e.type === 'goal') {
      x = e.x + 32;
      y = e.y + 30;
      r = 72;
      col = '244,197,66';
      a = 0.075;
    } else {
      continue;
    }
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.55, `rgba(${col},${a * 0.45})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawDangerEdge(ctx, game) {
  let danger = 0;
  for (const e of game.level.entities) {
    if ((e.type === 'draugr' || e.type === 'raven') && !e.dead && e.state === 'windup') {
      danger = Math.max(danger, 1 - Math.max(0, e.stateT) / 0.7);
    }
  }
  if (danger <= 0) return;
  const a = 0.05 + danger * 0.11 + Math.sin(game.time * 16) * 0.02;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  R(ctx, 0, 0, VIEW_W, 3, '#ff4d4d');
  R(ctx, 0, VIEW_H - 3, VIEW_W, 3, '#ff4d4d');
  R(ctx, 0, 0, 3, VIEW_H, '#ff4d4d');
  R(ctx, VIEW_W - 3, 0, 3, VIEW_H, '#ff4d4d');
  ctx.restore();
}

/* ---------------------------------------------------------------- weather -- */

function drawWeather(ctx, game, theme) {
  const cam = game.camera;
  const t = game.time;
  const n = Math.round(58 * theme.snowRate);
  for (let i = 0; i < n; i++) {
    const speed = 16 + hash(i, 31) * 26;
    const sx = ((hash(i, 11) * VIEW_W + t * speed * 0.45 - cam.x * 0.08) % VIEW_W + VIEW_W) % VIEW_W;
    const sy = ((hash(i, 21) * VIEW_H + t * speed) % VIEW_H + VIEW_H) % VIEW_H;
    const drift = Math.sin(t * 1.1 + i * 0.9) * 2.5;
    const size = hash(i, 41) > 0.82 ? 2 : 1;
    ctx.globalAlpha = 0.45 + hash(i, 51) * 0.45;
    R(ctx, sx + drift, sy, size, size, '#eef4fb');
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------- hud -- */

function drawHUD(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.globalAlpha = 0.46;
  R(ctx, 6, 6, 150, 50, '#070b11');
  ctx.globalAlpha = 0.6;
  R(ctx, 6, 6, 150, 1, '#3a4658');
  R(ctx, 6, 55, 150, 1, '#1a2230');
  ctx.globalAlpha = 0.35;
  R(ctx, 10, 34, 142, 1, '#2a3444');
  ctx.restore();

  for (let i = 0; i < p.maxHp; i++) {
    drawHeart(ctx, 12 + i * 10, 11, i < p.hp);
  }
  for (let i = 0; i < game.shield; i++) {
    R(ctx, 46 + i * 7, 13, 3, 3, '#dff3ff');
    R(ctx, 46 + i * 7, 12, 2, 1, '#ffffff');
    R(ctx, 46 + i * 7 + 2, 14, 1, 1, '#9fc4e0');
  }

  MATERIAL_ORDER.forEach((key, i) => {
    const x = 12 + i * 30;
    drawMaterialIcon(ctx, key, x, 21);
    const n = game.materials[key];
    drawText(ctx, String(n), x + 12, 22, n > 0 ? '#e8eef5' : '#5c6675', 1, '#070b11');
  });

  for (let i = 0; i < game.maxAxes; i++) {
    const filled = i < game.axes;
    const charge = i === game.axes && game.axes < game.maxAxes ? game.axeCharge / 3 : 0;
    drawAxeIcon(ctx, 12 + i * 15, 38, filled, charge);
  }

  if (game.beer) {
    const b = BEERS[game.beer.key];
    const w = 78;
    const x = VIEW_W / 2 - w / 2;
    const y = 6;
    ctx.save();
    ctx.globalAlpha = 0.55;
    R(ctx, x, y, w, 20, '#070b11');
    ctx.globalAlpha = 0.9;
    R(ctx, x, y, w, 1, b.color);
    R(ctx, x, y + 19, w, 1, '#1a2230');
    ctx.restore();
    drawBeerIcon(ctx, x + 5, y + 5, game.beer.key);
    const secs = Math.ceil(game.beer.t);
    drawText(ctx, String(secs), x + 17, y + 6, '#e8eef5', 1, '#070b11');
    const ratio = Math.max(0, Math.min(1, game.beer.t / b.duration));
    R(ctx, x + 28, y + 8, w - 33, 2, '#1a2230');
    R(ctx, x + 28, y + 8, Math.round((w - 33) * ratio), 2, b.color);
    R(ctx, x + 28, y + 8, Math.round((w - 33) * ratio), 1, '#ffffff');
  }

  const secs = Math.floor(game.elapsed);
  const label = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const tw = textWidth(label, 1);
  ctx.save();
  ctx.globalAlpha = 0.4;
  R(ctx, VIEW_W - tw - 16, 6, tw + 10, 16, '#070b11');
  ctx.globalAlpha = 0.6;
  R(ctx, VIEW_W - tw - 16, 6, tw + 10, 1, '#3a4658');
  ctx.restore();
  drawText(ctx, label, VIEW_W - tw - 11, 11, '#e8eef5', 1, '#070b11');
}

/* ------------------------------------------------------- player effects -- */

function drawPlayerAura(ctx, game) {
  const p = game.player;
  if (!game.beer || p.dead) return;
  const key = game.beer.key;
  const b = BEERS[key];

  ctx.save();
  ctx.globalAlpha = 0.1 + Math.sin(game.time * 5) * 0.025;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (key === 'fury' && Math.abs(p.vx) > 70) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    const dir = p.facing;
    for (let i = 0; i < 3; i++) {
      const ly = p.cy - 9 + i * 7 + Math.sin(game.time * 12 + i) * 2;
      const len = 8 + i * 4;
      R(ctx, p.cx - dir * (11 + len), ly, len, 1, i === 0 ? '#fff2b0' : '#f4c542');
    }
    ctx.restore();
  }

  if (key === 'ipa') {
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 4; i++) {
      const ox = -p.facing * (10 + i * 5);
      const oy = Math.sin(game.time * 6 + i * 1.4) * 8;
      R(ctx, p.cx + ox, p.cy + oy, 2, 2, '#8fd67f');
    }
    ctx.restore();
  }

  if (key === 'winter') {
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      const a = game.time * 1.5 + i * 2.1;
      const ox = Math.cos(a) * 18;
      const oy = Math.sin(a * 1.3) * 12 - 4;
      R(ctx, p.cx + ox - 1, p.cy + oy, 3, 1, '#dff3ff');
      R(ctx, p.cx + ox, p.cy + oy - 1, 1, 3, '#dff3ff');
    }
    ctx.restore();
  }
}

function drawShield(ctx, game) {
  if (game.shield <= 0 || game.player.dead) return;
  const p = game.player;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#dff3ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 17, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = game.time * 1.6 + (i * Math.PI) / 3;
    const x = Math.round(p.cx + Math.cos(a) * 17);
    const y = Math.round(p.cy + Math.sin(a) * 11);
    ctx.globalAlpha = 0.75;
    R(ctx, x - 1, y - 1, 3, 3, i % 2 ? '#eef4fb' : '#b9c7d8');
    ctx.globalAlpha = 0.45;
    R(ctx, x - 2, y - 2, 1, 1, '#ffffff');
  }
  ctx.restore();
}

const beerVignettes = new Map();
function drawBeerTint(ctx, game) {
  if (!game.beer) return;
  const b = BEERS[game.beer.key];
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = b.tint;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();

  let v = beerVignettes.get(game.beer.key);
  if (!v) {
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = VIEW_H;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `${b.tint}55`);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    beerVignettes.set(game.beer.key, c);
    v = c;
  }
  ctx.drawImage(v, 0, 0);
}

function drawFlash(ctx, game) {
  if (game.flashT <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.4, game.flashT * 1.6);
  R(ctx, 0, 0, VIEW_W, VIEW_H, '#ff4d4d');
  ctx.restore();
}

let vignette = null;
function drawVignette(ctx) {
  if (!vignette) {
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = VIEW_H;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.28, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,7,14,0.55)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    vignette = c;
  }
  ctx.drawImage(vignette, 0, 0);
}
