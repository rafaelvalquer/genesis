import { ENEMIES, TROOPS } from "../game/content.js";
import { frameNumber, modulesFor, createAssetAbortError } from "../game/assets/assetModuleUtils.js";
import { loadDecodedImage, releaseBattleAssets } from "../game/assets/decodedImageCache.js";
import { CONVOY_ANIMATION_CONFIG } from "../game/chapter07/convoyAnimationConfig.js";

const troopModules = import.meta.glob("../game/assets/troop/**/*.png", { query: "?url", import: "default" });
const enemyModules = import.meta.glob("../game/assets/enemy/**/*.png", { query: "?url", import: "default" });
const convoyModules = import.meta.glob("../game/assets/convoy/**/*.webp", { query: "?url", import: "default" });
const manifestModules = import.meta.glob("../game/assets/enemy/*/manifest.json", { eager: true, import: "default" });

const CONVOY_ENTRIES = Object.freeze([
  ["tr7_pioneiro", "TR-7 Pioneiro"], ["tr7r_peregrino", "TR-7R Peregrino"], ["tr7a_bastilha", "TR-7A Bastilha"], ["tr7f_ferrum", "TR-7F Ferrum"],
  ["tr9_atlas", "TR-9 Atlas"], ["tr9p_vertice", "TR-9P Vértice"], ["tr9s_sobrevivente", "TR-9S Sobrevivente"], ["trx_exodo", "TR-X Êxodo"],
].map(([id, label]) => ({ id, label, assetStates: Object.keys(CONVOY_ANIMATION_CONFIG) })));
const defaultStates = (type, entity) => entity?.assetStates || (type === "troop" ? ["idle", "attack"] : ["walking", "attack", "idle"]);
const entityFor = (type, id) => type === "troop" ? TROOPS[id] : type === "convoy" ? CONVOY_ENTRIES.find((entry) => entry.id === id) : ENEMIES[id];

async function loadStateFrames(modules, folder, state, options) {
  const entries = modulesFor(modules, folder, state);
  const urls = await Promise.all(entries.map(([, load]) => load()));
  if (options.signal?.aborted) throw createAssetAbortError();
  const images = await Promise.all(urls.map((url) => loadDecodedImage(url, options.signal, options.retainedKeys)));
  const frames = [];
  entries.forEach(([key], index) => { frames[frameNumber(key)] = images[index]; });
  return { frames, files: entries.map(([key]) => key.split("/").at(-1)) };
}

export async function loadAnimationEntity({ type, id, signal } = {}) {
  const entity = entityFor(type, id);
  if (!entity) throw new Error(`Personagem não encontrado: ${type}/${id}`);
  const modules = type === "troop" ? troopModules : type === "convoy" ? convoyModules : enemyModules;
  const folder = type === "troop" ? (entity.spriteKey || id) : id;
  const retainedKeys = new Set();
  const states = {};
  const files = {};
  for (const state of defaultStates(type, entity)) {
    const result = await loadStateFrames(modules, folder, state, { signal, retainedKeys });
    states[state] = result.frames;
    files[state] = result.files;
  }
  const manifestKey = type === "enemy" && Object.keys(manifestModules).find((key) => key.endsWith(`/enemy/${id}/manifest.json`));
  return { id, type, entity, states, files, manifest: manifestKey ? manifestModules[manifestKey] : null, _assetCacheKeys: retainedKeys };
}

export function releaseAnimationEntityAssets(assets) {
  releaseBattleAssets(assets);
}

export function getAnimationEntityStates(type, id) {
  return defaultStates(type, entityFor(type, id));
}

export function getConvoyAnimationLabEntries() { return CONVOY_ENTRIES; }

export function getAnimationFrame(assets, state, frame) {
  return assets?.states?.[state]?.[frame] || null;
}
