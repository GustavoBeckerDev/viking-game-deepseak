import { T, TILE } from './constants.js';
import { MATERIAL_ORDER } from './beers.js';

export class Level {
  constructor({ w, h, name, theme, index }) {
    this.w = w;
    this.h = h;
    this.name = name;
    this.theme = theme;
    this.index = index;
    this.tiles = new Uint8Array(w * h);
    this.entities = [];
    this.decor = [];
    this.spawn = { x: 3 * TILE, y: (h - 3) * TILE };
    this.nextId = 1;
    this.goal = null;
  }

  idx(tx, ty) {
    return ty * this.w + tx;
  }

  get(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.ROCK;
    if (ty < 0 || ty >= this.h) return T.EMPTY;
    return this.tiles[this.idx(tx, ty)];
  }

  set(tx, ty, v) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.tiles[this.idx(tx, ty)] = v;
  }

  fill(x, y, w, h, v) {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) this.set(tx, ty, v);
    }
  }

  ground(x0, x1, top) {
    this.fill(x0, top, x1 - x0 + 1, this.h - top, T.ROCK);
    for (let x = x0; x <= x1; x++) this.set(x, top, T.SNOW);
  }

  pit(x0, x1) {
    this.fill(x0, 0, x1 - x0 + 1, this.h, T.EMPTY);
    this.fill(x0, this.h - 2, x1 - x0 + 1, 2, T.WATER);
  }

  platform(x, y, w, type = T.WOOD) {
    this.fill(x, y, w, 1, type);
  }

  ice(x0, x1, top) {
    for (let x = x0; x <= x1; x++) this.set(x, top, T.ICE);
  }

  spikes(x, top, w = 1) {
    for (let i = 0; i < w; i++) this.set(x + i, top - 1, T.SPIKE);
  }

  add(entity) {
    entity.id = this.nextId++;
    entity.spawnX = entity.x;
    entity.spawnY = entity.y;
    if (entity.dead === undefined) entity.dead = false;
    if (entity.taken === undefined) entity.taken = false;
    this.entities.push(entity);
    return entity;
  }

  mat(tx, ty, key) {
    return this.add({
      type: 'mat',
      mat: key,
      x: tx * TILE + 3,
      y: ty * TILE + 3,
      w: 10,
      h: 10,
    });
  }

  matsRow(x, count, row, keys = MATERIAL_ORDER) {
    for (let i = 0; i < count; i++) this.mat(x + i, row, keys[i % keys.length]);
  }

  matsArc(x, count, row, keys = MATERIAL_ORDER) {
    const mid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const high = Math.abs(i - mid) < 1.1 ? 1 : 0;
      this.mat(x + i, row - high, keys[i % keys.length]);
    }
  }

  beer(tx, top, key) {
    return this.add({
      type: 'beer',
      beer: key,
      x: tx * TILE + 1,
      y: top * TILE - 18,
      w: 14,
      h: 18,
    });
  }

  cauldron(tx, top) {
    return this.add({
      type: 'cauldron',
      x: tx * TILE - 1,
      y: top * TILE - 20,
      w: 18,
      h: 20,
      cooldown: 0,
    });
  }

  draugr(tx, top) {
    return this.add({
      type: 'draugr',
      x: tx * TILE + 1,
      y: top * TILE - 26,
      w: 14,
      h: 26,
      vx: 0,
      vy: 0,
      dir: Math.random() < 0.5 ? -1 : 1,
      phase: Math.random() * 6,
      hp: 1,
    });
  }

  raven(tx, row) {
    return this.add({
      type: 'raven',
      x: tx * TILE,
      y: row * TILE,
      w: 16,
      h: 12,
      baseY: row * TILE,
      phase: Math.random() * 6,
      dir: -1,
      hp: 1,
    });
  }

  torch(tx, top) {
    return this.add({
      type: 'torch',
      x: tx * TILE + 4,
      y: top * TILE - 20,
      w: 8,
      h: 20,
      seed: tx,
    });
  }

  checkpoint(tx, top) {
    return this.add({
      type: 'checkpoint',
      x: tx * TILE + 1,
      y: top * TILE - 28,
      w: 14,
      h: 28,
      active: false,
    });
  }

  setGoal(tx, top) {
    const goal = this.add({
      type: 'goal',
      x: tx * TILE,
      y: top * TILE - 80,
      w: 64,
      h: 80,
    });
    this.goal = goal;
    return goal;
  }

  setSpawn(tx, top) {
    this.spawn = { x: tx * TILE + 2, y: top * TILE - 30 };
  }

  pine(tx, top, h) {
    this.decor.push({
      kind: 'pine',
      x: tx * TILE + 8,
      y: top * TILE,
      h,
      seed: tx * 13 + 7,
    });
  }

  ruin(tx, top, h = 30) {
    this.decor.push({
      kind: 'ruin',
      x: tx * TILE + 8,
      y: top * TILE,
      h,
      seed: tx * 7 + 3,
    });
  }

  rock(tx, top, r = 5) {
    this.decor.push({
      kind: 'rock',
      x: tx * TILE + 8,
      y: top * TILE,
      r,
      seed: tx * 5 + 1,
    });
  }

  get totalMaterials() {
    let n = 0;
    for (const e of this.entities) if (e.type === 'mat') n++;
    return n;
  }
}

/* ------------------------------------------------------------- level 1 -- */

function level1() {
  const L = new Level({ w: 192, h: 18, name: 'FJORD GELADO', theme: 'dusk', index: 0 });
  L.setSpawn(3, 15);
  let mi = 0;
  const next = () => MATERIAL_ORDER[mi++ % MATERIAL_ORDER.length];

  L.ground(0, 24, 15);
  L.torch(4, 15);
  L.torch(21, 15);
  L.pine(1, 15, 78);
  L.pine(11, 15, 56);
  L.pine(23, 15, 92);
  L.rock(7, 15, 4);
  L.matsArc(8, 5, 12);
  L.beer(20, 15, 'fury');
  L.draugr(16, 15);

  L.pit(25, 28);
  L.platform(26, 12, 2);
  L.mat(26, 10, next());
  L.mat(27, 10, next());

  L.ground(29, 46, 15);
  L.torch(33, 15);
  L.matsArc(31, 4, 11);
  L.platform(34, 12, 3);
  L.mat(34, 10, next());
  L.mat(35, 10, next());
  L.mat(36, 10, next());
  L.draugr(38, 15);
  L.draugr(43, 15);
  L.beer(41, 15, 'stout');
  L.spikes(45, 15, 1);

  L.pit(47, 51);
  L.platform(48, 13, 2);
  L.platform(50, 11, 2);
  L.mat(48, 11, next());
  L.mat(50, 9, next());

  L.ground(52, 70, 15);
  L.checkpoint(55, 15);
  L.cauldron(58, 15);
  L.platform(60, 12, 4);
  L.mat(60, 10, next());
  L.mat(62, 10, next());
  L.mat(64, 10, next());
  L.raven(62, 10);
  L.draugr(66, 15);
  L.draugr(69, 15);
  L.torch(62, 15);
  L.pine(53, 15, 66);
  L.pine(69, 15, 84);

  L.pit(71, 74);
  L.platform(72, 12, 2);
  L.mat(72, 10, next());

  L.ground(75, 100, 15);
  L.ruin(78, 15, 30);
  L.ruin(88, 15, 22);
  L.ruin(98, 15, 36);
  L.matsRow(76, 3, 13);
  L.draugr(81, 15);
  L.draugr(89, 15);
  L.draugr(96, 15);
  L.raven(85, 10);
  L.spikes(92, 15, 2);
  L.beer(86, 15, 'ipa');
  L.platform(90, 11, 4);
  L.mat(90, 9, next());
  L.mat(92, 9, next());
  L.mat(94, 9, next());
  L.pine(76, 15, 72);
  L.pine(97, 15, 90);

  L.pit(101, 105);
  L.platform(102, 13, 2);
  L.platform(104, 12, 2);
  L.mat(102, 11, next());
  L.mat(104, 10, next());

  L.ground(106, 130, 15);
  L.torch(108, 15);
  L.torch(123, 15);
  L.spikes(112, 15, 3);
  L.draugr(118, 15);
  L.draugr(124, 15);
  L.raven(121, 9);
  L.platform(116, 12, 3);
  L.mat(116, 10, next());
  L.mat(117, 10, next());
  L.mat(118, 10, next());
  L.beer(119, 15, 'winter');
  L.checkpoint(127, 15);
  L.cauldron(129, 15);
  L.pine(107, 15, 64);
  L.pine(129, 15, 86);

  L.ground(131, 138, 14);
  L.ground(139, 146, 13);
  L.ground(147, 191, 12);
  L.torch(150, 12);
  L.torch(170, 12);
  L.draugr(154, 12);
  L.draugr(163, 12);
  L.raven(158, 7);
  L.matsArc(155, 5, 9);
  L.beer(150, 12, 'fury');
  L.pine(148, 12, 70);
  L.pine(172, 12, 94);
  L.setGoal(168, 12);

  return L;
}

/* ------------------------------------------------------------- level 2 -- */

function level2() {
  const L = new Level({ w: 176, h: 18, name: 'CERVEJARIA DE JOTUNHEIM', theme: 'night', index: 1 });
  L.setSpawn(2, 15);
  let mi = 0;
  const next = () => MATERIAL_ORDER[mi++ % MATERIAL_ORDER.length];

  L.ground(0, 18, 15);
  L.torch(3, 15);
  L.pine(1, 15, 86);
  L.matsRow(6, 4, 12);
  L.beer(12, 15, 'winter');
  L.draugr(14, 15);
  L.rock(16, 15, 5);

  L.pit(19, 22);

  L.ground(23, 40, 14);
  L.ice(29, 34, 14);
  L.platform(26, 11, 3);
  L.mat(26, 9, next());
  L.mat(27, 9, next());
  L.mat(28, 9, next());
  L.draugr(33, 14);
  L.spikes(36, 14, 2);
  L.ruin(39, 14, 34);
  L.raven(31, 9);
  L.beer(31, 14, 'stout');

  L.pit(41, 45);
  L.platform(42, 12, 2);
  L.platform(44, 11, 2);
  L.mat(42, 10, next());
  L.mat(44, 9, next());

  L.ground(46, 62, 15);
  L.checkpoint(49, 15);
  L.cauldron(52, 15);
  L.platform(55, 12, 3);
  L.platform(59, 10, 3);
  L.mat(55, 10, next());
  L.mat(59, 8, next());
  L.mat(60, 8, next());
  L.draugr(57, 15);
  L.draugr(61, 15);
  L.raven(59, 7);
  L.torch(51, 15);
  L.pine(47, 15, 74);
  L.beer(58, 15, 'fury');

  L.pit(63, 66);

  L.ground(67, 84, 13);
  L.ice(70, 76, 13);
  L.spikes(78, 13, 2);
  L.draugr(73, 13);
  L.draugr(82, 13);
  L.ruin(69, 13, 40);
  L.ruin(81, 13, 26);
  L.matsArc(74, 4, 10);
  L.beer(80, 13, 'ipa');

  L.pit(85, 89);
  L.platform(86, 12, 2);
  L.platform(88, 11, 2);
  L.mat(86, 10, next());
  L.mat(88, 9, next());

  L.ground(90, 110, 15);
  L.checkpoint(93, 15);
  L.cauldron(96, 15);
  L.spikes(99, 15, 3);
  L.draugr(97, 15);
  L.draugr(103, 15);
  L.draugr(108, 15);
  L.raven(101, 9);
  L.platform(105, 11, 4);
  L.mat(105, 9, next());
  L.mat(107, 9, next());
  L.mat(109, 9, next());
  L.beer(104, 15, 'winter');
  L.torch(100, 15);
  L.ruin(92, 15, 30);

  L.pit(111, 115);
  L.platform(112, 13, 2);
  L.platform(114, 12, 2);
  L.mat(112, 11, next());
  L.mat(114, 10, next());

  L.ground(116, 134, 12);
  L.torch(118, 12);
  L.torch(130, 12);
  L.draugr(121, 12);
  L.draugr(127, 12);
  L.raven(124, 7);
  L.matsArc(119, 5, 9);
  L.beer(132, 12, 'fury');
  L.pine(117, 12, 72);
  L.pine(133, 12, 90);

  L.ground(135, 175, 12);
  L.draugr(140, 12);
  L.raven(144, 7);
  L.matsArc(145, 5, 9);
  L.torch(150, 12);
  L.beer(152, 12, 'stout');
  L.pine(155, 12, 82);
  L.setGoal(158, 12);

  return L;
}

export function buildLevel(index) {
  return index === 1 ? level2() : level1();
}
