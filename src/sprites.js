import { PALETTE as P } from './constants.js';
import { MATERIALS, BEERS } from './beers.js';
import { getImage } from './assets.js';

function R(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function pxLine(ctx, x0, y0, x1, y1, color, thick = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const off = thick >> 1;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x - off, y - off, thick, thick);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function pxCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const c = Math.round(cx);
  const y0 = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(c - span, y0 + dy, span * 2 + 1, 1);
  }
}

function pxGlow(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = r; i > 0; i -= 2) {
    const span = Math.floor(Math.sqrt(Math.max(0, i * i)));
    ctx.beginPath();
    ctx.arc(cx, cy, i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ease(t) {
  return 1 - Math.pow(1 - t, 3);
}

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/* ------------------------------------------------------------------ hero -- */

const HERO_SHEET = { frame: 64, bottom: 46 };
const ENEMY_SHEET = { frame: 64, bottom: 48 };

function drawSheetFrame(ctx, img, col, row, cx, feetY, facing, bottom) {
  const f = HERO_SHEET.frame;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(feetY));
  ctx.scale(facing, 1);
  ctx.drawImage(img, col * f, row * f, f, f, -f / 2, -bottom, f, f);
  ctx.restore();
}

export function drawViking(ctx, cx, feetY, s) {
  const hero = getImage('hero');
  if (!hero) {
    drawVikingProcedural(ctx, cx, feetY, s);
    return;
  }

  const facing = s.facing || 1;
  if (s.rollT > 0) {
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(feetY));
    ctx.scale(facing, 1);
    drawRollBall(ctx, 1 - s.rollT / (s.rollDur || 0.42), s.rollDir || facing);
    ctx.restore();
    return;
  }

  let row = 0;
  let col = 0;
  const idle = s.idle || 0;
  const run = s.run || 0;
  const vx = s.vx || 0;

  if (s.dead) {
    row = 6;
  } else if (s.hurtT > 0) {
    row = 5;
    col = Math.floor((0.35 - s.hurtT) * 18) % 6;
  } else if (s.attackT >= 0) {
    row = 4;
    const t = s.attackT;
    col = t < 0.3 ? 0 : t < 0.52 ? 1 : t < 0.74 ? 2 : 3;
  } else if (s.throwT > 0) {
    row = 4;
    col = 1;
  } else if (s.inWater) {
    row = 1;
    col = Math.floor((s.swim || 0) * 6) % 6;
  } else if (!s.grounded) {
    row = s.vy < 0 ? 2 : 3;
  } else if (Math.abs(vx) > 8) {
    row = 1;
    col = Math.floor(run * 0.9) % 6;
  } else {
    row = 0;
    col = Math.floor(idle * 5) % 4;
  }

  drawSheetFrame(ctx, hero, col, row, cx, feetY, facing, HERO_SHEET.bottom);
}

function drawVikingProcedural(ctx, cx, feetY, s) {
  const facing = s.facing || 1;
  const run = s.run || 0;
  const idle = s.idle || 0;
  const vx = s.vx || 0;
  const grounded = s.grounded !== false;
  const attackT = s.attackT === undefined ? -1 : s.attackT;
  const rollT = s.rollT || 0;
  const rollDur = s.rollDur || 0.42;
  const inWater = !!s.inWater;
  const swim = s.swim || 0;
  const throwT = s.throwT || 0;
  const squash = s.squash || 0;
  const swing = attackT >= 0;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(feetY));
  if (squash > 0.01) ctx.scale(1 + squash * 0.45, 1 - squash * 0.5);
  ctx.scale(facing, 1);

  if (rollT > 0) {
    drawRollBall(ctx, 1 - rollT / rollDur, s.rollDir || facing);
    ctx.restore();
    return;
  }

  const idleQ = Math.floor(idle * 8) / 8;
  const runQ = Math.floor(run * 20) / 20;
  const bob = grounded && Math.abs(vx) < 8 ? Math.round(Math.sin(idleQ * 2.2) * 0.7) : 0;
  const step = Math.sin(runQ);
  const step2 = Math.sin(runQ + Math.PI);
  const kick = inWater ? Math.sin(swim * 9) : 0;

  // shield strapped to the back
  drawShieldOnBack(ctx, -8, -20 + bob);

  // back arm swings behind the body
  drawBackArm(ctx, inWater ? kick : step2, bob, inWater, swim);

  // back leg
  drawLeg(ctx, -4, inWater ? kick : step2, true, grounded, inWater);

  // torso
  R(ctx, -9, -28 + bob, 18, 17, P.outline);
  R(ctx, -8, -27 + bob, 16, 15, P.tunic);
  R(ctx, -8, -27 + bob, 3, 15, P.tunicHi);
  R(ctx, 5, -27 + bob, 3, 15, P.tunicDark);
  R(ctx, -8, -27 + bob, 16, 2, P.tunicHi);
  R(ctx, -7, -26 + bob, 1, 7, P.tunicHi);

  // belt + buckle
  R(ctx, -8, -17 + bob, 16, 3, P.leatherDark);
  R(ctx, -8, -17 + bob, 16, 1, P.leatherHi);
  R(ctx, 0, -17 + bob, 4, 3, P.gold);
  R(ctx, 1, -16 + bob, 2, 1, P.goldHi);

  // diagonal leather strap
  pxLine(ctx, -6, -26 + bob, 3, -18 + bob, P.leather, 2);
  pxLine(ctx, -6, -26 + bob, 3, -18 + bob, P.leatherHi, 1);

  // fur mantle over the shoulders
  R(ctx, -10, -30 + bob, 20, 4, P.outline);
  R(ctx, -9, -29 + bob, 18, 3, P.fur);
  R(ctx, -9, -29 + bob, 18, 1, P.furHi);
  R(ctx, -9, -27 + bob, 18, 1, P.furDark);
  for (let i = -9; i < 9; i += 2) {
    R(ctx, i, -27 + bob, 1, 1 + ((i * 7) & 1), P.furDark);
  }

  // front leg
  drawLeg(ctx, 2, inWater ? -kick : step, false, grounded, inWater);

  // head + helmet
  drawHead(ctx, bob, idleQ, grounded, vx);

  // front arm and axe
  const arm = computeArm(attackT, idleQ, throwT, inWater, swim);
  drawArmAndAxe(ctx, arm, bob, throwT);

  // swing trail
  if (swing && attackT > 0.28 && attackT < 0.62) {
    ctx.save();
    ctx.globalAlpha = 0.4 * (1 - (attackT - 0.28) / 0.34);
    for (let k = 1; k <= 6; k++) {
      const a = arm.ang - k * 0.13;
      for (let r = 9; r <= 16; r += 2) {
        const tx = arm.hx + Math.cos(a) * r;
        const ty = arm.hy + Math.sin(a) * r;
        R(ctx, tx, ty, 1, 1, k < 3 ? P.steelHi : P.steel);
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawShieldOnBack(ctx, x, y) {
  pxCircle(ctx, x, y, 8, P.outline);
  pxCircle(ctx, x, y, 7, P.steelDark);
  pxCircle(ctx, x, y, 6, P.wood);
  R(ctx, x - 5, y - 5, 1, 11, P.woodDark);
  R(ctx, x - 1, y - 6, 1, 12, P.woodDark);
  R(ctx, x + 3, y - 5, 1, 11, P.woodDark);
  R(ctx, x - 6, y - 2, 12, 1, P.leatherHi);
  pxCircle(ctx, x, y, 2, P.outline);
  pxCircle(ctx, x, y, 1, P.steel);
}

function drawBackArm(ctx, phase, bob, inWater, swim) {
  const swing = inWater ? Math.sin(swim * 8) * 3 : phase * 2;
  const sx = -6;
  const sy = -26 + bob;
  const hx = -9 + swing * 0.5;
  const hy = -17 + bob + Math.abs(swing) * 0.5;
  pxLine(ctx, sx, sy, hx, hy, P.outline, 5);
  pxLine(ctx, sx, sy, hx, hy, P.tunicDark, 3);
  R(ctx, hx - 1, hy - 1, 3, 3, P.outline);
  R(ctx, hx, hy, 2, 2, P.skinMid);
}

function drawRollBall(ctx, progress, dir) {
  ctx.save();
  ctx.translate(0, -13);
  ctx.rotate(progress * Math.PI * 2 * (dir || 1));

  pxCircle(ctx, 0, 0, 11, P.outline);
  pxCircle(ctx, 0, 0, 10, P.tunic);
  R(ctx, -10, -4, 20, 7, P.fur);
  R(ctx, -10, -4, 20, 1, P.furHi);
  R(ctx, -10, 2, 20, 1, P.furDark);

  pxCircle(ctx, 4, 1, 6, P.outline);
  pxCircle(ctx, 4, 1, 5, P.steelDark);
  pxCircle(ctx, 4, 1, 4, P.wood);
  R(ctx, 3, -3, 1, 8, P.woodDark);
  pxCircle(ctx, 4, 1, 1, P.gold);

  pxCircle(ctx, -6, -2, 5, P.outline);
  pxCircle(ctx, -6, -2, 4, P.helm);
  R(ctx, -10, -2, 8, 2, P.helmMid);
  R(ctx, -10, -3, 8, 1, P.gold);

  R(ctx, -8, 2, 6, 3, P.beard);
  R(ctx, -8, 2, 6, 1, P.beardHi);
  R(ctx, -7, 5, 4, 1, P.beardDark);

  pxLine(ctx, 6, -6, 10, -10, P.outline, 3);
  pxLine(ctx, 6, -6, 10, -10, P.wood, 1);
  pxLine(ctx, 9, -11, 12, -8, P.steel, 3);
  ctx.restore();
}

function drawLeg(ctx, x, p, back, grounded, inWater) {
  let dx = 0;
  let lift = 0;
  if (inWater) {
    dx = Math.round(p * 3);
    lift = Math.round(Math.max(0, p) * 3);
  } else if (!grounded) {
    dx = back ? -2 : 3;
    lift = back ? 2 : 3;
  } else if (Math.abs(p) > 0.05) {
    dx = Math.round(p * 2.6);
    lift = Math.round(Math.max(0, p) * 3);
  }
  const col = back ? P.trousersDark : P.trousers;
  R(ctx, x - 1 + dx, -13, 6, 13, P.outline);
  R(ctx, x + dx, -12, 4, 7, col);
  R(ctx, x + dx, -6 - lift, 4, 6, back ? '#20242e' : P.trousersDark);
  R(ctx, x - 1 + dx, -4 - lift, 7, 4, P.outline);
  R(ctx, x + dx, -3 - lift, 6, 3, P.leatherDark);
  R(ctx, x + dx, -3 - lift, 6, 1, P.leather);
  R(ctx, x + dx + 4, -1 - lift, 2, 1, P.leatherDark);
}

function drawHead(ctx, bob, idle, grounded, vx) {
  const y = bob;

  // neck
  R(ctx, -2, -29 + y, 4, 3, P.outline);
  R(ctx, -2, -29 + y, 3, 2, P.skinDark);

  // face
  R(ctx, -6, -36 + y, 12, 9, P.outline);
  R(ctx, -5, -35 + y, 10, 7, P.skin);
  R(ctx, -5, -35 + y, 2, 7, P.skinMid);
  R(ctx, 3, -35 + y, 2, 7, P.skinDark);
  R(ctx, -4, -35 + y, 1, 4, P.skinHi);

  // brows + eyes
  R(ctx, -4, -33 + y, 3, 1, P.beardDark);
  R(ctx, 1, -33 + y, 3, 1, P.beardDark);
  R(ctx, -3, -32 + y, 2, 2, '#191622');
  R(ctx, 2, -32 + y, 2, 2, '#191622');
  R(ctx, -3, -32 + y, 1, 1, '#f4f8ff');
  R(ctx, 2, -32 + y, 1, 1, '#f4f8ff');

  // nose
  R(ctx, 0, -31 + y, 3, 2, P.skinMid);
  R(ctx, 2, -31 + y, 1, 2, P.skinDark);

  // moustache
  R(ctx, -5, -29 + y, 11, 2, P.beard);
  R(ctx, -5, -29 + y, 11, 1, P.beardHi);
  R(ctx, 5, -28 + y, 1, 1, P.beardMid);

  // beard
  const beardRows = [
    [-6, -28, 13], [-6, -27, 13], [-6, -26, 12], [-5, -25, 11],
    [-5, -24, 10], [-4, -23, 9], [-4, -22, 8], [-3, -21, 7],
    [-2, -20, 5], [-1, -19, 3],
  ];
  for (let i = 0; i < beardRows.length; i++) {
    const [bx, by, bw] = beardRows[i];
    R(ctx, bx, by + y, bw, 1, i < 4 ? P.beard : i < 7 ? P.beardMid : P.beardDark);
    if (i < 7) R(ctx, bx + 1, by + y, 2, 1, P.beardHi);
    if (i > 3) R(ctx, bx + bw - 2, by + y, 2, 1, P.beardDark);
  }

  // braid rings
  R(ctx, -6, -24 + y, 3, 1, P.gold);
  R(ctx, 4, -24 + y, 3, 1, P.gold);
  R(ctx, -5, -22 + y, 2, 1, P.goldDark);
  R(ctx, 4, -22 + y, 2, 1, P.goldDark);

  // helmet dome
  pxCircle(ctx, 0, -36 + y, 8, P.outline);
  pxCircle(ctx, 0, -36 + y, 7, P.helmMid);
  R(ctx, -7, -41 + y, 14, 6, P.outline);
  R(ctx, -7, -40 + y, 14, 5, P.helm);
  R(ctx, -7, -40 + y, 14, 1, P.helmHi);
  R(ctx, -7, -36 + y, 14, 2, P.helmMid);
  R(ctx, -7, -35 + y, 14, 1, P.helmDark);

  // gold brow band
  R(ctx, -7, -36 + y, 14, 1, P.gold);
  R(ctx, -5, -37 + y, 1, 1, P.goldHi);
  R(ctx, 4, -37 + y, 1, 1, P.goldHi);

  // nose guard
  R(ctx, 0, -36 + y, 2, 7, P.helmMid);
  R(ctx, 0, -36 + y, 1, 7, P.helmHi);
  R(ctx, 0, -29 + y, 2, 1, P.helmDark);

  // horns
  drawHorn(ctx, -7, -38 + y, -1);
  drawHorn(ctx, 7, -38 + y, 1);
}

function drawHorn(ctx, x, y, dir) {
  pxLine(ctx, x, y, x + dir * 4, y - 3, P.outline, 4);
  pxLine(ctx, x + dir * 4, y - 3, x + dir * 6, y - 1, P.outline, 4);
  pxLine(ctx, x, y, x + dir * 4, y - 3, '#e6ddc8', 2);
  pxLine(ctx, x + dir * 4, y - 3, x + dir * 6, y - 1, '#d5cbb2', 2);
  R(ctx, x + dir * 5, y - 2, 1, 1, '#f7f2e2');
}

function computeArm(attackT, idle, throwT, inWater, swim) {
  if (throwT > 0) {
    return { hx: 11, hy: -19, ang: 0.12, throwing: true };
  }
  if (inWater) {
    const paddle = Math.sin(swim * 8);
    return {
      hx: 8 + paddle * 3,
      hy: -18 + Math.abs(paddle) * 2,
      ang: -1.2 + paddle * 0.35,
    };
  }
  if (attackT < 0) {
    return {
      hx: 10,
      hy: -16 + Math.sin(idle * 2.2) * 0.6,
      ang: -1.12 + Math.sin(idle * 2.2) * 0.04,
    };
  }
  let ang;
  let e;
  if (attackT < 0.3) {
    e = ease(attackT / 0.3);
    ang = -1.12 + (-2.5 + 1.12) * e;
  } else if (attackT < 0.56) {
    e = ease((attackT - 0.3) / 0.26);
    ang = -2.5 + (1.05 + 2.5) * e;
  } else {
    e = ease((attackT - 0.56) / 0.44);
    ang = 1.05 + (-1.12 - 1.05) * e;
  }
  return {
    hx: 8 + Math.max(0, Math.sin(ang)) * 3,
    hy: -17 + Math.sin(ang * 0.6) * 1.5,
    ang,
  };
}

function drawArmAndAxe(ctx, arm, bob, throwT) {
  const sy = -26 + bob;
  const ex = (6 + arm.hx) / 2 + 1;
  const ey = (sy + arm.hy) / 2 + 2;

  pxLine(ctx, 6, sy, ex, ey, P.outline, 5);
  pxLine(ctx, ex, ey, arm.hx, arm.hy, P.outline, 5);
  pxLine(ctx, 6, sy, ex, ey, P.tunic, 3);
  pxLine(ctx, ex, ey, arm.hx, arm.hy, P.skin, 3);

  R(ctx, arm.hx - 1, arm.hy - 1, 4, 3, P.outline);
  R(ctx, arm.hx, arm.hy, 2, 2, P.skin);
  R(ctx, arm.hx + 2, arm.hy + 1, 1, 1, P.skinMid);

  if (throwT > 0) {
    pxLine(ctx, arm.hx - 4, arm.hy - 3, arm.hx - 1, arm.hy - 1, 'rgba(223,243,255,0.6)', 1);
    return;
  }

  const ang = arm.ang;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const bx = arm.hx - cos * 4;
  const by = arm.hy - sin * 4;
  const tx = arm.hx + cos * 13;
  const ty = arm.hy + sin * 13;

  pxLine(ctx, bx, by, tx, ty, P.outline, 3);
  pxLine(ctx, bx, by, tx, ty, P.wood, 1);
  R(ctx, bx - 1, by - 1, 2, 2, P.leatherDark);

  const px = Math.cos(ang + Math.PI / 2);
  const py = Math.sin(ang + Math.PI / 2);
  pxLine(ctx, tx - px * 5, ty - py * 5, tx + px * 5, ty + py * 5, P.outline, 6);
  pxLine(ctx, tx - px * 4, ty - py * 4, tx + px * 4, ty + py * 4, P.steelDark, 4);
  pxLine(ctx, tx - px * 3, ty - py * 3, tx + px * 3, ty + py * 3, P.steel, 2);
  pxLine(ctx, tx - px * 3, ty - py * 3, tx + px * 2, ty + py * 2, P.steelHi, 1);
  pxLine(ctx, tx - px * 4, ty - py * 4, tx - px * 7, ty - py * 7, P.steelDeep, 2);
  R(ctx, tx + px * 2 - 1, ty + py * 2 - 1, 1, 1, P.gold);
}

/* ---------------------------------------------------------------- draugr -- */

export function drawDraugr(ctx, cx, feetY, s) {
  const img = getImage('enemy');
  if (!img) {
    drawDraugrProcedural(ctx, cx, feetY, s);
    return;
  }

  const state = s.state || 'patrol';
  const phase = s.phase || 0;
  let row = 0;
  let col = 0;

  if (state === 'dead') {
    row = 3;
  } else if (state === 'windup') {
    row = 2;
    col = 0;
  } else if (state === 'strike') {
    row = 2;
    col = (s.stateT || 0) > 0.1 ? 1 : 2;
  } else if (state === 'recover') {
    row = 2;
    col = 3;
  } else if (Math.abs(s.vx || 0) > 2) {
    row = 1;
    col = Math.floor(phase * 2) % 6;
  } else {
    row = 0;
    col = Math.floor(phase * 1.5) % 6;
  }

  if (state === 'windup') {
    ctx.save();
    ctx.globalAlpha = 0.14 + Math.sin(phase * 1.5) * 0.04;
    pxCircle(ctx, cx, feetY - 15, 19, '#ff6b5a');
    ctx.restore();
  }

  drawSheetFrame(ctx, img, col, row, cx, feetY, s.facing || 1, ENEMY_SHEET.bottom);
}

function drawDraugrProcedural(ctx, cx, feetY, s) {
  const facing = s.facing || 1;
  const phase = s.phase || 0;
  const state = s.state || 'patrol';
  const windup = state === 'windup';
  const strike = state === 'strike';
  const bob = Math.round(Math.sin(phase * 2) * 1);
  const lean = windup ? -1 : strike ? 2 : 0;
  const p = Math.sin(phase * 2);

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(feetY));
  ctx.scale(facing, 1);

  if (windup) {
    ctx.save();
    ctx.globalAlpha = 0.14 + Math.sin(phase * 1.5) * 0.04;
    pxCircle(ctx, 0, -15, 19, '#ff6b5a');
    ctx.restore();
  }

  // legs
  R(ctx, -6 + Math.round(p * 2), -11, 5, 9, '#141a16');
  R(ctx, 1 - Math.round(p * 2), -11, 5, 9, '#141a16');
  R(ctx, -5 + Math.round(p * 2), -10, 3, 8, '#2f3831');
  R(ctx, 2 - Math.round(p * 2), -10, 3, 8, '#252d27');
  R(ctx, -7 + Math.round(p * 2), -3, 6, 3, '#101411');
  R(ctx, 1 - Math.round(p * 2), -3, 6, 3, '#101411');

  // tattered skirt
  for (let i = 0; i < 7; i++) {
    const len = 2 + ((i * 5) % 3);
    R(ctx, -7 + i * 2, -13, 2, len + 2, i % 2 ? '#2b332d' : '#3a453d');
  }

  // torso
  R(ctx, -7 + lean, -24 + bob, 14, 12, '#0f1511');
  R(ctx, -6 + lean, -23 + bob, 12, 10, '#3a453d');
  R(ctx, -6 + lean, -23 + bob, 3, 10, '#2a332d');
  R(ctx, 4 + lean, -23 + bob, 2, 10, '#232b26');
  R(ctx, -5 + lean, -20 + bob, 9, 1, '#4a564c');
  R(ctx, -5 + lean, -17 + bob, 7, 1, '#4a564c');
  // exposed ribs
  R(ctx, -3 + lean, -21 + bob, 2, 3, '#b9b09a');
  R(ctx, -1 + lean, -20 + bob, 2, 3, '#8e8774');
  R(ctx, 1 + lean, -19 + bob, 2, 2, '#b9b09a');

  // back arm
  pxLine(ctx, -5 + lean, -21 + bob, -9, -12 + bob, '#141a16', 4);
  pxLine(ctx, -5 + lean, -21 + bob, -9, -12 + bob, '#343d35', 2);
  R(ctx, -10, -12 + bob, 3, 2, '#b9b09a');

  // front arm + sword
  let hx;
  let hy;
  let ang;
  if (windup) {
    hx = 7 + lean;
    hy = -22 + bob;
    ang = -2.25;
  } else if (strike) {
    hx = 10;
    hy = -15 + bob;
    ang = 0.65;
  } else {
    hx = 8 + lean;
    hy = -16 + bob;
    ang = -0.55 + Math.sin(phase * 2) * 0.08;
  }
  pxLine(ctx, 5 + lean, -21 + bob, hx, hy, '#141a16', 4);
  pxLine(ctx, 5 + lean, -21 + bob, hx, hy, '#3a453d', 2);
  R(ctx, hx - 1, hy - 1, 3, 3, '#b9b09a');

  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const sx = hx + cos * 4;
  const sy = hy + sin * 4;
  const tx = hx + cos * 17;
  const ty = hy + sin * 17;
  pxLine(ctx, sx, sy, tx, ty, '#0d100e', 3);
  pxLine(ctx, sx, sy, tx, ty, '#8b95a2', 1);
  pxLine(ctx, hx - cos * 1, hy - sin * 1, hx + cos * 4, hy + sin * 4, '#4a3a28', 3);
  R(ctx, tx - 1, ty - 1, 2, 2, '#c3cedb');

  // hood
  pxCircle(ctx, lean, -27 + bob, 7, '#0b0f0c');
  pxCircle(ctx, lean, -27 + bob, 6, '#232a25');
  pxCircle(ctx, lean, -27 + bob, 5, '#171d19');
  R(ctx, -6 + lean, -28 + bob, 12, 1, '#2f3831');
  R(ctx, -5 + lean, -23 + bob, 10, 1, '#0e120f');

  // skull face
  R(ctx, -4 + lean, -28 + bob, 8, 5, '#cfc7b0');
  R(ctx, -4 + lean, -28 + bob, 8, 1, '#e4dcc4');
  R(ctx, -4 + lean, -24 + bob, 8, 1, '#a49b84');
  R(ctx, -2 + lean, -23 + bob, 5, 1, '#8e8774');
  // jaw teeth
  R(ctx, -2 + lean, -23 + bob, 1, 1, '#e4dcc4');
  R(ctx, 1 + lean, -23 + bob, 1, 1, '#e4dcc4');

  // glowing eyes (red while winding up)
  const eye = windup ? '#ff6b5a' : '#7fe7d4';
  const eyeHi = windup ? '#ffd0c8' : '#d8fff7';
  R(ctx, -3 + lean, -27 + bob, 2, 2, eye);
  R(ctx, 2 + lean, -27 + bob, 2, 2, eye);
  R(ctx, -3 + lean, -27 + bob, 1, 1, eyeHi);
  R(ctx, 2 + lean, -27 + bob, 1, 1, eyeHi);

  ctx.save();
  ctx.globalAlpha = windup ? 0.3 : 0.16;
  pxCircle(ctx, -2 + lean, -26 + bob, 3, eye);
  pxCircle(ctx, 3 + lean, -26 + bob, 3, eye);
  ctx.restore();

  ctx.restore();
}

/* ----------------------------------------------------------------- raven -- */

export function drawRaven(ctx, cx, cy, phase, facing, state) {
  const flap = Math.sin(phase * 9);
  const windup = state === 'windup';
  const dive = state === 'dive';
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.scale(facing, 1);

  if (windup) {
    ctx.save();
    ctx.globalAlpha = 0.14 + Math.sin(phase * 1.8) * 0.04;
    pxCircle(ctx, 0, -6, 17, '#ff6b5a');
    ctx.restore();
  }

  if (dive) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 4; i++) {
      R(ctx, -12 - i * 4, -10 + i * 2, 5, 1, '#9fb4d8');
    }
    ctx.restore();
  }

  // tail
  R(ctx, -9, -6, 6, 2, '#0b0f17');
  R(ctx, -12, -5, 4, 2, '#141a24');
  R(ctx, -12, -5, 3, 1, '#1d2431');

  // far wing
  if (windup || dive) {
    R(ctx, -7, -14, 7, 3, '#0b0f17');
    R(ctx, -11, -19, 6, 3, '#1b2230');
    R(ctx, -14, -23, 4, 2, '#2d3648');
    R(ctx, -12, -20, 2, 1, '#39465c');
  } else if (flap > 0) {
    R(ctx, -7, -12, 7, 3, '#0b0f17');
    R(ctx, -10, -16, 6, 3, '#1b2230');
    R(ctx, -13, -19, 4, 2, '#2d3648');
  } else {
    R(ctx, -8, -2, 7, 3, '#0b0f17');
    R(ctx, -10, 1, 6, 3, '#1b2230');
    R(ctx, -12, 4, 4, 2, '#2d3648');
  }

  // body
  pxCircle(ctx, 0, -7, 5, '#0b0f17');
  pxCircle(ctx, 0, -7, 4, '#1e2634');
  R(ctx, -2, -8, 5, 2, '#2b3445');
  R(ctx, -1, -9, 3, 1, '#39465c');

  // head
  pxCircle(ctx, 5, -10, 4, '#0b0f17');
  pxCircle(ctx, 5, -10, 3, '#242c3c');
  R(ctx, 5, -12, 3, 2, '#2f3a4d');
  // beak
  R(ctx, 7, -10, 4, 2, '#d9a13b');
  R(ctx, 9, -10, 2, 1, '#f2cf6b');
  R(ctx, 7, -9, 3, 1, '#a87424');
  // eye
  R(ctx, 5, -11, 1, 1, windup ? '#ffd0c8' : '#ff6b5a');
  if (windup) {
    R(ctx, 4, -11, 1, 1, '#ff6b5a');
    R(ctx, 6, -12, 1, 1, '#ff6b5a');
  }

  // near wing
  if (windup || dive) {
    R(ctx, -6, -12, 7, 3, '#0d121c');
    R(ctx, -10, -17, 6, 3, '#202838');
    R(ctx, -13, -21, 4, 2, '#39465c');
    R(ctx, -11, -18, 2, 1, '#4a5a74');
  } else if (flap > 0) {
    R(ctx, -6, -10, 7, 3, '#0d121c');
    R(ctx, -9, -14, 6, 3, '#202838');
    R(ctx, -12, -17, 4, 2, '#39465c');
  } else {
    R(ctx, -7, -1, 7, 3, '#0d121c');
    R(ctx, -9, 2, 6, 3, '#202838');
    R(ctx, -11, 5, 4, 2, '#39465c');
  }

  ctx.restore();
}

/* ------------------------------------------------------------- telegraph -- */

export function drawAlert(ctx, x, y, t, strong) {
  const bob = Math.round(Math.sin(t * 5) * 1);
  const col = strong ? '#ff6b5a' : '#f4d97a';
  ctx.save();
  ctx.globalAlpha = 0.16 + Math.sin(t * 4) * 0.04;
  pxCircle(ctx, x, y + bob, 10, col);
  ctx.restore();

  R(ctx, x - 5, y - 8 + bob, 10, 11, '#080c12');
  R(ctx, x - 5, y - 8 + bob, 10, 1, col);
  R(ctx, x - 5, y + 2 + bob, 10, 1, col);
  R(ctx, x - 1, y - 6 + bob, 2, 6, col);
  R(ctx, x - 1, y + 1 + bob, 2, 2, col);
  R(ctx, x - 1, y - 6 + bob, 1, 3, '#fff6e0');
}

export function drawAxeProjectile(ctx, p) {
  ctx.save();
  ctx.translate(Math.round(p.x + p.w / 2), Math.round(p.y + p.h / 2));
  ctx.rotate(p.rot);

  pxLine(ctx, -7, 0, 7, 0, P.outline, 3);
  pxLine(ctx, -7, 0, 7, 0, P.wood, 1);
  R(ctx, -8, -1, 2, 2, P.leatherDark);

  pxLine(ctx, 5, -6, 5, 6, P.outline, 7);
  pxLine(ctx, 5, -5, 5, 5, P.steelDark, 5);
  pxLine(ctx, 5, -4, 5, 4, P.steel, 3);
  R(ctx, 6, -3, 1, 2, P.steelHi);
  pxLine(ctx, 6, -5, 9, -2, P.outline, 3);
  pxLine(ctx, 6, -5, 9, -2, P.steelDark, 1);
  R(ctx, 5, 3, 1, 1, P.gold);

  ctx.restore();
}

export function drawAxeIcon(ctx, x, y, filled, charge = 0) {
  const wood = filled ? P.wood : '#2c3542';
  const steel = filled ? P.steel : '#46505f';
  const steelDark = filled ? P.steelDark : '#343c48';

  pxLine(ctx, x + 2, y + 10, x + 8, y + 2, P.outline, 3);
  pxLine(ctx, x + 2, y + 10, x + 8, y + 2, wood, 1);
  pxLine(ctx, x + 6, y + 1, x + 10, y + 5, P.outline, 5);
  pxLine(ctx, x + 6, y + 1, x + 10, y + 5, steelDark, 3);
  pxLine(ctx, x + 6, y + 1, x + 9, y + 4, steel, 1);
  R(ctx, x + 8, y + 2, 1, 1, filled ? P.steelHi : '#5a6575');

  if (!filled && charge > 0) {
    R(ctx, x + 1, y + 12, 9, 2, '#1a2230');
    R(ctx, x + 1, y + 12, Math.max(1, Math.round(9 * charge)), 2, P.gold);
  }
}

/* ------------------------------------------------------------ collectibles -- */

export function drawRune(ctx, x, y, t, taken = false) {
  if (taken) return;
  const bob = Math.round(Math.sin(t * 3 + x * 0.07) * 2);
  ctx.save();
  ctx.globalAlpha = 0.16 + Math.sin(t * 4 + x) * 0.05;
  pxCircle(ctx, x, y + bob, 9, P.rune);
  ctx.restore();

  R(ctx, x - 4, y - 6 + bob, 8, 10, '#25333c');
  R(ctx, x - 4, y - 6 + bob, 8, 1, '#4d6472');
  R(ctx, x - 4, y - 6 + bob, 1, 9, '#3a4d59');
  R(ctx, x - 3, y - 5 + bob, 6, 8, '#1a242c');
  R(ctx, x + 3, y - 5 + bob, 1, 8, '#101820');
  // rune (fehu)
  pxLine(ctx, x, y - 4 + bob, x, y + 2 + bob, P.rune, 1);
  pxLine(ctx, x, y - 4 + bob, x + 3, y - 1 + bob, P.rune, 1);
  pxLine(ctx, x, y - 1 + bob, x + 3, y + 1 + bob, P.rune, 1);
  R(ctx, x - 1, y + 2 + bob, 3, 1, P.runeDark);
  // sparkle
  const sp = Math.sin(t * 5 + x * 0.3);
  if (sp > 0.6) {
    R(ctx, x + 5, y - 7 + bob, 1, 1, '#ffffff');
    R(ctx, x - 6, y + 1 + bob, 1, 1, '#d8fff7');
  }
}

export function drawMead(ctx, x, y, t) {
  const bob = Math.round(Math.sin(t * 3 + x * 0.09) * 2);
  ctx.save();
  ctx.globalAlpha = 0.12;
  pxCircle(ctx, x, y + bob, 8, P.gold);
  ctx.restore();
  // horn
  R(ctx, x - 4, y - 6 + bob, 7, 2, '#c9a06a');
  R(ctx, x - 5, y - 4 + bob, 8, 3, '#e0bd88');
  R(ctx, x - 5, y - 1 + bob, 6, 3, '#b98d59');
  R(ctx, x - 4, y + 2 + bob, 3, 2, '#8a6338');
  R(ctx, x - 2, y + 4 + bob, 2, 1, '#6b4a2b');
  R(ctx, x - 4, y - 6 + bob, 6, 1, P.goldHi);
  R(ctx, x - 4, y - 5 + bob, 6, 2, '#f0d089');
  // foam
  R(ctx, x - 5, y - 7 + bob, 3, 1, '#fff6dc');
  R(ctx, x + 1, y - 7 + bob, 2, 1, '#fff6dc');
  R(ctx, x + 5, y - 3 + bob, 1, 1, P.goldHi);
}

/* -------------------------------------------------------- brewing items -- */

export function drawMaterialIcon(ctx, key, x, y) {
  const m = MATERIALS[key];
  const hi = key === 'honey' ? '#ffe08a' : key === 'water' ? '#dff3ff' : '#f4e2b0';
  if (key === 'honey' || key === 'water') {
    R(ctx, x + 4, y, 2, 1, m.color);
    R(ctx, x + 3, y + 1, 4, 2, m.color);
    R(ctx, x + 2, y + 3, 6, 3, m.color);
    R(ctx, x + 1, y + 5, 8, 2, m.color);
    R(ctx, x + 2, y + 7, 6, 1, m.dark);
    R(ctx, x + 3, y + 8, 4, 1, m.dark);
    R(ctx, x + 3, y + 3, 1, 2, hi);
    R(ctx, x + 2, y + 5, 1, 1, hi);
    return;
  }
  if (key === 'barley') {
    R(ctx, x + 4, y, 1, 2, hi);
    R(ctx, x + 4, y + 2, 1, 8, m.dark);
    R(ctx, x + 2, y + 2, 2, 2, m.color);
    R(ctx, x + 6, y + 2, 2, 2, m.color);
    R(ctx, x + 1, y + 5, 2, 2, m.color);
    R(ctx, x + 7, y + 5, 2, 2, m.color);
    R(ctx, x + 2, y + 7, 2, 2, m.color);
    R(ctx, x + 6, y + 7, 2, 2, m.color);
    R(ctx, x + 2, y + 2, 1, 1, hi);
    R(ctx, x + 6, y + 5, 1, 1, hi);
    R(ctx, x + 2, y + 7, 1, 1, hi);
    return;
  }
  // hops cone
  R(ctx, x + 4, y, 2, 1, m.color);
  R(ctx, x + 3, y + 1, 4, 2, m.color);
  R(ctx, x + 2, y + 3, 6, 2, m.color);
  R(ctx, x + 2, y + 5, 6, 2, m.dark);
  R(ctx, x + 3, y + 7, 4, 2, m.color);
  R(ctx, x + 4, y + 9, 2, 1, m.dark);
  R(ctx, x + 4, y + 1, 1, 7, m.dark);
  R(ctx, x + 2, y + 4, 5, 1, m.dark);
  R(ctx, x + 3, y + 6, 3, 1, m.dark);
  R(ctx, x + 3, y + 2, 1, 1, hi);
}

export function drawMaterial(ctx, key, cx, cy, t) {
  const m = MATERIALS[key];
  const bob = Math.round(Math.sin(t * 3.2 + cx * 0.08) * 2);
  ctx.save();
  ctx.globalAlpha = 0.14 + Math.sin(t * 4 + cx) * 0.04;
  pxCircle(ctx, cx, cy + bob, 8, m.color);
  ctx.restore();
  drawMaterialIcon(ctx, key, cx - 5, cy - 5 + bob);
  const sp = Math.sin(t * 5 + cx * 0.3);
  if (sp > 0.65) {
    R(ctx, cx + 6, cy - 7 + bob, 1, 1, '#ffffff');
    R(ctx, cx - 7, cy + 2 + bob, 1, 1, m.color);
  }
}

export function drawBeer(ctx, cx, cy, key, t) {
  const b = BEERS[key];
  const bob = Math.round(Math.sin(t * 3 + cx * 0.06) * 2);
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.sin(t * 3.5 + cx) * 0.05;
  pxCircle(ctx, cx, cy + bob, 11, b.color);
  ctx.restore();

  const x = cx;
  const y = cy + bob;
  // handle
  R(ctx, x + 5, y - 4, 2, 5, b.dark);
  R(ctx, x + 6, y - 3, 1, 3, '#8a5a32');
  // body
  R(ctx, x - 5, y - 5, 10, 11, '#6b4226');
  R(ctx, x - 5, y - 5, 10, 1, '#a3703f');
  R(ctx, x - 6, y - 4, 1, 9, '#4a2c18');
  R(ctx, x + 4, y - 4, 1, 9, '#3a2212');
  R(ctx, x - 5, y - 1, 10, 1, '#4e2f1a');
  R(ctx, x - 5, y + 4, 10, 1, '#4e2f1a');
  // liquid + foam
  R(ctx, x - 5, y - 7, 10, 3, b.color);
  R(ctx, x - 5, y - 7, 10, 1, '#fffaf0');
  R(ctx, x - 4, y - 8, 4, 1, '#fffaf0');
  R(ctx, x + 1, y - 8, 3, 1, '#fffaf0');
  R(ctx, x - 6, y - 6, 1, 1, '#fffaf0');
  R(ctx, x + 5, y - 6, 1, 1, '#fffaf0');
  // colored stripe
  R(ctx, x - 4, y - 2, 8, 1, b.color);
  // sparkle
  const sp = Math.sin(t * 5 + cx * 0.4);
  if (sp > 0.5) {
    R(ctx, x - 7, y - 6, 1, 1, '#ffffff');
    R(ctx, x + 7, y + 1, 1, 1, b.color);
  }
}

export function drawBeerIcon(ctx, x, y, key) {
  const b = BEERS[key];
  R(ctx, x, y + 1, 6, 7, '#6b4226');
  R(ctx, x, y + 1, 6, 1, '#a3703f');
  R(ctx, x + 1, y, 5, 2, b.color);
  R(ctx, x + 1, y, 5, 1, '#fffaf0');
  R(ctx, x - 1, y + 2, 1, 3, b.dark);
  R(ctx, x + 6, y + 2, 1, 3, '#8a5a32');
  R(ctx, x + 1, y + 3, 4, 1, b.color);
  R(ctx, x + 1, y + 6, 4, 1, '#4e2f1a');
}

export function drawCauldron(ctx, cx, baseY, t, ready, near) {
  // fire
  const flick = Math.sin(t * 12 + cx) * 1.2;
  R(ctx, cx - 7, baseY - 3, 14, 3, '#3a2416');
  R(ctx, cx - 5, baseY - 6, 3, 4, '#d9562a');
  R(ctx, cx - 1, baseY - 8 - Math.round(flick), 4, 6, '#f08a3c');
  R(ctx, cx + 1, baseY - 10 - Math.round(flick), 2, 4, '#ffe08a');
  R(ctx, cx - 8, baseY - 3, 3, 2, '#6b4226');
  R(ctx, cx + 5, baseY - 3, 3, 2, '#6b4226');

  if (ready) {
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(t * 4) * 0.05;
    pxCircle(ctx, cx, baseY - 12, 22, P.gold);
    ctx.restore();
  }

  // pot
  pxCircle(ctx, cx, baseY - 12, 9, '#2b2f38');
  pxCircle(ctx, cx, baseY - 12, 8, '#3a3f4a');
  R(ctx, cx - 9, baseY - 17, 18, 3, '#4a5261');
  R(ctx, cx - 9, baseY - 17, 18, 1, '#697487');
  R(ctx, cx - 7, baseY - 16, 14, 2, ready ? P.gold : '#6b4a2c');
  R(ctx, cx - 6, baseY - 16, 12, 1, ready ? P.goldHi : '#8a5a32');
  // bubbles
  for (let i = 0; i < 3; i++) {
    const bx = cx - 5 + ((i * 5 + Math.floor(t * 6)) % 11);
    const by = baseY - 15 - ((Math.floor(t * 8) + i * 3) % 4);
    R(ctx, bx, by, 1, 1, ready ? '#fff6d8' : '#a87a4a');
  }
  // steam
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 3; i++) {
    const sx = cx - 4 + i * 4 + Math.sin(t * 2 + i) * 2;
    const sy = baseY - 22 - ((t * 12 + i * 9) % 16);
    R(ctx, sx, sy, 2, 2, '#cfd9e6');
  }
  ctx.restore();
  // paddle
  pxLine(ctx, cx + 4, baseY - 18, cx + 10, baseY - 25, '#6b4226', 2);
  R(ctx, cx + 9, baseY - 27, 3, 3, '#8a5a32');

  if (near) {
    const canBrew = ready;
    const col = canBrew ? P.goldHi : '#7b8794';
    ctx.save();
    ctx.globalAlpha = 0.8;
    R(ctx, cx - 14, baseY - 40, 28, 13, '#0a0f16');
    ctx.globalAlpha = 0.9;
    R(ctx, cx - 14, baseY - 40, 28, 1, canBrew ? P.gold : '#3a4658');
    ctx.restore();
    // down arrow
    R(ctx, cx - 9, baseY - 37, 5, 1, col);
    R(ctx, cx - 8, baseY - 36, 3, 1, col);
    R(ctx, cx - 7, baseY - 35, 1, 1, col);
    // mug
    drawBeerIcon(ctx, cx - 1, baseY - 38, canBrew ? 'fury' : 'stout');
    if (!canBrew) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      R(ctx, cx - 1, baseY - 38, 6, 7, '#0a0f16');
      ctx.restore();
    }
  }
}

export function drawBarrel(ctx, x, baseY, scale = 1) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  R(ctx, -6, -13, 12, 13, '#6b4226');
  R(ctx, -6, -13, 12, 1, '#8a5a32');
  R(ctx, -7, -11, 1, 9, '#4a2c18');
  R(ctx, 6, -11, 1, 9, '#4a2c18');
  R(ctx, -7, -10, 14, 1, '#8b97a8');
  R(ctx, -7, -4, 14, 1, '#8b97a8');
  R(ctx, -5, -12, 3, 1, '#a3703f');
  R(ctx, -3, -7, 1, 4, '#4e2f1a');
  ctx.restore();
}


/* ----------------------------------------------------------------- props -- */

export function drawTorch(ctx, x, baseY, t, seed = 0) {
  const flick = Math.sin(t * 11 + seed * 3) * 1 + Math.sin(t * 17 + seed) * 0.6;
  const glow = 0.1 + Math.sin(t * 8 + seed) * 0.02;
  ctx.save();
  ctx.globalAlpha = glow;
  pxCircle(ctx, x, baseY - 20, 22 + flick, P.ember);
  ctx.restore();

  R(ctx, x - 1, baseY - 15, 3, 15, P.woodDark);
  R(ctx, x - 1, baseY - 15, 1, 15, P.wood);
  R(ctx, x - 3, baseY - 17, 7, 2, P.steelDeep);
  R(ctx, x - 2, baseY - 17, 5, 1, P.steelDark);
  R(ctx, x - 2, baseY - 21, 5, 4, '#d9562a');
  R(ctx, x - 2, baseY - 21, 5, 1, '#f08a3c');
  R(ctx, x - 1, baseY - 24 + Math.round(flick * 0.4), 3, 4, '#f2a33c');
  R(ctx, x, baseY - 26 + Math.round(flick * 0.5), 2, 3, '#ffe08a');
  R(ctx, x, baseY - 27 + Math.round(flick * 0.6), 1, 2, '#fff6d8');
  if (Math.sin(t * 13 + seed) > 0.7) R(ctx, x + 2, baseY - 28, 1, 1, '#ffb347');
}

export function drawCheckpoint(ctx, x, baseY, t, active) {
  const glow = active ? 0.12 + Math.sin(t * 4) * 0.04 : 0;
  if (active) {
    ctx.save();
    ctx.globalAlpha = glow;
    pxCircle(ctx, x + 3, baseY - 14, 20, P.gold);
    ctx.restore();
  }
  // stone base
  R(ctx, x - 6, baseY - 5, 13, 5, '#3b4250');
  R(ctx, x - 6, baseY - 5, 13, 1, '#59616f');
  R(ctx, x - 5, baseY - 9, 11, 4, '#4a5261');
  // pillar
  R(ctx, x - 3, baseY - 22, 7, 14, '#4a5261');
  R(ctx, x - 3, baseY - 22, 1, 14, '#5d6779');
  R(ctx, x + 2, baseY - 22, 1, 14, '#343b48');
  R(ctx, x - 4, baseY - 23, 9, 2, '#5d6779');
  // rune
  const col = active ? P.goldHi : '#6b7484';
  pxLine(ctx, x, baseY - 20, x, baseY - 13, col, 1);
  pxLine(ctx, x, baseY - 20, x + 2, baseY - 18, col, 1);
  pxLine(ctx, x, baseY - 17, x + 2, baseY - 15, col, 1);
  // banner
  if (active) {
    R(ctx, x + 4, baseY - 27, 1, 20, P.woodDark);
    for (let i = 0; i < 5; i++) {
      const w = 10 - i;
      const sway = Math.round(Math.sin(t * 4 + i * 0.5) * 1);
      R(ctx, x + 5 + sway, baseY - 26 + i * 2, w, 2, i % 2 ? P.cloak : P.cloakHi);
    }
    R(ctx, x + 6, baseY - 25, 2, 2, P.gold);
  }
}

export function drawGoal(ctx, x, baseY, t) {
  // mead hall glow
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.sin(t * 2) * 0.04;
  pxCircle(ctx, x + 32, baseY - 32, 36, '#f4c542');
  ctx.restore();

  const stone = '#4a5261';
  const stoneHi = '#697487';
  const stoneDark = '#333a48';
  const stoneDeep = '#252b36';

  // pillars
  for (const px of [0, 50]) {
    R(ctx, x + px, baseY - 62, 14, 62, stone);
    R(ctx, x + px, baseY - 62, 3, 62, stoneHi);
    R(ctx, x + px + 11, baseY - 62, 3, 62, stoneDark);
    R(ctx, x + px - 3, baseY - 66, 20, 5, stoneHi);
    R(ctx, x + px - 3, baseY - 66, 20, 1, '#8b97a8');
    R(ctx, x + px + 2, baseY - 58, 10, 3, stoneDark);
    R(ctx, x + px + 2, baseY - 48, 10, 3, stoneDark);
    R(ctx, x + px + 2, baseY - 38, 10, 3, stoneDark);
    // carved runes
    const rc = Math.sin(t * 3 + px) > 0 ? P.goldHi : P.gold;
    for (let i = 0; i < 3; i++) {
      const ry = baseY - 56 + i * 10;
      pxLine(ctx, x + px + 7, ry, x + px + 7, ry + 5, rc, 1);
      pxLine(ctx, x + px + 7, ry, x + px + 9, ry + 2, rc, 1);
    }
    // cracks
    R(ctx, x + px + 4, baseY - 30, 1, 4, stoneDeep);
    R(ctx, x + px + 5, baseY - 26, 2, 2, stoneDeep);
  }

  // lintel
  R(ctx, x - 3, baseY - 76, 70, 11, stone);
  R(ctx, x - 3, baseY - 76, 70, 2, stoneHi);
  R(ctx, x - 3, baseY - 67, 70, 2, stoneDark);
  // snow on top
  R(ctx, x - 4, baseY - 79, 72, 3, '#e8eef5');
  R(ctx, x - 4, baseY - 79, 72, 1, '#ffffff');
  for (let i = 0; i < 18; i++) {
    if ((i * 7) % 3 === 0) R(ctx, x - 4 + i * 4, baseY - 76, 2, 1, '#cfd9e6');
  }

  // hanging brewery sign
  R(ctx, x + 20, baseY - 92, 1, 8, '#8b97a8');
  R(ctx, x + 43, baseY - 92, 1, 8, '#8b97a8');
  R(ctx, x + 16, baseY - 85, 32, 15, '#6b4226');
  R(ctx, x + 16, baseY - 85, 32, 1, '#a3703f');
  R(ctx, x + 16, baseY - 71, 32, 1, '#3a2212');
  R(ctx, x + 17, baseY - 84, 30, 1, '#4e2f1a');
  drawBeerIcon(ctx, x + 23, baseY - 82, 'fury');
  R(ctx, x + 33, baseY - 79, 8, 1, P.gold);
  R(ctx, x + 34, baseY - 77, 6, 1, P.goldDark);
  R(ctx, x + 33, baseY - 75, 8, 1, P.gold);

  // dragon heads at lintel ends
  for (const side of [0, 1]) {
    const dx = side ? x + 57 : x + 4;
    R(ctx, dx, baseY - 82, 7, 6, '#5d6779');
    R(ctx, dx + (side ? 4 : -2), baseY - 84, 5, 4, '#697487');
    R(ctx, dx + (side ? 8 : -4), baseY - 83, 2, 2, P.gold);
    R(ctx, dx + (side ? 9 : -5), baseY - 82, 1, 1, '#ff6b5a');
  }

  // portal (mead glow)
  const innerX = x + 14;
  const innerW = 36;
  R(ctx, innerX, baseY - 62, innerW, 62, '#140f08');
  R(ctx, innerX, baseY - 62, innerW, 3, '#3a2a12');
  for (let i = 0; i < 6; i++) {
    const a = 0.12 + Math.sin(t * 2 + i * 0.9) * 0.06;
    ctx.save();
    ctx.globalAlpha = a;
    const w = 10 + i * 4;
    R(ctx, innerX + innerW / 2 - w / 2, baseY - 56 + i * 7, w, 3, i % 2 ? P.gold : '#ffe08a');
    ctx.restore();
  }
  for (let i = 0; i < 7; i++) {
    const sx = innerX + 3 + ((i * 11 + Math.floor(t * 12)) % (innerW - 6));
    const sy = baseY - 54 + ((i * 17 + Math.floor(t * 9)) % 48);
    R(ctx, sx, sy, 1, 1, i % 3 ? '#fff6d8' : '#ffe08a');
  }
  // arch highlight
  R(ctx, innerX, baseY - 62, 2, 62, stoneDark);
  R(ctx, innerX + innerW - 2, baseY - 62, 2, 62, stoneDark);
  R(ctx, innerX, baseY - 62, innerW, 2, P.goldDark);

  // barrels by the door
  drawBarrel(ctx, x - 3, baseY, 1);
  drawBarrel(ctx, x + 55, baseY, 1);
  drawBarrel(ctx, x + 4, baseY - 13, 0.8);
}

/* ---------------------------------------------------------------- scenery -- */

export function drawPine(ctx, x, baseY, h, seed, colors, snowColor = '#dfe8f2') {
  const trunkH = Math.max(4, h * 0.16);
  R(ctx, x - 1, baseY - trunkH, 3, trunkH, '#241a12');
  R(ctx, x - 1, baseY - trunkH, 1, trunkH, '#33251a');
  const tiers = 4;
  const tierH = (h - trunkH) / tiers;
  for (let i = 0; i < tiers; i++) {
    const topY = baseY - trunkH - tierH * (i + 1);
    const width = h * 0.3 * (1 - i * 0.19);
    const jitter = Math.round((hash(seed, i) - 0.5) * 3);
    for (let yy = 0; yy < tierH; yy++) {
      const t = (yy + 1) / tierH;
      const w = Math.max(1, Math.round(width * t + jitter));
      R(ctx, x - w, topY + yy, w * 2, 1, colors[i % 2]);
      if (yy < tierH * 0.45) {
        R(ctx, x - w, topY + yy, Math.max(1, Math.round(w * 0.55)), 1, snowColor);
      }
    }
    R(ctx, x - Math.round(width * 0.25), topY + Math.round(tierH * 0.5), 2, 1, 'rgba(0,0,0,0.18)');
  }
  R(ctx, x - 1, baseY - trunkH - 2, 2, 2, colors[0]);
}

export function drawRuin(ctx, x, baseY, h, seed, snowColor = '#dfe8f2') {
  const w = 10 + Math.floor(hash(seed, 1) * 5);
  const top = baseY - h;
  R(ctx, x - w / 2, top, w, h, '#4a5261');
  R(ctx, x - w / 2, top, 2, h, '#5d6779');
  R(ctx, x + w / 2 - 2, top, 2, h, '#343b48');
  R(ctx, x - w / 2 - 2, top, w + 4, 3, '#697487');
  R(ctx, x - w / 2 - 2, baseY - 4, w + 4, 4, '#343b48');
  R(ctx, x - w / 2 - 2, top, w + 4, 1, snowColor);
  // broken top
  R(ctx, x - w / 2 + 2, top - 3, 4, 3, '#4a5261');
  R(ctx, x + 1, top - 2, 3, 2, '#5d6779');
  // runes
  const rc = '#7fe7d4';
  for (let i = 0; i < Math.min(3, Math.floor(h / 12)); i++) {
    const ry = top + 8 + i * 11;
    R(ctx, x, ry, 1, 4, rc);
    R(ctx, x, ry, 2, 1, rc);
    R(ctx, x, ry + 3, 2, 1, rc);
  }
  R(ctx, x - w / 2 + 2, top + h * 0.5, 1, 5, '#2a303c');
}

export function drawRock(ctx, x, baseY, r, seed, snowColor = '#dfe8f2') {
  pxCircle(ctx, x, baseY - r * 0.5, r, '#4a5261');
  pxCircle(ctx, x - 1, baseY - r * 0.5 - 1, r - 1, '#59616f');
  R(ctx, x - r + 2, baseY - r * 0.5 - r + 1, Math.round(r * 1.4), 2, snowColor);
  R(ctx, x - 2, baseY - 2, 3, 2, '#343b48');
}

export function drawLongship(ctx, x, baseY, scale, color) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  // hull
  pxLine(ctx, -30, -8, 30, -8, color, 3);
  pxLine(ctx, -30, -8, -26, -1, color, 2);
  pxLine(ctx, 30, -8, 26, -1, color, 2);
  pxLine(ctx, -26, -1, 26, -1, color, 2);
  pxLine(ctx, -22, -5, 22, -5, color, 1);
  // dragon prow
  pxLine(ctx, -30, -8, -35, -14, color, 2);
  pxLine(ctx, -35, -14, -33, -18, color, 2);
  R(ctx, -34, -19, 2, 2, color);
  // stern
  pxLine(ctx, 30, -8, 34, -14, color, 2);
  // mast
  R(ctx, -1, -34, 2, 27, color);
  // sail
  for (let i = 0; i < 12; i++) {
    const w = 16 - Math.abs(i - 5) * 2;
    R(ctx, -w, -31 + i * 2, w * 2, 2, color);
  }
  // shields
  for (let i = 0; i < 5; i++) R(ctx, -18 + i * 8, -7, 3, 3, color);
  // oars
  for (let i = 0; i < 4; i++) {
    pxLine(ctx, -14 + i * 9, -3, -17 + i * 9, 3, color, 1);
  }
  ctx.restore();
}

/* -------------------------------------------------------------- hud bits -- */

const HEART = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000',
];

export function drawHeart(ctx, x, y, filled) {
  const base = filled ? '#d94b4b' : '#3a2a33';
  const hi = filled ? '#ff8a8a' : '#4a3a44';
  for (let row = 0; row < HEART.length; row++) {
    for (let col = 0; col < HEART[row].length; col++) {
      if (HEART[row][col] === '1') {
        R(ctx, x + col, y + row, 1, 1, base);
      }
    }
  }
  R(ctx, x + 1, y + 1, 2, 1, hi);
  R(ctx, x + 2, y + 2, 1, 1, hi);
}

export function drawRuneIcon(ctx, x, y) {
  R(ctx, x, y, 8, 9, '#25333c');
  R(ctx, x, y, 8, 1, '#4d6472');
  R(ctx, x + 1, y + 1, 6, 7, '#1a242c');
  pxLine(ctx, x + 3, y + 2, x + 3, y + 7, P.rune, 1);
  pxLine(ctx, x + 3, y + 2, x + 5, y + 4, P.rune, 1);
  pxLine(ctx, x + 3, y + 4, x + 5, y + 6, P.rune, 1);
}
