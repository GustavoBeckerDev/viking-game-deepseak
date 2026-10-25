import { GRAVITY, MAX_FALL, TILE, T } from './constants.js';
import { moveX, moveY, hazardInBox, tileBelow, rectsOverlap, waterInBox, waterSurface, waterBottom, waterSpanAt } from './physics.js';
import { drawViking } from './sprites.js';

const GRAVITY_RISE = 1720;
const GRAVITY_FALL = 2320;
const JUMP_V = 438;
const DOUBLE_V = 382;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.14;
const RUN_MAX = 168;
const ROLL_DUR = 0.42;
const ROLL_CD = 0.55;
const ROLL_SPEED = 262;
const FLIP_DUR = 0.55;

export class Player {
  constructor(x, y) {
    this.w = 12;
    this.h = 30;
    this.maxHp = 3;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.hitCeiling = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invuln = 1.4;
    this.hurtT = 0;
    this.attackT = -1;
    this.attackHits = new Set();
    this.dead = false;
    this.deathT = 0;
    this.deathCause = null;
    this.run = 0;
    this.idle = 0;
    this.hp = this.maxHp;
    this.prevBottom = y + this.h;

    this.jumpsUsed = 0;
    this.flipT = 0;
    this.flipDur = FLIP_DUR;
    this.rollT = 0;
    this.rollCd = 0;
    this.rollDir = 1;
    this.throwT = 0;
    this.squash = 0;
    this.inWater = false;
    this.waterLeap = 0;
    this.swim = 0;
    this.wasGrounded = false;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  get rolling() {
    return this.rollT > 0;
  }

  attackBox() {
    if (this.facing > 0) {
      return { x: this.x + this.w - 4, y: this.y - 4, w: 27, h: 30 };
    }
    return { x: this.x - 23, y: this.y - 4, w: 27, h: 30 };
  }

  update(dt, game) {
    const input = game.input;
    const level = game.level;
    const active = game.state === 'playing';

    this.idle += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.flipT = Math.max(0, this.flipT - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.squash = Math.max(0, this.squash - dt * 4.2);
    this.waterLeap = Math.max(0, this.waterLeap - dt);

    if (this.dead) {
      this.deathT -= dt;
      this.vy = Math.min(this.vy + GRAVITY * 0.55 * dt, MAX_FALL);
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      this.vx *= 0.985;
      return;
    }

    this.prevBottom = this.y + this.h;

    if (this.attackT >= 0) {
      this.attackT += dt / 0.34;
      if (this.attackT > 1) this.attackT = -1;
    }

    if (active && this.rollT <= 0 && this.rollCd <= 0 && input.wasPressed('roll') && !this.inWater) {
      this.rollT = ROLL_DUR;
      this.rollDir = (input.down('left') && !input.down('right'))
        ? -1
        : (input.down('right') ? 1 : this.facing);
      this.facing = this.rollDir;
      this.rollCd = ROLL_CD + ROLL_DUR;
      this.invuln = Math.max(this.invuln, ROLL_DUR + 0.12);
      this.attackT = -1;
      this.jumpBuffer = 0;
      this.squash = 0.1;
      game.sfx.play('roll');
      game.spawnDust(this.cx, this.y + this.h, 7);
    }

    const rolling = this.rollT > 0;
    if (rolling) {
      this.rollT -= dt;
      this.invuln = Math.max(this.invuln, 0.08);
      this.vx = this.rollDir * ROLL_SPEED;
    } else {
      const left = active && input.down('left');
      const right = active && input.down('right');
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      const onIce = this.grounded && tileBelow(level, this.cx, this.y + this.h + 2) === T.ICE;
      const speedMul = game.speedMultiplier();
      const maxSpeed = (this.inWater ? 96 : RUN_MAX) * speedMul;
      const accel = (this.inWater ? 700 : onIce ? 500 : this.grounded ? 1520 : 980) * Math.min(1.3, speedMul);

      if (dir !== 0) {
        this.vx += dir * accel * dt;
        if (Math.abs(this.vx) > maxSpeed) this.vx = Math.sign(this.vx) * maxSpeed;
        this.facing = dir;
      } else {
        const friction = this.inWater ? 760 : onIce ? 250 : this.grounded ? 1900 : 520;
        const sign = Math.sign(this.vx);
        this.vx -= sign * friction * dt;
        if (Math.sign(this.vx) !== sign) this.vx = 0;
      }
    }

    const probe = { x: this.x + 2, y: this.y + this.h * 0.6, w: this.w - 4, h: this.h * 0.4 };
    const inWaterNow = waterInBox(level, probe);
    if (inWaterNow && !this.inWater && this.waterLeap <= 0) {
      game.spawnSplash(this.cx, this.y + this.h * 0.72);
      game.sfx.play('splash');
      this.vy *= 0.35;
      this.squash = 0.16;
    }
    this.inWater = inWaterNow;
    if (this.inWater) {
      this.swim += dt;
      this.jumpsUsed = 0;
    }

    if (active && input.wasPressed('jump')) this.jumpBuffer = JUMP_BUFFER;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.grounded || this.inWater) {
      this.coyote = COYOTE;
      this.jumpsUsed = 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.jumpsUsed === 0) this.jumpsUsed = 1;
    }

    if (this.jumpBuffer > 0 && !rolling) {
      const groundJump = this.grounded || this.coyote > 0 || this.inWater;
      const jm = game.jumpMultiplier();
      if (groundJump) {
        this.vy = -JUMP_V * jm * (this.inWater ? 0.9 : 1);
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpsUsed = 1;
        this.flipT = 0;
        this.squash = 0.13;
        if (this.inWater) {
          this.waterLeap = 0.34;
          this.inWater = false;
          game.spawnSplash(this.cx, this.y + this.h * 0.72);
          game.sfx.play('splash');
        } else {
          game.sfx.play('jump');
          game.spawnDust(this.cx, this.y + this.h, 5);
        }
      } else if (this.jumpsUsed < 2) {
        this.vy = -DOUBLE_V * jm;
        this.jumpsUsed = 2;
        this.jumpBuffer = 0;
        this.flipT = FLIP_DUR;
        this.squash = 0.14;
        game.sfx.play('jump');
        game.spawnSparks(this.cx, this.cy + 6, 10, '#dff3ff');
      }
    }

    if (!rolling && (!active || !input.down('jump')) && this.vy < -140) this.vy = -140;

    if (this.inWater && this.waterLeap <= 0) {
      const surfaceY = waterSurface(level, this.cx, this.y + this.h - 1);
      const targetFeet = surfaceY + 20;
      const err = (this.y + this.h) - targetFeet;
      this.vy -= err * 20 * dt;
      this.vy *= Math.pow(0.86, dt * 60);
      if (active && input.down('jump')) this.vy -= 620 * dt;
      this.vy = Math.max(-172, Math.min(140, this.vy));
      const maxFeet = surfaceY + 26;
      if (this.y + this.h > maxFeet) {
        this.y = maxFeet - this.h;
        if (this.vy > 0) this.vy = 0;
      }
      const floorFeet = waterBottom(level, this.cx, this.y + this.h - 1) - 2;
      if (this.y + this.h > floorFeet) {
        this.y = floorFeet - this.h;
        if (this.vy > 0) this.vy = 0;
      }
      if (active && input.down('jump') && this.y + this.h <= surfaceY + 4) {
        this.vy = -360;
        this.waterLeap = 0.32;
        this.inWater = false;
        game.spawnSplash(this.cx, surfaceY);
        game.sfx.play('splash');
      }
    } else {
      let g = this.vy < 0 ? GRAVITY_RISE : GRAVITY_FALL;
      if (Math.abs(this.vy) < 80) g *= 0.7;
      this.vy = Math.min(this.vy + g * dt, MAX_FALL);
    }

    this.wasGrounded = this.grounded;
    const fallSpeed = this.vy;
    moveX(level, this, this.vx * dt);
    moveY(level, this, this.vy * dt);

    const span = waterSpanAt(level, this.cx, this.y + this.h);
    if (span && this.y + this.h > span.bottom - 2 && this.y < span.bottom + 32) {
      this.y = span.bottom - 2 - this.h;
      if (this.vy > 0) this.vy = 0;
      this.inWater = true;
      this.waterLeap = 0;
    }

    if (this.hitCeiling) this.vy = 0;
    if (this.grounded) {
      if (!this.wasGrounded && fallSpeed > 200) {
        game.sfx.play('land');
        game.spawnDust(this.cx, this.y + this.h, 4 + Math.min(6, Math.round(fallSpeed / 90)));
        this.squash = Math.min(0.26, fallSpeed / 2300);
      }
      this.vy = 0;
      this.jumpsUsed = 0;
      this.flipT = 0;
    }

    if (Math.abs(this.vx) > 8) this.run += Math.abs(this.vx) * dt * 0.115;
    else this.run = 0;

    if (rolling) {
      for (const e of level.entities) {
        if ((e.type === 'draugr' || e.type === 'raven') && !e.dead && rectsOverlap(this, e)) {
          game.killEnemy(e, false, 'roll');
        }
      }
      if (Math.random() < 0.5) game.spawnDust(this.cx - this.rollDir * 9, this.y + this.h, 1);
    }

    if (active && !rolling && !this.inWater && input.wasPressed('attack') && this.attackT < 0) {
      this.attackT = 0;
      this.attackHits = new Set();
      game.sfx.play('attack');
    }

    if (active && !rolling && input.wasPressed('throw')) {
      if (game.throwAxe(this)) this.throwT = 0.26;
    }

    if (this.attackT >= 0.3 && this.attackT <= 0.66) {
      const hb = this.attackBox();
      for (const e of level.entities) {
        if ((e.type === 'draugr' || e.type === 'raven') && !e.dead && !this.attackHits.has(e.id)) {
          if (rectsOverlap(hb, e)) {
            this.attackHits.add(e.id);
            game.killEnemy(e, false, 'melee');
          }
        }
      }
    }

    for (const e of level.entities) {
      if ((e.type === 'draugr' || e.type === 'raven') && !e.dead) {
        if (rectsOverlap(this, e)) {
          const stomp = this.vy > 40 && this.prevBottom <= e.y + 12;
          if (stomp) {
            game.killEnemy(e, true, 'stomp');
            this.vy = -320;
            this.grounded = false;
            this.jumpsUsed = 1;
            this.squash = 0.12;
          }
        }
      }
    }

    if (!this.dead) {
      const hazard = hazardInBox(level, this);
      if (hazard === T.SPIKE) this.damage(1, this.cx, game);
    }

    if (this.y > level.h * TILE + 40 && !this.dead) game.killPlayer('fall');
  }

  damage(amount, sourceX, game) {
    if (this.invuln > 0 || this.dead || this.rolling) return;
    if (game.shield > 0) {
      game.shield--;
      this.invuln = 0.9;
      this.vx = (this.cx < sourceX ? -1 : 1) * 130;
      this.vy = -190;
      this.grounded = false;
      game.sfx.play('shield');
      game.spawnSparks(this.cx, this.cy, 12, '#dff3ff');
      game.ui.toast(game.shield > 0 ? 'ESCUDO DE ESPUMA' : 'ESCUDO QUEBRADO');
      return;
    }
    this.hp -= amount;
    this.invuln = 1.3;
    this.hurtT = 0.35;
    this.vx = (this.cx < sourceX ? -1 : 1) * 120;
    this.vy = -190;
    this.grounded = false;
    this.attackT = -1;
    game.sfx.play('hit');
    game.shake(2, 0.12);
    game.flash(0.22);
    game.spawnSparks(this.cx, this.cy, 8, '#ff8a8a');
    if (this.hp <= 0) game.killPlayer('hit');
  }

  draw(ctx) {
    ctx.save();
    if (this.dead) {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.deathT / 1.2));
    }

    if (!this.inWater && !this.dead) {
      drawShadow(ctx, this.cx, this.y + this.h, this.w, 0.3);
    }

    if (this.flipT > 0) {
      const prog = 1 - this.flipT / this.flipDur;
      ctx.translate(this.cx, this.cy);
      ctx.rotate(prog * Math.PI * 2 * this.facing);
      ctx.translate(-this.cx, -this.cy);
    }

    drawViking(ctx, this.cx, this.y + this.h, {
      facing: this.facing,
      run: this.run,
      idle: this.idle,
      vx: this.vx,
      vy: this.vy,
      grounded: this.grounded,
      attackT: this.attackT,
      invuln: this.invuln,
      hurtT: this.hurtT,
      dead: this.dead,
      rollT: this.rollT,
      rollDur: ROLL_DUR,
      rollDir: this.rollDir,
      throwT: this.throwT,
      squash: this.squash,
      inWater: this.inWater,
      swim: this.swim,
    });

    if (this.inWater && !this.dead) {
      const surfaceY = this.y + this.h - 7;
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) {
        const w = 10 + i * 6 + Math.sin(this.swim * 5 + i) * 2;
        ctx.fillStyle = i === 0 ? '#8fd0e6' : '#4f8fb8';
        ctx.fillRect(Math.round(this.cx - w / 2), Math.round(surfaceY + i * 2), Math.round(w), 1);
      }
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 2; i++) {
        const bx = this.cx + Math.sin(this.swim * 3 + i * 2.1) * 9;
        const by = this.y + this.h - 2 - ((this.swim * 18 + i * 7) % 10);
        ctx.fillStyle = '#dff3ff';
        ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawShadow(ctx, cx, groundY, w, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#05070c';
  const y = Math.round(groundY) - 1;
  ctx.fillRect(Math.round(cx - w * 0.75), y, Math.round(w * 1.5), 1);
  ctx.fillRect(Math.round(cx - w * 0.55), y + 1, Math.round(w * 1.1), 1);
  ctx.restore();
}
