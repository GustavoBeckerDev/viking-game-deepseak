import { Input, bindTouchControls } from './input.js';
import { Sfx } from './audio.js';
import { loadAssets } from './assets.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const bannerEl = document.getElementById('banner');
const bannerTitle = document.getElementById('banner-title');
const bannerSub = document.getElementById('banner-sub');
const toastEl = document.getElementById('toast');
const toastTitle = document.getElementById('toast-title');
const toastSub = document.getElementById('toast-sub');

const screens = {
  title: document.getElementById('screen-title'),
  controls: document.getElementById('screen-controls'),
  pause: document.getElementById('screen-pause'),
  level: document.getElementById('screen-level'),
  victory: document.getElementById('screen-victory'),
};

const input = new Input(window);
bindTouchControls(input, document);
const sfx = new Sfx();

let soundOn = true;
let currentScreen = 'title';
let prevScreen = 'title';
let game;
let bannerTimer = 0;
let toastTimer = 0;

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function setSound(on) {
  soundOn = on;
  sfx.setEnabled(on);
  document.querySelectorAll('[data-act="sound"]').forEach((btn) => {
    btn.textContent = on ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
  });
}

function toggleSound() {
  sfx.ensure();
  setSound(!soundOn);
  if (soundOn) sfx.play('ui');
}

function updateBestLine() {
  const el = document.getElementById('best-line');
  if (!el) return;
  if (game && game.best) {
    el.textContent = `MELHOR RODADA: ${game.best.materials} MATERIAIS · ${fmtTime(game.best.time)}`;
  } else {
    el.textContent = 'SUA PRIMEIRA RODADA COMEÇA AGORA';
  }
}

const ui = {
  show(name) {
    currentScreen = name;
    overlay.classList.remove('hidden');
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  },
  hide() {
    overlay.classList.add('hidden');
  },
  showTitle() {
    this.show('title');
    updateBestLine();
  },
  showPause() {
    this.show('pause');
  },
  showLevelComplete(stats) {
    document.getElementById('lc-name').textContent = `FASE ${stats.level} · ${stats.name}`;
    document.getElementById('lc-mat').textContent = `${stats.materials}/${stats.total}`;
    document.getElementById('lc-beers').textContent = String(stats.beers);
    document.getElementById('lc-brews').textContent = String(stats.brews);
    document.getElementById('lc-time').textContent = fmtTime(stats.time);
    const next = document.getElementById('btn-next');
    next.textContent = stats.last ? 'VER RESULTADO' : 'PRÓXIMA FASE';
    this.show('level');
  },
  showVictory(stats) {
    const run = stats.run;
    document.getElementById('vc-mat').textContent = String(run.materials);
    document.getElementById('vc-beers').textContent = String(run.beers);
    document.getElementById('vc-brews').textContent = String(run.brews);
    document.getElementById('vc-time').textContent = fmtTime(run.time);
    document.getElementById('vc-deaths').textContent = String(run.deaths);
    const best = document.getElementById('vc-best');
    if (game.best) {
      best.textContent = `MELHOR RODADA: ${game.best.materials} MATERIAIS · ${fmtTime(game.best.time)}`;
    } else {
      best.textContent = '';
    }
    this.show('victory');
  },
  banner(title, sub) {
    bannerTitle.textContent = title;
    bannerSub.textContent = sub;
    bannerEl.classList.add('show');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => bannerEl.classList.remove('show'), 2200);
  },
  toast(title, sub = '') {
    toastTitle.textContent = title;
    toastSub.textContent = sub;
    toastSub.style.display = sub ? '' : 'none';
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1700);
  },
};

await loadAssets();
game = new Game({ canvas, input, sfx, ui });
window.__VK = game;

document.querySelectorAll('[data-act]').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.ensure();
    btn.blur();
    const act = btn.dataset.act;
    if (act === 'sound') {
      toggleSound();
      return;
    }
    sfx.play('ui');
    switch (act) {
      case 'play':
        if (game.state === 'title' || game.state === 'victory') game.startNewGame();
        break;
      case 'resume':
        game.resume();
        break;
      case 'retry':
        game.restartLevel();
        break;
      case 'next':
        game.nextLevel();
        break;
      case 'menu':
        game.toTitle();
        break;
      case 'controls':
        prevScreen = currentScreen;
        ui.show('controls');
        break;
      case 'back':
        ui.show(prevScreen || 'title');
        if (prevScreen === 'title') updateBestLine();
        break;
      default:
        break;
    }
  });
});

function handleGlobalKeys() {
  if (input.wasPressed('mute')) toggleSound();

  if (input.wasPressed('pause')) {
    if (currentScreen === 'controls') {
      ui.show(prevScreen || 'title');
      if (prevScreen === 'title') updateBestLine();
    } else if (game.state === 'paused') {
      game.resume();
    } else if (game.state === 'playing' || game.state === 'intro') {
      game.pause();
    }
  }

  const focusOnButton = document.activeElement instanceof HTMLElement
    && document.activeElement.closest('button');

  if (game.state === 'title' && !focusOnButton
    && (input.wasPressed('jump') || input.wasPressed('attack'))) {
    sfx.ensure();
    sfx.play('ui');
    game.startNewGame();
  }

  if (input.wasPressed('restart') && (game.state === 'playing' || game.state === 'paused')) {
    game.restartLevel();
  }
}

function resize() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  const padX = 0;
  const padY = 0;
  let scale = Math.min(6, Math.min((vw - padX) / 480, (vh - padY) / 270));
  scale = scale >= 1 ? Math.floor(scale + 0.005) : Math.max(0.55, scale);
  const w = Math.round(480 * scale);
  const h = Math.round(270 * scale);
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  stage.style.setProperty('--u', `${w / 480}px`);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
setSound(true);
ui.showTitle();

const params = new URLSearchParams(window.location.search);
if (params.has('play')) {
  game.startNewGame();
  if (params.get('level') === '2') game.startLevel(1);
  if (params.has('skip')) game.introT = 0.05;
}

window.addEventListener('pointerdown', () => sfx.ensure(), { once: true });
window.addEventListener('keydown', () => sfx.ensure(), { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'playing' || game.state === 'intro')) game.pause();
});

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  handleGlobalKeys();
  game.update(dt);
  game.render();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
