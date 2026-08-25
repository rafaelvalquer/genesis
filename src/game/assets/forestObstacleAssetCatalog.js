import { getForestObstacleConfig } from "../chapter07/forestObstacleConfig.js";

const treeModules = typeof import.meta.glob === "function"
  ? import.meta.glob("./chapter07/trees/**/*.png", { query: "?url", import: "default", eager: true })
  : {};
const staticTreeAssets = {
  fragile: { hp100: new URL("./chapter07/trees/fragile/hp100.png", import.meta.url).href, hp75: new URL("./chapter07/trees/fragile/hp75.png", import.meta.url).href, hp50: new URL("./chapter07/trees/fragile/hp50.png", import.meta.url).href, hp25: new URL("./chapter07/trees/fragile/hp25.png", import.meta.url).href, hp0: new URL("./chapter07/trees/fragile/hp0.png", import.meta.url).href },
  ferrivore: { hp100: new URL("./chapter07/trees/ferrivore/hp100.png", import.meta.url).href, hp75: new URL("./chapter07/trees/ferrivore/hp75.png", import.meta.url).href, hp50: new URL("./chapter07/trees/ferrivore/hp50.png", import.meta.url).href, hp25: new URL("./chapter07/trees/ferrivore/hp25.png", import.meta.url).href, hp0: new URL("./chapter07/trees/ferrivore/hp0.png", import.meta.url).href },
  mineralized: { hp100: new URL("./chapter07/trees/mineralized/hp100.png", import.meta.url).href, hp75: new URL("./chapter07/trees/mineralized/hp75.png", import.meta.url).href, hp50: new URL("./chapter07/trees/mineralized/hp50.png", import.meta.url).href, hp25: new URL("./chapter07/trees/mineralized/hp25.png", import.meta.url).href, hp0: new URL("./chapter07/trees/mineralized/hp0.png", import.meta.url).href },
  spores: { hp100: new URL("./chapter07/trees/spores/hp100.png", import.meta.url).href, hp75: new URL("./chapter07/trees/spores/hp75.png", import.meta.url).href, hp50: new URL("./chapter07/trees/spores/hp50.png", import.meta.url).href, hp25: new URL("./chapter07/trees/spores/hp25.png", import.meta.url).href, hp0: new URL("./chapter07/trees/spores/hp0.png", import.meta.url).href },
};

export const FOREST_OBSTACLE_STAGES = Object.freeze(["hp100", "hp75", "hp50", "hp25", "hp0"]);

export function getForestObstacleAssetUrl(type, stage) {
  const key = `./chapter07/trees/${type}/${stage}.png`;
  let entry = treeModules[key];
  if (!entry) {
    const suffix = `/trees/${type}/${stage}.png`;
    entry = Object.entries(treeModules).find(([candidate]) => candidate.endsWith(suffix))?.[1];
  }
  while (entry && typeof entry === "object" && entry.default) entry = entry.default;
  return typeof entry === "string" ? entry : entry?.href || entry?.src || staticTreeAssets[type]?.[stage] || null;
}

export function resolveForestObstacleAssetDependencies(phase) {
  return phase?.chapterId === "chapter_07" && getForestObstacleConfig(phase).enabled
    ? Object.freeze(["fragile", "ferrivore", "mineralized", "spores"].flatMap((type) => FOREST_OBSTACLE_STAGES.map((stage) => ({ type, stage, url: getForestObstacleAssetUrl(type, stage) }))))
    : Object.freeze([]);
}
