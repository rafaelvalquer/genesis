import { ENEMIES, TROOPS } from "./content.js";

const troopFrameModules = import.meta.glob([
  "./assets/troop/**/*.png",
  "!./assets/troop/muralhaReforcada/idle/**/*.png",
], { query: "?url", import: "default" });
const enemyFrameModules = import.meta.glob("./assets/enemy/**/*.png", { query: "?url", import: "default" });
const arenaUrls = import.meta.glob("./assets/arenas/*.webp", { eager: true, query: "?url", import: "default" });
const audioUrls = import.meta.glob("./assets/sfx/*.{ogg,wav}", { eager: true, query: "?url", import: "default" });
const previewUrls = import.meta.glob([
  "./assets/troop/*/idle/frame0.png",
  "!./assets/troop/muralhaReforcada/idle/frame0.png",
  "./assets/troop/*/defense/frame0.png",
], { eager: true, query: "?url", import: "default" });
const enemyPreviewUrls = import.meta.glob("./assets/enemy/*/idle/frame0.png", { eager: true, query: "?url", import: "default" });
const enemyConceptUrls = import.meta.glob("./assets/enemy/concepts/*.webp", { eager: true, query: "?url", import: "default" });

const frameNumber = (key) => Number(/frame(\d+)\.png$/i.exec(key)?.[1] || 0);

function modulesFor(modules, folder, state) {
  return Object.entries(modules)
    .filter(([key]) => key.includes(`/${folder}/${state}/`))
    .sort(([left], [right]) => frameNumber(left) - frameNumber(right));
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadFrameSet(modules, folder, state) {
  const entries = modulesFor(modules, folder, state);
  const urls = await Promise.all(entries.map(([, load]) => load()));
  return (await Promise.all(urls.map(loadImage))).filter(Boolean);
}

export function getTroopPreviewUrl(troopId) {
  const spriteKey = TROOPS[troopId]?.spriteKey || troopId;
  const preferred = spriteKey === "muralhaReforcada" ? "defense" : "idle";
  const match = Object.entries(previewUrls).find(([key]) => key.includes(`/${spriteKey}/${preferred}/frame0.png`));
  return match?.[1] || "";
}

export function getArenaUrl(arenaId) {
  const match = Object.entries(arenaUrls).find(([key]) => key.endsWith(`/${arenaId}.webp`));
  return match?.[1] || "";
}

export function getEnemyPreviewUrl(enemyId) {
  const match = Object.entries(enemyPreviewUrls).find(([key]) => key.includes(`/enemy/${enemyId}/idle/frame0.png`));
  return match?.[1] || getEnemyConceptUrl(enemyId);
}

export function getEnemyConceptUrl(enemyId) {
  const match = Object.entries(enemyConceptUrls).find(([key]) => key.endsWith(`/concepts/${enemyId}.webp`));
  return match?.[1] || "";
}

export async function loadBattleAssets(phase, loadout, onProgress = () => {}, options = {}) {
  const troopIds = [...new Set(loadout)];
  const enemyIds = [...new Set(options.enemyIds || phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type)))];
  const tasks = [];
  const result = { troops: {}, enemies: {}, audio: {} };

  for (const troopId of troopIds) {
    const troop = TROOPS[troopId];
    const states = troop.assetStates || (troopId === "muralhaReforcada" ? ["defense"] : ["idle", "attack"]);
    result.troops[troopId] = {};
    for (const state of states) {
      tasks.push(async () => {
        result.troops[troopId][state] = await loadFrameSet(troopFrameModules, troop.spriteKey, state);
      });
    }
  }

  for (const enemyId of enemyIds) {
    const enemy = ENEMIES[enemyId];
    if (!enemy) continue;
    result.enemies[enemyId] = {};
    for (const state of enemy.assetStates || ["walking", "attack", "idle"]) {
      tasks.push(async () => {
        result.enemies[enemyId][state] = await loadFrameSet(enemyFrameModules, enemyId, state);
      });
    }
  }

  let done = 0;
  for (const task of tasks) {
    await task();
    done += 1;
    onProgress({ done, total: tasks.length, percent: Math.round((done / tasks.length) * 100) });
  }

  for (const [key, url] of Object.entries(audioUrls)) {
    result.audio[key.split("/").at(-1)] = url;
  }
  return result;
}
