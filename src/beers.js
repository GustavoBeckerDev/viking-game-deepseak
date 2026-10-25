export const MATERIAL_ORDER = ['honey', 'barley', 'hops', 'water'];

export const MATERIALS = {
  honey: { name: 'MEL', color: '#f2b93c', dark: '#a8741c' },
  barley: { name: 'CEVADA', color: '#d8b06a', dark: '#8a6a35' },
  hops: { name: 'LÚPULO', color: '#8fd67f', dark: '#4f8a4a' },
  water: { name: 'ÁGUA', color: '#7fc4e8', dark: '#3f7f9f' },
};

export const BEERS = {
  fury: {
    name: 'HIDROMEL DOURADO',
    short: 'FÚRIA',
    desc: '+35% velocidade · +salto',
    duration: 12,
    color: '#f4c542',
    dark: '#a87a1a',
    tint: '#f4c542',
    icon: 'flame',
    speed: 1.35,
    jump: 1.09,
  },
  stout: {
    name: 'CERVEJA ESCURA',
    short: 'RESISTÊNCIA',
    desc: 'escudo de espuma · -10% velocidade',
    duration: 16,
    color: '#b98a5a',
    dark: '#6b4a2c',
    tint: '#9a7b5a',
    icon: 'shield',
    speed: 0.9,
    shield: 2,
  },
  ipa: {
    name: 'IPA DE LÚPULO',
    short: 'LENTIDÃO',
    desc: 'inimigos em câmera lenta',
    duration: 11,
    color: '#8fd67f',
    dark: '#3f7a3c',
    tint: '#6fcf7f',
    icon: 'hop',
    enemyScale: 0.55,
  },
  winter: {
    name: 'CERVEJA DE INVERNO',
    short: 'REGENERAÇÃO',
    desc: 'recupera 1 vida a cada 4s',
    duration: 14,
    color: '#9fd8ff',
    dark: '#4f8fb8',
    tint: '#9fd8ff',
    icon: 'snow',
    regen: 4,
  },
};

export const BEER_KEYS = Object.keys(BEERS);
