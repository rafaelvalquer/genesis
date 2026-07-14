// carrega pastas por estado: alienBege/walking/frame0.png etc.

// src/miniGame/assets/enemy/loadEnemyFrames

export const loadEnemyFrames = (tipo, estados = [], animacoes = {}) => {
  const result = {};

  estados.forEach((estado) => {
    const frameCount = animacoes?.[estado]?.frameCount || 1;
    const frames = [];

    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = new URL(
        `./${tipo}/${estado}/frame${i}.png`,
        import.meta.url
      ).href;
      frames.push(img);
    }

    result[estado] = frames;
  });

  return result;
};
