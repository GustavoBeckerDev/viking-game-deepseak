import { VIEW_W, VIEW_H, TILE, isSolid } from './constants.js';
import { rectsOverlap } from './physics.js';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { updateEntities, resetEnemies } from './entities.js';
import { renderGame } from './render.js';
import { MATERIAL_ORDER, MATERIALS, BEERS, BEER_KEYS } from './beers.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor({ canvas, input, sfx, ui }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.ui = ui;

    this.levelIndex = 0;
    this.level = buildLevel(0);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y);
    this.respawnPoint = { ...this.level.spawn };

    this.camera = { x: 0, y: 0 };
    this.time = 0;
    this.elapsed = 0;

    this.materials = { honey: 0, barley: 0, hops: 0, water: 0 };
    this.materialsCollected = 0;
    this.totalMaterialsCollected = 0;
    this.beersDrunk = 0;
    this.totalBeers = 0;
    this.brews = 0;
    this.totalBrews = 0;
    this.totalTime = 0;
    this.deaths = 0;

    this.beer = null;
    this.shield = 0;
    this.drunk = 0;
    this.regenT = 0;
    this.auraT = 0;
    this.swayX = 0;
    this.swayY = 0;

    this.axes = 3;
    this.maxAxes = 3;
    this.axeCharge = 0;
    this.projectiles = [];

    this.particles = [];
    this.shakeT = 0;
    this.shakeDur = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flashT = 0;

    this.state = 'title';
    this.introT = 0;
    this.completeT = 0;
    this.completeShown = false;

    this.best = this.loadBest();
    this.snapCamera();
  }

  get materialsTotal() {
    return MATERIAL_ORDER.reduce((sum, key) => sum + this.materials[key], 0);
  }

  speedMultiplier() {
    return this.beer ? BEERS[this.beer.key].speed || 1 : 1;
  }

  jumpMultiplier() {
    return this.beer ? BEERS[this.beer.key].jump || 1 : 1;
  }

  enemyTimeScale() {
    return this.beer ? BEERS[this.beer.key].enemyScale || 1 : 1;
  }

  loadBest() {
    try {
      return JSON.parse(localStorage.getItem('vikingr.best') || 'null');
    } catch (err) {
      return null;
    }
  }

  saveBest() {
    const run = {
      materials: this.totalMaterialsCollected,
      time: Math.round(this.totalTime),
      beers: this.totalBeers,
    };
    const prev = this.best;
    const better = !prev
      || run.materials > prev.materials
      || (run.materials === prev.materials && run.time < prev.time);
    if (better) {
      this.best = run;
      try {
        localStorage.setItem('vikingr.best', JSON.stringify(run));
      } catch (err) {
        /* ignore */
      }
    }
  }

  startNewGame() {
    this.deaths = 0;
    this.totalMaterialsCollected = 0;
    this.totalBeers = 0;
    this.totalBrews = 0;
    this.totalTime = 0;
    this.startLevel(0);
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = buildLevel(index);
    this.respawnPoint = { ...this.level.spawn };
    this.player.reset(this.level.spawn.x, this.level.spawn.y);
    this.player.hp = this.player.maxHp;

    this.materials = { honey: 0, barley: 0, hops: 0, water: 0 };
    this.materialsCollected = 0;
    this.beersDrunk = 0;
    this.brews = 0;
    this.beer = null;
    this.shield = 0;
    this.drunk = 0;
    this.regenT = 0;
    this.auraT = 0;
    this.swayX = 0;
    this.swayY = 0;

    this.axes = this.maxAxes;
    this.axeCharge = 0;
    this.projectiles = [];

    this.elapsed = 0;
    this.particles = [];
    this.state = 'intro';
    this.introT = 1.7;
    this.completeT = 0;
    this.completeShown = false;
    this.flashT = 0;
    this.shakeT = 0;
    this.snapCamera();
    this.ui.hide();
    this.ui.banner(`FASE ${index + 1}`, this.level.name);
    this.sfx.ensure();
  }

  restartLevel() {
    this.startLevel(this.levelIndex);
  }

  nextLevel() {
    this.startLevel(this.levelIndex + 1);
  }

  toTitle() {
    this.levelIndex = 0;
    this.level = buildLevel(0);
    this.player.reset(this.level.spawn.x, this.level.spawn.y);
    this.player.hp = this.player.maxHp;
    this.particles = [];
    this.beer = null;
    this.shield = 0;
    this.drunk = 0;
    this.regenT = 0;
    this.auraT = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.materials = { honey: 0, barley: 0, hops: 0, water: 0 };
    this.materialsCollected = 0;
    this.beersDrunk = 0;
    this.brews = 0;
    this.axes = this.maxAxes;
    this.axeCharge = 0;
    this.projectiles = [];
    this.elapsed = 0;
    this.flashT = 0;
    this.shakeT = 0;
    this.completeT = 0;
    this.introT = 0;
    this.state = 'title';
    this.snapCamera();
    this.ui.showTitle();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.state = 'paused';
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hide();
  }

  snapCamera() {
    const L = this.level;
    const p = this.player;
    this.camera.x = clamp(p.cx - VIEW_W * 0.45, 0, Math.max(0, L.w * TILE - VIEW_W));
    this.camera.y = clamp(p.cy - VIEW_H * 0.58, 0, Math.max(0, L.h * TILE - VIEW_H));
  }

  updateCamera(dt) {
    const L = this.level;
    const p = this.player;
    const maxX = Math.max(0, L.w * TILE - VIEW_W);
    const maxY = Math.max(0, L.h * TILE - VIEW_H);
    const tx = clamp(p.cx - VIEW_W * 0.45 + clamp(p.vx * 0.22, -40, 40), 0, maxX);
    const ty = clamp(p.cy - VIEW_H * 0.58, 0, maxY);
    const kx = 1 - Math.exp(-8 * dt);
    const ky = 1 - Math.exp(-6 * dt);
    this.camera.x += (tx - this.camera.x) * kx;
    this.camera.y += (ty - this.camera.y) * ky;
  }

  update(dt) {
    dt = Math.max(0, Math.min(dt, 0.05));
    this.time += dt;
    this.flashT = Math.max(0, this.flashT - dt * 2.4);

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur);
      this.shakeX = Math.round((Math.random() * 2 - 1) * this.shakeMag * k);
      this.shakeY = Math.round((Math.random() * 2 - 1) * this.shakeMag * k);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.state === 'title') {
      this.player.update(dt, this);
      updateEntities(this, dt);
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'paused') return;

    if (this.state === 'playing' || this.state === 'intro' || this.state === 'complete') {
      this.updateAxes(dt);
      this.updateProjectiles(dt);
    }

    const active = this.state === 'playing' || this.state === 'intro' || this.state === 'complete';
    if (active) {
      this.updateBeer(dt);
      this.updateAura(dt);
      this.updateSway();
    }

    if (this.state === 'intro') {
      this.introT -= dt;
      this.player.update(dt, this);
      updateEntities(this, dt * this.enemyTimeScale());
      this.updateParticles(dt);
      this.updateCamera(dt);
      if (this.introT <= 0) this.state = 'playing';
      return;
    }

    if (this.state === 'complete') {
      this.completeT -= dt;
      this.player.update(dt, this);
      updateEntities(this, dt * this.enemyTimeScale());
      this.updateParticles(dt);
      this.updateCamera(dt);
      if (this.completeT <= 0 && !this.completeShown) {
        this.completeShown = true;
        const stats = this.stats();
        if (stats.last) this.ui.showVictory(stats);
        else this.ui.showLevelComplete(stats);
      }
      return;
    }

    if (this.state === 'playing') {
      this.elapsed += dt;
      this.player.update(dt, this);
      updateEntities(this, dt * this.enemyTimeScale());
      this.updateParticles(dt);
      this.updateCamera(dt);
      if (this.player.dead && this.player.deathT <= 0) this.respawn();
    }
  }

  updateAxes(dt) {
    if (this.axes >= this.maxAxes) {
      this.axeCharge = 0;
      return;
    }
    this.axeCharge += dt;
    while (this.axeCharge >= 3 && this.axes < this.maxAxes) {
      this.axes++;
      this.axeCharge -= 3;
    }
    if (this.axes >= this.maxAxes) this.axeCharge = 0;
  }

  throwAxe(player) {
    if (this.state !== 'playing') return false;
    if (player.throwT > 0) return false;
    if (this.axes <= 0) {
      this.sfx.play('ui');
      this.ui.toast('SEM MACHADOS', 'Cada machado volta em 3s');
      return false;
    }
    this.axes--;
    const dir = player.facing;
    this.projectiles.push({
      x: player.cx + dir * 9,
      y: player.y + 8,
      w: 13,
      h: 13,
      vx: dir * 340,
      vy: -70,
      rot: 0,
      rotSpeed: dir * 21,
      life: 1.9,
      stuck: 0,
    });
    this.sfx.play('throw');
    this.spawnDust(player.cx + dir * 7, player.y + 13, 4);
    return true;
  }

  updateProjectiles(dt) {
    const level = this.level;
    for (const p of this.projectiles) {
      if (p.stuck > 0) {
        p.stuck -= dt;
        p.rot += p.rotSpeed * dt * 0.25;
        continue;
      }
      p.life -= dt;
      p.vy += 760 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;

      const tx = Math.floor((p.x + p.w / 2) / TILE);
      const ty = Math.floor((p.y + p.h / 2) / TILE);
      if (isSolid(level.get(tx, ty))) {
        p.stuck = 0.4;
        p.vx = 0;
        p.vy = 0;
        this.spawnSparks(p.x + p.w / 2, p.y + p.h / 2, 5, '#cfd9e6');
        continue;
      }

      for (const e of level.entities) {
        if ((e.type === 'draugr' || e.type === 'raven') && !e.dead && rectsOverlap(p, e)) {
          this.killEnemy(e, false, 'axe');
          p.stuck = 0.3;
          p.vx = 0;
          p.vy = 0;
          this.spawnSparks(p.x + p.w / 2, p.y + p.h / 2, 11, '#dff3ff');
          break;
        }
      }

      if (p.x < -48 || p.x > level.w * TILE + 48 || p.y > level.h * TILE + 64) p.life = 0;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  updateBeer(dt) {
    if (!this.beer) {
      this.regenT = 0;
      return;
    }
    this.beer.t -= dt;
    if (this.beer.t <= 0) {
      this.beer = null;
      this.drunk = Math.max(0, this.drunk - 1);
      return;
    }
    if (this.beer.key === 'winter' && this.state === 'playing') {
      if (this.player.hp < this.player.maxHp) {
        this.regenT += dt;
        if (this.regenT >= 4) {
          this.regenT = 0;
          this.player.hp++;
          this.sfx.play('mead');
          this.spawnSparks(this.player.cx, this.player.cy, 10, '#dff3ff');
          this.ui.toast('REGENERAÇÃO', '+1 vida');
        }
      } else {
        this.regenT = 0;
      }
    }
  }

  updateAura(dt) {
    if (!this.beer) {
      this.auraT = 0;
      return;
    }
    this.auraT -= dt;
    if (this.auraT > 0) return;
    this.auraT = 0.12;
    const p = this.player;
    const key = this.beer.key;
    const palette = {
      fury: ['#f4c542', '#ffe08a', '#f2a33c'],
      stout: ['#eef4fb', '#b9c7d8', '#dfe8f2'],
      ipa: ['#8fd67f', '#c8f2a0', '#4f8a4a'],
      winter: ['#dff3ff', '#9fd8ff', '#ffffff'],
    }[key];
    const color = palette[Math.floor(Math.random() * palette.length)];
    let x;
    let y;
    let vx;
    let vy;
    if (key === 'stout') {
      const a = Math.random() * Math.PI * 2;
      x = p.cx + Math.cos(a) * 15;
      y = p.cy + Math.sin(a) * 15;
      vx = Math.cos(a) * 6;
      vy = -10 - Math.random() * 8;
    } else {
      x = p.cx + (Math.random() - 0.5) * 18;
      y = p.y + Math.random() * p.h;
      vx = (Math.random() - 0.5) * 12;
      vy = -18 - Math.random() * 20;
    }
    this.particles.push({
      x,
      y,
      vx,
      vy,
      gravity: key === 'stout' ? 10 : -8,
      life: 0.7 + Math.random() * 0.4,
      maxLife: 1.1,
      size: key === 'winter' ? (Math.random() > 0.5 ? 2 : 1) : 1,
      color,
    });
    this.trimParticles();
  }

  updateSway() {
    if (this.beer && this.drunk >= 2) {
      this.swayX = Math.sin(this.time * 2.1) * 1.3;
      this.swayY = Math.cos(this.time * 1.7) * 0.7;
    } else {
      this.swayX = 0;
      this.swayY = 0;
    }
  }

  render() {
    renderGame(this.ctx, this);
  }

  stats() {
    return {
      level: this.levelIndex + 1,
      name: this.level.name,
      materials: this.materialsCollected,
      total: this.level.totalMaterials,
      breakdown: { ...this.materials },
      beers: this.beersDrunk,
      brews: this.brews,
      time: this.elapsed,
      deaths: this.deaths,
      last: this.levelIndex >= 1,
      best: this.best,
      run: {
        materials: this.totalMaterialsCollected,
        beers: this.totalBeers,
        brews: this.totalBrews,
        time: this.totalTime,
        deaths: this.deaths,
      },
    };
  }

  killPlayer(cause) {
    if (this.player.dead) return;
    this.player.dead = true;
    this.player.deathCause = cause;
    this.player.deathT = cause === 'water' ? 1.1 : 1.5;
    this.player.vy = cause === 'water' ? -110 : -300;
    this.player.vx = 0;
    this.deaths++;
    this.sfx.play(cause === 'water' ? 'splash' : 'death');
    this.shake(8, 0.4);
    this.flash(0.3);
    if (cause === 'water') this.spawnSplash(this.player.cx, this.player.cy);
    else this.spawnSparks(this.player.cx, this.player.cy, 14, '#ff8a8a');
    this.ui.toast(cause === 'water' ? 'ÁGUAS GÉLIDAS...' : 'VOCÊ TOMBOU');
  }

  respawn() {
    const p = this.respawnPoint;
    this.player.reset(p.x, p.y);
    resetEnemies(this.level);
    this.beer = null;
    this.shield = 0;
    this.drunk = 0;
    this.regenT = 0;
    this.axes = this.maxAxes;
    this.axeCharge = 0;
    this.projectiles = [];
    this.state = 'intro';
    this.introT = 0.7;
    this.snapCamera();
    this.ui.banner('DE VOLTA', 'A LUTA CONTINUA');
  }

  killEnemy(e, stomp = false, cause = 'melee') {
    if (e.dead) return;
    e.dead = true;
    e.deathKind = cause;
    e.deathT = cause === 'roll' ? 0.7 : 0.5;
    this.sfx.play(cause === 'axe' ? 'axeHit' : 'kill');
    const color = cause === 'roll' ? '#f4d97a' : cause === 'axe' ? '#dff3ff' : '#7fe7d4';
    this.spawnSparks(e.x + e.w / 2, e.y + e.h / 2, cause === 'roll' ? 14 : 9, color);
    if (stomp) this.shake(2, 0.12);
    if (cause === 'roll') this.shake(3, 0.16);
  }

  collectMaterial(e) {
    if (e.taken) return;
    e.taken = true;
    this.materials[e.mat]++;
    this.materialsCollected++;
    this.sfx.play('pickup');
    this.spawnSparks(e.x + 5, e.y + 5, 6, MATERIALS[e.mat].color);
  }

  collectBeer(e) {
    if (e.taken) return;
    e.taken = true;
    this.applyBeer(e.beer);
    this.spawnSparks(e.x + 7, e.y + 9, 10, BEERS[e.beer].color);
  }

  applyBeer(key, silent = false) {
    const b = BEERS[key];
    if (!b) return;
    if (this.beer && this.beer.key === key) {
      this.beer.t = b.duration;
    } else {
      this.beer = { key, t: b.duration, duration: b.duration };
    }
    if (b.shield) this.shield = Math.max(this.shield, b.shield);
    if (key === 'winter') this.regenT = 0;
    this.beersDrunk++;
    this.drunk = Math.min(3, this.drunk + 1);
    this.auraT = 0;
    if (!silent) {
      this.sfx.play('drink');
      this.ui.toast(b.name, b.desc);
      this.shake(1, 0.12);
    }
    this.spawnSparks(this.player.cx, this.player.cy, 8, b.color);
  }

  tryBrew(cauldron) {
    if (cauldron.cooldown > 0) return;
    if (this.materialsTotal < 3) {
      this.sfx.play('ui');
      this.ui.toast('FALTAM MATERIAIS', 'Junte 3 ingredientes para ferver');
      cauldron.cooldown = 0.6;
      return;
    }
    this.consumeMaterials(3);
    cauldron.cooldown = 1.6;
    this.brews++;
    if (this.player.hp < this.player.maxHp) this.player.hp++;
    const key = BEER_KEYS[Math.floor(Math.random() * BEER_KEYS.length)];
    this.applyBeer(key, true);
    this.sfx.play('brew');
    this.ui.toast('CERVEJA FERMENTADA!', `${BEERS[key].name} · ${BEERS[key].short}`);
    this.spawnSparks(cauldron.x + cauldron.w / 2, cauldron.y + 2, 20, '#f4c542');
    this.shake(2, 0.2);
  }

  consumeMaterials(n) {
    let left = n;
    for (const key of MATERIAL_ORDER) {
      while (left > 0 && this.materials[key] > 0) {
        this.materials[key]--;
        left--;
      }
    }
  }

  activateCheckpoint(e) {
    if (e.active) return;
    e.active = true;
    this.respawnPoint = { x: e.x + 1, y: e.y + e.h - 30 };
    this.sfx.play('checkpoint');
    this.ui.toast('CHECKPOINT', 'Progresso salvo');
    this.spawnSparks(e.x + 4, e.y + 6, 12, '#f4d97a');
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.completeT = 1.1;
    this.completeShown = false;
    this.player.vx = 0;
    this.player.attackT = -1;
    this.sfx.play('win');
    this.totalMaterialsCollected += this.materialsCollected;
    this.totalBeers += this.beersDrunk;
    this.totalBrews += this.brews;
    this.totalTime += this.elapsed;
    const goal = this.level.goal;
    if (goal) this.spawnSparks(goal.x + 32, goal.y + 40, 30, '#f4c542');
    this.saveBest();
  }

  shake(mag, dur) {
    this.shakeMag = mag;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  flash(amount) {
    this.flashT = Math.max(this.flashT, amount);
  }

  spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y - 1,
        vx: (Math.random() - 0.5) * 34,
        vy: -Math.random() * 26,
        gravity: 80,
        life: 0.3,
        maxLife: 0.3,
        size: 1,
        color: '#cfd9e6',
      });
    }
    this.trimParticles();
  }

  spawnSparks(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 110,
        vy: -Math.random() * 80 - 10,
        gravity: 220,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        size: Math.random() > 0.6 ? 2 : 1,
        color,
      });
    }
    this.trimParticles();
  }

  spawnSplash(x, y) {
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: -Math.random() * 130 - 20,
        gravity: 340,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        size: Math.random() > 0.5 ? 2 : 1,
        color: Math.random() > 0.5 ? '#8fd0e6' : '#dff3ff',
      });
    }
    this.trimParticles();
  }

  trimParticles() {
    if (this.particles.length > 340) {
      this.particles.splice(0, this.particles.length - 340);
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}
