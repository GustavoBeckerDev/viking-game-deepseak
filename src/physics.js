import { TILE, T, isSolid } from './constants.js';

export function moveX(level, e, dx) {
  e.x += dx;
  e.hitWall = 0;
  if (dx === 0) return;
  const top = Math.floor(e.y / TILE);
  const bottom = Math.floor((e.y + e.h - 1) / TILE);
  if (dx > 0) {
    const tx = Math.floor((e.x + e.w - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.get(tx, ty))) {
        e.x = tx * TILE - e.w;
        e.hitWall = 1;
        break;
      }
    }
  } else {
    const tx = Math.floor(e.x / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.get(tx, ty))) {
        e.x = (tx + 1) * TILE;
        e.hitWall = -1;
        break;
      }
    }
  }
}

export function moveY(level, e, dy) {
  e.y += dy;
  e.grounded = false;
  e.hitCeiling = false;
  if (dy === 0) return;
  const left = Math.floor(e.x / TILE);
  const right = Math.floor((e.x + e.w - 1) / TILE);
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(level.get(tx, ty))) {
        e.y = ty * TILE - e.h;
        e.vy = 0;
        e.grounded = true;
        break;
      }
    }
  } else {
    const ty = Math.floor(e.y / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(level.get(tx, ty))) {
        e.y = (ty + 1) * TILE;
        e.vy = 0;
        e.hitCeiling = true;
        break;
      }
    }
  }
}

export function hazardInBox(level, box) {
  const x0 = Math.floor(box.x / TILE);
  const x1 = Math.floor((box.x + box.w - 1) / TILE);
  const y0 = Math.floor(box.y / TILE);
  const y1 = Math.floor((box.y + box.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.get(tx, ty);
      if (t === T.WATER) return T.WATER;
      if (t === T.SPIKE) return T.SPIKE;
    }
  }
  return T.EMPTY;
}

export function waterInBox(level, box) {
  const x0 = Math.floor(box.x / TILE);
  const x1 = Math.floor((box.x + box.w - 1) / TILE);
  const y0 = Math.floor(box.y / TILE);
  const y1 = Math.floor((box.y + box.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (level.get(tx, ty) === T.WATER) return true;
    }
  }
  return false;
}

export function waterSurface(level, x, y) {
  const tx = Math.floor(x / TILE);
  let ty = Math.floor(y / TILE);
  while (ty > 0 && level.get(tx, ty - 1) === T.WATER) ty--;
  return ty * TILE;
}

export function waterBottom(level, x, y) {
  const tx = Math.floor(x / TILE);
  let ty = Math.floor(y / TILE);
  while (ty < level.h - 1 && level.get(tx, ty + 1) === T.WATER) ty++;
  return (ty + 1) * TILE;
}

export function waterSpanAt(level, x, feetY) {
  const tx = Math.floor(x / TILE);
  let best = null;
  for (let ty = 0; ty < level.h; ty++) {
    if (level.get(tx, ty) !== T.WATER) continue;
    let top = ty;
    let bottom = ty;
    while (bottom < level.h - 1 && level.get(tx, bottom + 1) === T.WATER) bottom++;
    const span = { top: top * TILE, bottom: (bottom + 1) * TILE };
    if (!best || Math.abs(span.bottom - feetY) < Math.abs(best.bottom - feetY)) best = span;
    ty = bottom;
  }
  return best;
}

export function tileBelow(level, x, y) {
  return level.get(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
