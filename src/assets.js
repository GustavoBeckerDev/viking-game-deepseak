const images = {};

const SOURCES = {
  hero: 'assets/hero.png',
  enemy: 'assets/enemy.png',
};

export function loadAssets() {
  return Promise.all(Object.entries(SOURCES).map(([key, src]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve();
    };
    img.onerror = () => {
      console.warn(`[assets] falha ao carregar ${src}; usando desenho procedural`);
      resolve();
    };
    img.src = src;
  })));
}

export function getImage(key) {
  return images[key] || null;
}
