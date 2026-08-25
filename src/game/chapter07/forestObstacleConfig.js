import { CELL, FIELD } from "../visualGeometry.js";

export const FOREST_OBSTACLE_TYPES = Object.freeze({
  fragile: Object.freeze({ id: "fragile", label: "Tronco Jovem", hp: 80, spore: false }),
  ferrivore: Object.freeze({ id: "ferrivore", label: "Árvore Ferrívora", hp: 130, spore: false }),
  mineralized: Object.freeze({ id: "mineralized", label: "Árvore Mineralizada", hp: 220, spore: false }),
  spores: Object.freeze({ id: "spores", label: "Árvore de Esporos", hp: 110, spore: true }),
});

const progression = [
  null,
  { minCount: 2, maxCount: 3, minCol: 7, maxCol: 8, types: { fragile: .3, ferrivore: .7 }, maxSporeTrees: 0 },
  { minCount: 3, maxCount: 4, minCol: 6, maxCol: 8, types: { fragile: .3, ferrivore: .7 }, maxSporeTrees: 0 },
  { minCount: 4, maxCount: 4, minCol: 5, maxCol: 8, types: { fragile: .25, ferrivore: .55, mineralized: .2 }, maxSporeTrees: 0 },
  { minCount: 4, maxCount: 5, minCol: 4, maxCol: 8, types: { fragile: .2, ferrivore: .55, mineralized: .15, spores: .1 }, maxSporeTrees: 1 },
  { minCount: 5, maxCount: 5, minCol: 4, maxCol: 8, types: { fragile: .15, ferrivore: .5, mineralized: .2, spores: .15 }, maxSporeTrees: 1 },
  { minCount: 5, maxCount: 7, minCol: 3, maxCol: 8, types: { fragile: .15, ferrivore: .45, mineralized: .25, spores: .15 }, maxSporeTrees: 2 },
  { minCount: 6, maxCount: 8, minCol: 3, maxCol: 8, types: { fragile: .1, ferrivore: .4, mineralized: .3, spores: .2 }, maxSporeTrees: 2 },
];

export function getForestObstacleConfig(phase) {
  const phaseNumber = Number(String(phase?.id || "").match(/(\d+)$/)?.[1]);
  const config = progression[phaseNumber - 49];
  if (!config && !phase?.forestObstacles?.enabled) return Object.freeze({ enabled: false, rows: [0, 1, 3, 4] });
  return Object.freeze({ enabled: true, rows: [0, 1, 3, 4], maxPerRow: 2, avoidAdjacent: phaseNumber < 54, ...(config || {}), ...(phase?.forestObstacles || {}) });
}

export function forestObstaclePosition(row, col) {
  return { x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 };
}

export function isForestObstacleCell(row, col) {
  return [0, 1, 3, 4].includes(row) && col >= 0 && col < FIELD.cols;
}

export function getForestObstacleType(type) {
  return FOREST_OBSTACLE_TYPES[type] || FOREST_OBSTACLE_TYPES.ferrivore;
}
