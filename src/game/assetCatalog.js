import { ENEMIES, TROOPS } from "./content.js";

const troopFrameModules = import.meta.glob([
  "./assets/troop/**/*.png",
  "!./assets/troop/muralhaReforcada/idle/**/*.png",
], { query: "?url", import: "default" });
const enemyFrameModules = import.meta.glob("./assets/enemy/**/*.png", { query: "?url", import: "default" });
const defenseFrameModules = import.meta.glob("./assets/defense/**/*.png", { query: "?url", import: "default" });
const effectFrameModules = import.meta.glob("./assets/effects/**/*.png", { query: "?url", import: "default" });
const arenaUrls = import.meta.glob("./assets/arenas/*.webp", { eager: true, query: "?url", import: "default" });
const audioUrls = import.meta.glob("./assets/sfx/*.{ogg,wav}", { eager: true, query: "?url", import: "default" });
const previewUrls = import.meta.glob([
  "./assets/troop/*/idle/frame0.png",
  "!./assets/troop/muralhaReforcada/idle/frame0.png",
  "./assets/troop/*/defense/frame0.png",
], { eager: true, query: "?url", import: "default" });
const enemyPreviewUrls = import.meta.glob([
  "./assets/enemy/*/*/frame0.png",
], { eager: true, query: "?url", import: "default" });
const enemyConceptUrls = import.meta.glob("./assets/enemy/concepts/*.webp", { eager: true, query: "?url", import: "default" });
const troopPreviewFrameCache = new Map();
const decodedImageCache = new Map();

const frameNumber = (key) => Number(/frame(\d+)\.png$/i.exec(key)?.[1] || 0);

function modulesFor(modules, folder, state) {
  return Object.entries(modules)
    .filter(([key]) => key.includes(`/${folder}/${state}/`))
    .sort(([left], [right]) => frameNumber(left) - frameNumber(right));
}

function abortError() {
  return new DOMException("Asset loading aborted.", "AbortError");
}

function decodeImage(url) {
  if (import.meta.env.MODE === "test") return Promise.resolve({ src: url, width: 1, height: 1 });
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = async () => {
      if (typeof createImageBitmap === "function") {
        try {
          resolve(await createImageBitmap(image));
          return;
        } catch {
          // HTMLImageElement remains a safe decoding fallback.
        }
      }
      resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function loadImage(url, signal, retainedKeys) {
  let entry = decodedImageCache.get(url);
  if (!entry) {
    entry = { promise: null, references: 0, width: 0, height: 0 };
    entry.promise = decodeImage(url)
      .then((image) => {
        entry.width = image?.width || 0;
        entry.height = image?.height || 0;
        return image;
      })
      .catch((error) => {
        decodedImageCache.delete(url);
        throw error;
      });
    decodedImageCache.set(url, entry);
  }
  if (retainedKeys && !retainedKeys.has(url)) {
    retainedKeys.add(url);
    entry.references += 1;
  }
  if (!signal) return entry.promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    entry.promise.then(
      (image) => {
        signal.removeEventListener("abort", abort);
        resolve(image);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

async function loadFrameSet(modules, folder, state, options = {}) {
  const entries = modulesFor(modules, folder, state);
  const urls = await Promise.all(entries.map(([, load]) => load()));
  if (options.signal?.aborted) throw abortError();
  const images = await Promise.all(urls.map((url) => loadImage(url, options.signal, options.retainedKeys)));
  const frames = [];
  entries.forEach(([key], index) => {
    frames[frameNumber(key)] = images[index];
  });
  return frames;
}

export function resolveTroopFrame(troopAssets, state, frame) {
  const stateFrames = troopAssets?.[state] || [];
  const idleFrames = troopAssets?.idle || [];
  return stateFrames[frame]
    || idleFrames[frame]
    || stateFrames.find(Boolean)
    || idleFrames.find(Boolean)
    || null;
}

export function getTroopPreviewUrl(troopId) {
  const spriteKey = TROOPS[troopId]?.spriteKey || troopId;
  const preferred = spriteKey === "muralhaReforcada"
    ? "defense"
    : "idle";
  const match = Object.entries(previewUrls).find(([key]) => key.includes(`/${spriteKey}/${preferred}/frame0.png`));
  return match?.[1] || null;
}

export function loadTroopPreviewFrameUrls(troopId, state = "idle") {
  const troop = TROOPS[troopId];
  const spriteKey = troop?.spriteKey || troopId;
  const preferredState = state === "idle"
    ? spriteKey === "muralhaReforcada"
      ? "defense"
      : state
    : state;
  const cacheKey = `${spriteKey}:${preferredState}`;
  if (!troopPreviewFrameCache.has(cacheKey)) {
    const loaders = modulesFor(troopFrameModules, spriteKey, preferredState)
      .map(([, load]) => load());
    troopPreviewFrameCache.set(cacheKey, Promise.all(loaders).then((urls) => urls.filter(Boolean)));
  }
  return troopPreviewFrameCache.get(cacheKey);
}

export function clearTroopPreviewFrameCache() {
  troopPreviewFrameCache.clear();
}

export function getAssetCacheMetrics() {
  let decodedBytes = 0;
  let retainedImages = 0;
  for (const entry of decodedImageCache.values()) {
    decodedBytes += entry.width * entry.height * 4;
    if (entry.references > 0) retainedImages += 1;
  }
  return {
    images: decodedImageCache.size,
    retainedImages,
    approximateDecodedBytes: decodedBytes,
  };
}

export function releaseBattleAssets(assets) {
  for (const url of assets?._assetCacheKeys || []) {
    const entry = decodedImageCache.get(url);
    if (!entry) continue;
    entry.references = Math.max(0, entry.references - 1);
    if (entry.references === 0) {
      entry.promise.then((image) => image?.close?.()).catch(() => {});
      decodedImageCache.delete(url);
    }
  }
  assets?._assetCacheKeys?.clear();
}

export function clearDecodedImageCache() {
  for (const entry of decodedImageCache.values()) {
    entry.promise.then((image) => image?.close?.()).catch(() => {});
  }
  decodedImageCache.clear();
}

export function getArenaUrl(arenaId) {
  const match = Object.entries(arenaUrls).find(([key]) => key.endsWith(`/${arenaId}.webp`));
  return match?.[1] || "";
}

export function getEnemyPreviewUrl(enemyId) {
  const previewState = ENEMIES[enemyId]?.previewState || "idle";
  const match = Object.entries(enemyPreviewUrls)
    .find(([key]) => key.includes(`/enemy/${enemyId}/${previewState}/frame0.png`));
  return match?.[1] || getEnemyConceptUrl(enemyId);
}

export function getEnemyConceptUrl(enemyId) {
  const match = Object.entries(enemyConceptUrls).find(([key]) => key.endsWith(`/concepts/${enemyId}.webp`));
  return match?.[1] || "";
}

export class AssetDependencyError extends Error {
  constructor(message, dependencies = []) {
    super(message);
    this.name = "AssetDependencyError";
    this.dependencies = dependencies;
  }
}

const ASSET_REFERENCE_KEYS = Object.freeze([
  "type", "troopId", "assetTroopId", "enemyId", "assetEnemyId",
  "sourceType", "targetType", "from", "to", "resultType", "transformsInto",
]);
const ASSET_COLLECTION_KEYS = Object.freeze([
  "required", "requiredTroopAssetIds", "alliedSummons", "temporaryTroops",
  "transformations", "troopTransformations", "dependencies", "entries",
]);

function appendAssetReferences(value, destination, origin, visited = new WeakSet()) {
  if (typeof value === "string") { destination.push({ id: value, origin }); return; }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendAssetReferences(entry, destination, `${origin}[${index}]`, visited));
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  ASSET_REFERENCE_KEYS.forEach((key) => {
    if (typeof value[key] === "string") destination.push({ id: value[key], origin: `${origin}.${key}` });
  });
  ASSET_COLLECTION_KEYS.forEach((key) => {
    if (value[key] != null) appendAssetReferences(value[key], destination, `${origin}.${key}`, visited);
  });
}

function strictDependencyMode(options = {}) {
  if (typeof options.strict === "boolean") return options.strict;
  return Boolean(import.meta.env?.DEV || import.meta.env?.MODE === "test");
}

function reportUnknownDependencies(kind, phase, records, options = {}) {
  if (!records.length) return;
  const unique = [...new Map(records.map((record) => [`${record.id}:${record.origin}`, record])).values()];
  const label = kind === "troop" ? "tropa" : "inimigo";
  const message = unique.map((record) => (
    `Dependência de asset de ${label} desconhecida: ${record.id}\n`
    + `Fase: ${phase?.id || "<sem fase>"}\n`
    + `Origem: ${record.origin}`
  )).join("\n\n");
  if (strictDependencyMode(options)) throw new AssetDependencyError(message, unique);
  (options.onWarning || console.warn)(message);
}

function resolveRegistryRecords(records, registry, kind, phase, options = {}) {
  const known = [];
  const unknown = [];
  const seen = new Set();
  for (const record of records) {
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);
    if (registry[record.id]) known.push(record.id);
    else unknown.push(record);
  }
  reportUnknownDependencies(kind, phase, unknown, options);
  return known;
}

export function resolvePhaseTroopAssetDependencies(phase, loadout = [], options = {}) {
  const records = [];
  appendAssetReferences(Array.isArray(loadout) ? loadout : [], records, "loadout");
  appendAssetReferences(phase?.startingTroops, records, "startingTroops");
  appendAssetReferences(phase?.requiredTroopAssetIds, records, "requiredTroopAssetIds");
  appendAssetReferences(phase?.alliedSummons, records, "alliedSummons");
  appendAssetReferences(phase?.temporaryTroops, records, "temporaryTroops");
  appendAssetReferences(phase?.troopTransformations, records, "troopTransformations");
  appendAssetReferences(phase?.troopAssetDependencies, records, "troopAssetDependencies");
  return resolveRegistryRecords(records, TROOPS, "troop", phase, options);
}

export function resolveBattleTroopAssetIds(phase, loadout = [], options = {}) {
  return resolvePhaseTroopAssetDependencies(phase, loadout, options);
}

function phaseEnemyRecords(phase, enemyIds) {
  const records = [];
  appendAssetReferences(enemyIds, records, "enemyIds");
  for (const [waveIndex, wave] of (phase?.waves || []).entries()) {
    appendAssetReferences(wave?.enemies, records, `waves[${waveIndex}].enemies`);
    appendAssetReferences(wave?.bossEncounter?.type, records, `waves[${waveIndex}].bossEncounter.type`);
  }
  appendAssetReferences(phase?.enemyAssetDependencies, records, "enemyAssetDependencies");
  return records;
}

export function resolvePhaseEnemyAssetDependencies(phase, enemyIds = [], options = {}) {
  const queue = phaseEnemyRecords(phase, enemyIds);
  const resolved = [];
  const unknown = [];
  const seen = new Set();
  for (let index = 0; index < queue.length; index += 1) {
    const record = queue[index];
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);
    const config = ENEMIES[record.id];
    if (!config) { unknown.push(record); continue; }
    resolved.push(record.id);
    appendAssetReferences(config.assetDependencies, queue, `ENEMIES.${record.id}.assetDependencies`);
  }
  reportUnknownDependencies("enemy", phase, unknown, options);
  return resolved;
}

export function resolvePhaseEnemyEffectDependencies(phase, enemyIds = [], options = {}) {
  const resolvedEnemies = resolvePhaseEnemyAssetDependencies(phase, enemyIds, options);
  const effects = [];
  appendAssetReferences(phase?.effectAssetDependencies, effects, "effectAssetDependencies");
  resolvedEnemies.forEach((enemyId) => {
    appendAssetReferences(ENEMIES[enemyId]?.effectDependencies, effects, `ENEMIES.${enemyId}.effectDependencies`);
  });
  return [...new Set(effects.map((entry) => entry.id).filter(Boolean))];
}

function statesForFolder(modules, folder) {
  const states = new Set();
  for (const key of Object.keys(modules)) {
    const marker = `/${folder}/`;
    const start = key.indexOf(marker);
    if (start < 0) continue;
    const remainder = key.slice(start + marker.length);
    const state = remainder.split("/")[0];
    if (state) states.add(state);
  }
  return [...states];
}

export async function runWithConcurrency(tasks, options = {}) {
  if (!tasks.length) return Promise.resolve([]);
  const concurrency = Math.max(1, Math.min(8, Math.floor(Number(options.concurrency) || 4)));
  const results = new Array(tasks.length);
  let cursor = 0;
  let firstError = null;

  const recordError = (error) => {
    if (!firstError) firstError = error;
  };
  const abort = () => recordError(abortError());
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();

  const worker = async () => {
    while (!firstError) {
      const taskIndex = cursor;
      if (taskIndex >= tasks.length) return;
      cursor += 1;
      try {
        results[taskIndex] = await tasks[taskIndex]();
        options.onTaskComplete?.(taskIndex, results[taskIndex]);
      } catch (error) {
        options.onTaskError?.(taskIndex, error);
        recordError(error);
      }
    }
  };

  return Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  ).then(() => {
    if (firstError) throw firstError;
    return results;
  }).finally(() => {
    options.signal?.removeEventListener("abort", abort);
  });
}

export async function loadBattleAssets(phase, loadout, onProgress = () => {}, options = {}) {
  if (options.signal?.aborted) throw abortError();
  const dependencyOptions = {
    strict: options.strictDependencies,
    onWarning: options.onDependencyWarning,
  };
  const troopIds = resolvePhaseTroopAssetDependencies(phase, loadout, dependencyOptions);
  const hasExplicitEnemyIds = Array.isArray(options.enemyIds);
  const enemyPhase = hasExplicitEnemyIds ? null : phase;
  const explicitEnemyIds = hasExplicitEnemyIds ? options.enemyIds : [];
  const enemyIds = resolvePhaseEnemyAssetDependencies(
    enemyPhase,
    explicitEnemyIds,
    dependencyOptions,
  );
  const effectDependencies = resolvePhaseEnemyEffectDependencies(
    enemyPhase,
    enemyIds,
    dependencyOptions,
  );
  const tasks = [];
  const priorityTasks = [];
  const deferredTasks = [];
  const retainedKeys = new Set();
  const loadOptions = { signal: options.signal, retainedKeys };
  const result = {
    troops: {}, enemies: {}, defenses: {}, effects: {}, audio: {},
    _assetCacheKeys: retainedKeys,
  };

  result.effectDependencies = effectDependencies;
  for (const effectId of effectDependencies) {
    const states = statesForFolder(effectFrameModules, effectId);
    if (!states.length) continue;
    result.effects[effectId] ||= {};
    for (const state of states) {
      tasks.push(async () => {
        result.effects[effectId][state] = await loadFrameSet(
          effectFrameModules, effectId, state, loadOptions,
        );
      });
    }
  }

  result.effects.colonyCapsule = {};
  for (const state of ["falling", "idle", "opening"]) {
    tasks.push(async () => {
      result.effects.colonyCapsule[state] = await loadFrameSet(effectFrameModules, "colonyCapsule", state, loadOptions);
    });
  }

  if (troopIds.includes("executorArco")) {
    result.effects.executorArcSlash = {};
    for (const state of ["flying", "impact"]) {
      tasks.push(async () => {
        result.effects.executorArcSlash[state] = await loadFrameSet(
          effectFrameModules,
          "executorArcSlash",
          state, loadOptions,
        );
      });
    }
  }

  if (phase.environmentHazard?.id === "sandstorm") {
    result.effects.sandBurial = {};
    tasks.push(async () => {
      result.effects.sandBurial.buried = await loadFrameSet(
        effectFrameModules,
        "sandBurial",
        "buried", loadOptions,
      );
    });
  }

  if (phase.environmentHazard?.id === "wind_current") {
    result.effects.windCurrent = {};
    for (const state of ["dustDebris", "rockDebris", "emergencyReturn"]) {
      tasks.push(async () => {
        result.effects.windCurrent[state] = await loadFrameSet(
          effectFrameModules,
          "windCurrent",
          state, loadOptions,
        );
      });
    }
  }

  if (!options.skipDefenses) {
    result.defenses.pulsoDesmaterializacao = {};
    for (const state of ["idle", "attack", "dead"]) {
      tasks.push(async () => {
        result.defenses.pulsoDesmaterializacao[state] = await loadFrameSet(
          defenseFrameModules,
          "pulsoDesmaterializacao",
          state, loadOptions,
        );
      });
    }
  }

  for (const troopId of troopIds) {
    const troop = TROOPS[troopId];
    const states = troop.assetStates || (troopId === "muralhaReforcada" ? ["defense"] : ["idle", "attack"]);
    result.troops[troopId] = {};
    for (const state of states) {
      const task = async () => {
        let frames = await loadFrameSet(
          troopFrameModules, troop.spriteKey, state, loadOptions,
        );
        const fallbackState = troop.assetStateFallbacks?.[state];
        if (!frames.some(Boolean) && fallbackState) {
          frames = await loadFrameSet(
            troopFrameModules, troop.spriteKey, fallbackState, loadOptions,
          );
        }
        result.troops[troopId][state] = frames;
      };
      const rareState = /death|dead|special|transition/i.test(state);
      const bucket = options.deferRareStates && rareState
        ? deferredTasks
        : state === "idle" || state === "defense" ? priorityTasks : tasks;
      bucket.push(task);
    }
  }

  for (const enemyId of enemyIds) {
    const enemy = ENEMIES[enemyId];
    if (!enemy) continue;
    result.enemies[enemyId] = {};
    for (const state of enemy.assetStates || ["walking", "attack", "idle"]) {
      const task = async () => {
        result.enemies[enemyId][state] = await loadFrameSet(enemyFrameModules, enemyId, state, loadOptions);
      };
      (options.deferRareStates && /death|dead|destroy|transition/i.test(state) ? deferredTasks : tasks).push(task);
    }
  }

  let done = 0;
  const total = priorityTasks.length + tasks.length;
  const taskOptions = {
    concurrency: options.assetConcurrency ?? 4,
    signal: options.signal,
    onTaskComplete: () => {
      done += 1;
      onProgress({ done, total, percent: Math.round((done / Math.max(1, total)) * 100) });
    },
  };
  try {
    await runWithConcurrency(priorityTasks, taskOptions);
    await runWithConcurrency(tasks, taskOptions);
  } catch (error) {
    releaseBattleAssets(result);
    throw error;
  }

  for (const [key, url] of Object.entries(audioUrls)) {
    result.audio[key.split("/").at(-1)] = url;
  }
  result.loadDeferred = async () => {
    let deferredDone = 0;
    await runWithConcurrency(deferredTasks, {
      concurrency: options.assetConcurrency ?? 4,
      signal: options.signal,
      onTaskComplete: () => {
        deferredDone += 1;
        onProgress({
          done: deferredDone,
          total: deferredTasks.length,
          percent: Math.round((deferredDone / Math.max(1, deferredTasks.length)) * 100),
          phase: "deferred",
        });
      },
    });
    return result;
  };
  result.deferredStates = deferredTasks.length;
  result.metrics = getAssetCacheMetrics();
  return result;
}
