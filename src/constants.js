export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;

export const GRAVITY = 1350;
export const MAX_FALL = 560;

export const T = Object.freeze({
  EMPTY: 0,
  ROCK: 1,
  SNOW: 2,
  WOOD: 3,
  ICE: 4,
  SPIKE: 5,
  WATER: 6,
});

export function isSolid(t) {
  return t === T.ROCK || t === T.SNOW || t === T.WOOD || t === T.ICE;
}

export function isHazard(t) {
  return t === T.SPIKE || t === T.WATER;
}

export const THEMES = {
  dusk: {
    sky: ['#1a2340', '#263355', '#3b4a6d', '#5d6485', '#8b7386', '#c2947d', '#e4b183'],
    sun: { x: 366, y: 158, r: 30, color: '#f6d49a', glow: '#f0b878' },
    mountains: ['#2b3552', '#3b4a68', '#536180', '#6b7894'],
    snowLine: 150,
    pines: ['#1c2a32', '#24363d'],
    fog: '#b8c0d0',
    snowRate: 0.9,
    aurora: false,
    stars: 0.25,
    vignette: 'rgba(9, 13, 24, 0.5)',
  },
  night: {
    sky: ['#04060d', '#080e1b', '#0e1729', '#142138', '#1b2c49'],
    sun: { x: 384, y: 52, r: 24, color: '#e6eef8', glow: '#9db4d8' },
    mountains: ['#111a2c', '#1a2740', '#263a58', '#344d70'],
    snowLine: 128,
    pines: ['#091017', '#0e1820'],
    fog: '#7f93b8',
    snowRate: 1.5,
    aurora: true,
    stars: 1,
    vignette: 'rgba(2, 5, 11, 0.58)',
  },
};

export const PALETTE = {
  outline: '#15131d',
  skinHi: '#f0c9a0',
  skin: '#e2b184',
  skinMid: '#c98f64',
  skinDark: '#9c6345',
  beardHi: '#d99a55',
  beard: '#b8743a',
  beardMid: '#8e5527',
  beardDark: '#5f3418',
  helmHi: '#eef4fb',
  helm: '#c3cedb',
  helmMid: '#8b97a8',
  helmDark: '#5b6576',
  mail: '#6c7788',
  mailDark: '#495363',
  tunicHi: '#5a7f64',
  tunic: '#3f5d4a',
  tunicDark: '#2a3f33',
  trousers: '#3b4354',
  trousersDark: '#272d3a',
  furHi: '#f0ead9',
  fur: '#ded6c2',
  furDark: '#a89f8a',
  leatherHi: '#a06a3e',
  leather: '#7a4a2a',
  leatherDark: '#4a2a16',
  goldHi: '#f7e29a',
  gold: '#e8c25a',
  goldDark: '#a37c26',
  steelHi: '#f2f7fd',
  steel: '#c3cedb',
  steelDark: '#7c8798',
  steelDeep: '#4c5566',
  cloakHi: '#b04545',
  cloak: '#8a3030',
  cloakDark: '#5a1e1e',
  woodHi: '#a3703f',
  wood: '#7a4b2a',
  woodDark: '#4e2f1a',
  rune: '#7fe7d4',
  runeDark: '#2a8f80',
  ember: '#ffb347',
};
