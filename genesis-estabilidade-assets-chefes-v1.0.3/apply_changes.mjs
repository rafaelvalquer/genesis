#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const repoRoot = path.resolve(process.argv[2] || process.cwd());

class PatchError extends Error {}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function write(relativePath, content) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function copyPayload(relativePath) {
  const source = path.join(PAYLOAD_ROOT, relativePath);
  const destination = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function replaceRequired(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return text;
  const count = text.split(oldValue).length - 1;
  if (count !== 1) throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  return text.replace(oldValue, newValue);
}

function findMatching(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === openChar) depth += 1;
    if (char === closeChar && --depth === 0) return index;
  }
  throw new PatchError(`Delimitador ${openChar}${closeChar} não foi fechado.`);
}

function replaceFunction(source, name, replacement) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    if (source.includes(replacement.trim())) return source;
    throw new PatchError(`Função ${name} não encontrada.`);
  }
  const bodyOpen = source.indexOf("{", start);
  const bodyClose = findMatching(source, bodyOpen, "{", "}");
  return source.slice(0, start) + replacement + source.slice(bodyClose + 1);
}

const MOJIBAKE_MAP = new Map([
  ["Ã¡", "á"], ["Ã¢", "â"], ["Ã£", "ã"], ["Ã¤", "ä"],
  ["Ã©", "é"], ["Ãª", "ê"], ["Ã¨", "è"], ["Ã­", "í"],
  ["Ã³", "ó"], ["Ã´", "ô"], ["Ãµ", "õ"], ["Ã¶", "ö"],
  ["Ãº", "ú"], ["Ã¼", "ü"], ["Ã§", "ç"],
  ["Ã", "Á"], ["Ã‚", "Â"], ["Ãƒ", "Ã"], ["Ã‰", "É"],
  ["ÃŠ", "Ê"], ["Ã", "Í"], ["Ã“", "Ó"], ["Ã”", "Ô"],
  ["Ã•", "Õ"], ["Ãš", "Ú"], ["Ã‡", "Ç"],
  ["â€“", "–"], ["â€”", "—"], ["â€œ", "“"], ["â€", "”"],
  ["â€™", "’"], ["â€¦", "…"], ["Âº", "º"], ["Âª", "ª"],
  ["Â°", "°"], ["Â ", " "],
]);

function repairMojibake(source) {
  let result = source;
  for (let pass = 0; pass < 3; pass += 1) {
    const before = result;
    for (const [broken, fixed] of MOJIBAKE_MAP) result = result.split(broken).join(fixed);
    if (result === before) break;
  }
  return result;
}

function repairRepositoryEncoding() {
  const extensions = new Set([
    ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json",
    ".md", ".html", ".css", ".scss", ".ps1", ".py", ".txt",
    ".yml", ".yaml",
  ]);
  const ignored = new Set([".git", ".genesis-backups", "node_modules", "dist", ".vite", "coverage", "assets", "art"]);
  let changed = 0;
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (!ignored.has(entry.name)) walk(fullPath); continue; }
      if (!extensions.has(path.extname(entry.name).toLowerCase())) continue;
      const relativePath = path.relative(repoRoot, fullPath).replaceAll(path.sep, "/");
      if (relativePath === "scripts/check-encoding.mjs") continue;
      const source = fs.readFileSync(fullPath, "utf8");
      const fixed = repairMojibake(source);
      if (fixed !== source) { fs.writeFileSync(fullPath, fixed, "utf8"); changed += 1; }
    }
  }
  for (const root of ["src", "scripts", "tools", "docs"]) walk(path.join(repoRoot, root));
  return changed;
}

function patchPackageJson() {
  const packageJson = JSON.parse(read("package.json"));
  packageJson.scripts ||= {};
  Object.assign(packageJson.scripts, {
    build: "vite build",
    test: "vitest run",
    "test:unit": "vitest run",
    "verify:encoding": "node scripts/check-encoding.mjs",
    "verify:assets": "node scripts/check-assets.js",
    "verify:crisalio": "node scripts/check-crisalio-frames.mjs",
    "audit:leviathan": "node scripts/audit-leviathan-sprite-components.mjs",
    ci: "npm run verify:encoding && npm run test && npm run build",
    "release:check": "npm run ci && npm run verify:assets && npm run verify:crisalio",
  });
  write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
}

function patchAssetCatalog() {
  let text = read("src/game/assetCatalog.js");
  if (!text.includes("export class AssetDependencyError")) {
    const start = text.indexOf("function enemyAssetDependencies(enemyIds)");
    const end = text.indexOf("export async function loadBattleAssets");
    if (start < 0 || end < 0 || end <= start) throw new PatchError("Bloco de dependências do assetCatalog.js não encontrado.");
    const block = `export function getEnemyConceptUrl(enemyId) {
  const match = Object.entries(enemyConceptUrls).find(([key]) => key.endsWith(\`/concepts/\${enemyId}.webp\`));
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
    value.forEach((entry, index) => appendAssetReferences(entry, destination, \`\${origin}[\${index}]\`, visited));
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  ASSET_REFERENCE_KEYS.forEach((key) => {
    if (typeof value[key] === "string") destination.push({ id: value[key], origin: \`\${origin}.\${key}\` });
  });
  ASSET_COLLECTION_KEYS.forEach((key) => {
    if (value[key] != null) appendAssetReferences(value[key], destination, \`\${origin}.\${key}\`, visited);
  });
}

function strictDependencyMode(options = {}) {
  if (typeof options.strict === "boolean") return options.strict;
  return Boolean(import.meta.env?.DEV || import.meta.env?.MODE === "test");
}

function reportUnknownDependencies(kind, phase, records, options = {}) {
  if (!records.length) return;
  const unique = [...new Map(records.map((record) => [\`\${record.id}:\${record.origin}\`, record])).values()];
  const label = kind === "troop" ? "tropa" : "inimigo";
  const message = unique.map((record) => (
    \`Dependência de asset de \${label} desconhecida: \${record.id}\\n\`
    + \`Fase: \${phase?.id || "<sem fase>"}\\n\`
    + \`Origem: \${record.origin}\`
  )).join("\\n\\n");
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
    appendAssetReferences(wave?.enemies, records, \`waves[\${waveIndex}].enemies\`);
    appendAssetReferences(wave?.bossEncounter?.type, records, \`waves[\${waveIndex}].bossEncounter.type\`);
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
    appendAssetReferences(config.assetDependencies, queue, \`ENEMIES.\${record.id}.assetDependencies\`);
  }
  reportUnknownDependencies("enemy", phase, unknown, options);
  return resolved;
}

export function resolvePhaseEnemyEffectDependencies(phase, enemyIds = [], options = {}) {
  const resolvedEnemies = resolvePhaseEnemyAssetDependencies(phase, enemyIds, options);
  const effects = [];
  appendAssetReferences(phase?.effectAssetDependencies, effects, "effectAssetDependencies");
  resolvedEnemies.forEach((enemyId) => {
    appendAssetReferences(ENEMIES[enemyId]?.effectDependencies, effects, \`ENEMIES.\${enemyId}.effectDependencies\`);
  });
  return [...new Set(effects.map((entry) => entry.id).filter(Boolean))];
}

function statesForFolder(modules, folder) {
  const states = new Set();
  for (const key of Object.keys(modules)) {
    const marker = \`/\${folder}/\`;
    const start = key.indexOf(marker);
    if (start < 0) continue;
    const remainder = key.slice(start + marker.length);
    const state = remainder.split("/")[0];
    if (state) states.add(state);
  }
  return [...states];
}

export async function runWithConcurrency(tasks, options = {}) {
  if (!tasks.length) return;
  const concurrency = Math.max(1, Math.min(8, Math.floor(Number(options.concurrency) || 4)));
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      if (options.signal?.aborted) throw abortError();
      const taskIndex = cursor;
      cursor += 1;
      await tasks[taskIndex]();
      options.onTaskComplete?.(taskIndex);
    }
  });
  await Promise.all(workers);
}

`;
    text = text.slice(0, start) + block + text.slice(end);
  }

  const oldLoadStart = `  const troopIds = resolvePhaseTroopAssetDependencies(phase, loadout);
  const enemyIds = enemyAssetDependencies([
    ...new Set(options.enemyIds || phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type))),
  ]);`;
  const newLoadStart = `  const dependencyOptions = {
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
  );`;
  text = replaceRequired(text, oldLoadStart, newLoadStart, "assetCatalog/início do carregamento");

  const resultMarker = `  const result = {
    troops: {}, enemies: {}, defenses: {}, effects: {}, audio: {},
    _assetCacheKeys: retainedKeys,
  };
`;
  const effectSetup = `${resultMarker}
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
`;
  if (!text.includes("result.effectDependencies = effectDependencies;")) {
    text = replaceRequired(text, resultMarker, effectSetup, "assetCatalog/dependências de efeitos");
  }

  const oldTaskLoop = `  let done = 0;
  const orderedTasks = [...priorityTasks, ...tasks];
  try {
    for (const task of orderedTasks) {
      if (options.signal?.aborted) throw abortError();
      await task();
      done += 1;
      onProgress({ done, total: orderedTasks.length, percent: Math.round((done / orderedTasks.length) * 100) });
    }
  } catch (error) {
    releaseBattleAssets(result);
    throw error;
  }`;
  const newTaskLoop = `  let done = 0;
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
  }`;
  text = replaceRequired(text, oldTaskLoop, newTaskLoop, "assetCatalog/concorrência principal");

  const oldDeferred = `  result.loadDeferred = async () => {
    let deferredDone = 0;
    for (const task of deferredTasks) {
      if (options.signal?.aborted) throw abortError();
      await task();
      deferredDone += 1;
      onProgress({
        done: deferredDone,
        total: deferredTasks.length,
        percent: Math.round((deferredDone / Math.max(1, deferredTasks.length)) * 100),
        phase: "deferred",
      });
    }
    return result;
  };`;
  const newDeferred = `  result.loadDeferred = async () => {
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
  };`;
  text = replaceRequired(text, oldDeferred, newDeferred, "assetCatalog/concorrência adiada");
  write("src/game/assetCatalog.js", text);
}

function patchContent() {
  let text = read("src/game/content.js");
  const queenStart = text.indexOf("  workerQueen: {");
  if (queenStart < 0) throw new PatchError("ENEMIES.workerQueen não encontrado.");
  const queenEnd = text.indexOf("  workerQueenEgg: {", queenStart);
  const queenSegment = text.slice(queenStart, queenEnd);
  if (!queenSegment.includes("assetDependencies:")) {
    const marker = '    encyclopediaUnlockAt: 16,\n    assetStates: [';
    const updated = replaceRequired(
      queenSegment,
      marker,
      '    encyclopediaUnlockAt: 16,\n    assetDependencies: Object.freeze(["workerQueenEgg", "silicaDigger"]),\n    assetStates: [',
      "content/workerQueen.assetDependencies",
    );
    text = text.slice(0, queenStart) + updated + text.slice(queenEnd);
  }

  const leviathanStart = text.indexOf("  leviathanNereida: {");
  if (leviathanStart < 0) throw new PatchError("ENEMIES.leviathanNereida não encontrado.");
  const leviathanEnd = text.indexOf("  carapacaNereida: {", leviathanStart);
  const leviathanSegment = text.slice(leviathanStart, leviathanEnd);
  if (!leviathanSegment.includes("effectDependencies:")) {
    const marker = '    previewState: "idleSurface",\n';
    const updated = replaceRequired(
      leviathanSegment,
      marker,
      marker + '    assetDependencies: Object.freeze([]),\n'
        + '    effectDependencies: Object.freeze([\n'
        + '      "leviathanBrine", "leviathanVortex", "leviathanDeluge",\n'
        + '    ]),\n',
      "content/leviathan.effectDependencies",
    );
    text = text.slice(0, leviathanStart) + updated + text.slice(leviathanEnd);
  }
  write("src/game/content.js", text);
}

function patchChapterFivePhases() {
  let text = read("src/game/chapterFivePhases.js");
  const oldMarker = "export const CHAPTER_FIVE_PHASE_BLUEPRINTS = [";
  const newMarker = "export const CHAPTER_FIVE_PHASE_BLUEPRINTS = Object.freeze([";
  if (!text.includes(newMarker)) {
    const start = text.indexOf(oldMarker);
    if (start < 0) throw new PatchError("CHAPTER_FIVE_PHASE_BLUEPRINTS não encontrado.");
    const open = text.indexOf("[", start);
    const close = findMatching(text, open, "[", "]");
    text = text.slice(0, start) + newMarker
      + text.slice(open + 1, close)
      + "].map((blueprint) => Object.freeze(blueprint)))"
      + text.slice(close + 1);
  }
  write("src/game/chapterFivePhases.js", text);
}

function patchBattleModel() {
  let text = read("src/game/battleModel.js");
  const importMarker = 'import { CHAPTER_FIVE_PACKETS } from "./chapterFivePackets.js";';
  const bossImport = `import {
  enqueueBossReinforcement as enqueueBossReinforcementSystem,
  initializeBossEncounterForWave,
  markBossEncounterSpawned,
  shouldDeferBossAwareSpawn,
  updateBossEncounter as updateBossEncounterSystem,
} from "./systems/bossEncounterSystem.js";`;
  if (!text.includes('from "./systems/bossEncounterSystem.js"')) {
    text = replaceRequired(text, importMarker, `${importMarker}\n${bossImport}`, "battleModel/import do chefe");
  }

  const oldLimit = `export function getTroopDeploymentLimit(troopId) {
  return Number.isFinite(TROOPS[troopId]?.maxDeployed) ? TROOPS[troopId].maxDeployed : DEFAULT_MAX_DEPLOYED_PER_TROOP;
}`;
  const newLimit = `export function getTroopDeploymentLimit(troopId, phaseOrSession = null) {
  const phase = phaseOrSession?.phase || phaseOrSession;
  const missionLimit = Number(
    phase?.startingTroopRules?.deploymentLimits?.[troopId]
      ?? phase?.troopDeploymentLimits?.[troopId],
  );
  if (Number.isFinite(missionLimit) && missionLimit >= 0) return Math.floor(missionLimit);
  return Number.isFinite(TROOPS[troopId]?.maxDeployed)
    ? TROOPS[troopId].maxDeployed
    : DEFAULT_MAX_DEPLOYED_PER_TROOP;
}`;
  text = replaceRequired(text, oldLimit, newLimit, "battleModel/limite por missão");
  text = replaceRequired(
    text,
    "  const deploymentLimit = getTroopDeploymentLimit(troopId);",
    "  const deploymentLimit = getTroopDeploymentLimit(troopId, session);",
    "battleModel/canPlaceTroop",
  );
  text = replaceRequired(
    text,
    "    maxDeployed: getTroopDeploymentLimit(troopId),",
    "    maxDeployed: getTroopDeploymentLimit(troopId, session),",
    "battleModel/retorno placeTroop",
  );

  const oldStart = `  session.bossEncounter = wave?.bossEncounter ? {
    ...wave.bossEncounter,
    spawned: false,
    reinforcementPackets: new Set(),
  } : null;
  if (session.bossEncounter) {
    session.queue.push({ type: session.bossEncounter.type, variant: null, sourceIndex: 0, row: 2, packetId: "boss_encounter", block: "boss", spawnAtMs: session.bossEncounter.spawnAtMs });
    session.queue.sort((left, right) => left.spawnAtMs - right.spawnAtMs || String(left.packetId || "").localeCompare(String(right.packetId || "")));
  }`;
  const newStart = `  initializeBossEncounterForWave(session, wave, session.queue, { row: 2 });`;
  text = replaceRequired(text, oldStart, newStart, "battleModel/inicialização do chefe");

  text = replaceFunction(text, "enqueueBossReinforcement", `function enqueueBossReinforcement(session, packetKey) {
  return enqueueBossReinforcementSystem(session, packetKey, {
    packets: CHAPTER_FIVE_PACKETS,
    fieldRows: FIELD.rows,
  });
}`);
  text = replaceFunction(text, "shouldDeferChapterFiveSpawn", `function shouldDeferChapterFiveSpawn(session, queued) {
  const maximum = session.phase.waves[session.waveIndex]?.maximumLivingEnemies;
  return shouldDeferBossAwareSpawn(
    session,
    queued,
    maximum,
    livingEnemyCount(session),
  );
}`);
  text = replaceFunction(text, "updateBossEncounter", `function updateBossEncounter(session) {
  return updateBossEncounterSystem(session, {
    enqueueReinforcement: (packetKey) => enqueueBossReinforcement(session, packetKey),
  });
}`);

  text = replaceRequired(
    text,
    '      if (queued.type === session.bossEncounter?.type && queued.packetId === "boss_encounter") session.bossEncounter.spawned = true;',
    "      markBossEncounterSpawned(session, queued);",
    "battleModel/marcação da entrada do chefe",
  );
  write("src/game/battleModel.js", text);
}

function assertRepository() {
  const required = [
    "package.json", "src/game/content.js", "src/game/assetCatalog.js",
    "src/game/battleModel.js", "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js", "src/game/chapter05/phase40Scenario.js",
  ];
  const missing = required.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
  if (missing.length) throw new PatchError(`Arquivos obrigatórios ausentes:\n${missing.join("\n")}`);
}

function main() {
  assertRepository();
  patchPackageJson();
  patchAssetCatalog();
  patchContent();
  patchChapterFivePhases();
  patchBattleModel();

  [
    ".editorconfig", ".gitattributes", "scripts/check-encoding.mjs",
    "src/game/systems/bossEncounterSystem.js",
    "src/game/chapter05/phase40Scenario.js",
    "src/game/chapterFiveWaves.js",
    "src/game/missionProvidedAssets.test.js",
    "src/game/phase40AssetLoading.test.js",
    "src/game/assetCatalogConcurrency.test.js",
    "src/game/phase40StartingDefense.test.js",
    "src/game/chapterFivePhase40Balance.test.js",
    "src/game/phase40Scenario.test.js",
    "src/game/systems/bossEncounterSystem.test.js",
    "src/game/phase40BossEncounter.test.js",
  ].forEach(copyPayload);

  const repairedFiles = repairRepositoryEncoding();
  console.log("Alterações aplicadas:");
  console.log("- build separado de testes, auditorias e orçamento de assets");
  console.log("- validação UTF-8 e correção de mojibake");
  console.log("- dependências estritas e genéricas de tropas, inimigos e efeitos");
  console.log("- carregamento concorrente de assets com limite padrão 4");
  console.log("- validação consistente das oito fases do Capítulo 5");
  console.log("- limites explícitos das tropas fornecidas na Fase 40");
  console.log("- blueprints do Capítulo 5 congelados");
  console.log("- sistema genérico de chefe extraído do battleModel");
  console.log(`- ${repairedFiles} arquivo(s) tiveram codificação reparada`);
}

try { main(); } catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
