#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ENEMIES, PHASES, TROOPS } from "../src/game/content.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const positionalRoot = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const repoRoot = path.resolve(positionalRoot || DEFAULT_ROOT);
const skipDecode = process.argv.includes("--skip-decode");
const jsonArgument = process.argv.find((argument) => argument.startsWith("--json="));
const jsonOutput = jsonArgument ? path.resolve(repoRoot, jsonArgument.slice("--json=".length)) : null;

const ASSET_ROOT = path.join(repoRoot, "src", "game", "assets");
const TROOP_ROOT = path.join(ASSET_ROOT, "troop");
const ENEMY_ROOT = path.join(ASSET_ROOT, "enemy");
const EFFECT_ROOT = path.join(ASSET_ROOT, "effects");
const ARENA_ROOT = path.join(ASSET_ROOT, "arenas");

const errors = [];
const warnings = [];
const decodedFiles = new Set();
const validatedStates = new Set();

function issue(collection, code, subject, message, details = {}) {
  collection.push({ code, subject, message, ...details });
}

function directories(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function frameEntries(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^frame\d+\.png$/i.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      index: Number(/^frame(\d+)\.png$/i.exec(entry.name)[1]),
      path: path.join(directory, entry.name),
    }))
    .sort((left, right) => left.index - right.index || left.name.localeCompare(right.name));
}

async function decodePng(filePath, subject) {
  if (skipDecode || decodedFiles.has(filePath)) return;
  try {
    const metadata = await sharp(filePath, { failOn: "error" }).metadata();
    if (metadata.format !== "png" || !metadata.width || !metadata.height) {
      issue(errors, "invalid-png-metadata", subject,
        "O arquivo não possui metadados PNG válidos.", { file: path.relative(repoRoot, filePath) });
      return;
    }
    decodedFiles.add(filePath);
  } catch (error) {
    issue(errors, "png-decode-failed", subject,
      `O Sharp não conseguiu decodificar o PNG: ${error.message}`,
      { file: path.relative(repoRoot, filePath) });
  }
}

async function validateFrameSequence(directory, subject, options = {}) {
  const key = path.resolve(directory);
  if (validatedStates.has(key)) return frameEntries(directory);
  validatedStates.add(key);

  const frames = frameEntries(directory);
  if (!frames.length) {
    if (!options.allowEmpty) {
      issue(errors, "state-without-frames", subject,
        "O estado não possui arquivos frameN.png.",
        { directory: path.relative(repoRoot, directory) });
    }
    return frames;
  }

  const seen = new Set();
  for (const frame of frames) {
    if (seen.has(frame.index)) {
      issue(errors, "duplicate-frame-index", subject,
        `O índice frame${frame.index} está duplicado.`,
        { directory: path.relative(repoRoot, directory) });
    }
    seen.add(frame.index);
  }

  if (frames[0].index !== 0) {
    issue(errors, "frame-sequence-must-start-at-zero", subject,
      `A sequência começa em frame${frames[0].index}; era esperado frame0.`,
      { directory: path.relative(repoRoot, directory) });
  }

  const maximum = frames.at(-1).index;
  const missing = [];
  for (let index = 0; index <= maximum; index += 1) {
    if (!seen.has(index)) missing.push(index);
  }
  if (missing.length) {
    issue(errors, "frame-sequence-gap", subject,
      `Há índices ausentes: ${missing.map((index) => `frame${index}`).join(", ")}.`,
      { directory: path.relative(repoRoot, directory) });
  }

  await Promise.all(frames.map((frame) => decodePng(frame.path, subject)));
  return frames;
}

function configuredStates(config, kind, id) {
  if (Array.isArray(config.assetStates) && config.assetStates.length) return config.assetStates;
  if (kind === "troop" && (config.spriteKey || id) === "muralhaReforcada") return ["defense"];
  return kind === "troop" ? ["idle", "attack"] : ["walking", "attack", "idle"];
}

async function validateEntity(kind, id, config) {
  const spriteKey = kind === "troop" ? config.spriteKey || id : id;
  const root = kind === "troop" ? TROOP_ROOT : ENEMY_ROOT;
  const entityDirectory = path.join(root, spriteKey);
  const subject = `${kind}:${id}`;

  if (!fs.existsSync(entityDirectory)) {
    issue(errors, "sprite-folder-missing", subject,
      `A pasta do sprite '${spriteKey}' não existe.`,
      { directory: path.relative(repoRoot, entityDirectory) });
    return;
  }

  const states = configuredStates(config, kind, id);
  const fallbackMap = config.assetStateFallbacks || {};
  const availableStates = new Set(directories(entityDirectory));

  for (const state of states) {
    const stateDirectory = path.join(entityDirectory, state);
    const frames = frameEntries(stateDirectory);
    if (!frames.length && fallbackMap[state]) {
      const fallback = fallbackMap[state];
      const fallbackDirectory = path.join(entityDirectory, fallback);
      if (!availableStates.has(fallback) || !frameEntries(fallbackDirectory).length) {
        issue(errors, "invalid-state-fallback", subject,
          `O fallback '${state}' → '${fallback}' não aponta para um estado com frames.`,
          { state, fallback });
      } else {
        issue(warnings, "state-uses-fallback", subject,
          `O estado '${state}' usa o fallback '${fallback}'.`, { state, fallback });
        await validateFrameSequence(fallbackDirectory, `${subject}:${fallback}`);
      }
      continue;
    }
    await validateFrameSequence(stateDirectory, `${subject}:${state}`);
  }

  for (const [state, fallback] of Object.entries(fallbackMap)) {
    if (typeof fallback !== "string" || !availableStates.has(fallback)
      || !frameEntries(path.join(entityDirectory, fallback)).length) {
      issue(errors, "invalid-state-fallback", subject,
        `O fallback '${state}' → '${String(fallback)}' é inválido.`, { state, fallback });
    }
  }

  const previewState = config.previewState
    || (kind === "troop" && spriteKey === "muralhaReforcada" ? "defense" : "idle");
  const preview = path.join(entityDirectory, previewState, "frame0.png");
  if (!fs.existsSync(preview)) {
    issue(errors, "preview-frame-missing", subject,
      `O previewState '${previewState}' não possui frame0.png.`,
      { file: path.relative(repoRoot, preview) });
  } else {
    await decodePng(preview, `${subject}:preview`);
  }
}

function appendDependencyValues(value, destination, visited = new WeakSet()) {
  if (typeof value === "string") {
    destination.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => appendDependencyValues(entry, destination, visited));
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  for (const [key, entry] of Object.entries(value)) {
    if (["id", "type", "effectId", "assetEffectId", "required"].includes(key)) {
      appendDependencyValues(entry, destination, visited);
    } else if (typeof entry === "object") {
      appendDependencyValues(entry, destination, visited);
    }
  }
}

async function validateEffects() {
  const effects = new Set();
  Object.values(ENEMIES).forEach((enemy) => appendDependencyValues(enemy.effectDependencies, effects));
  PHASES.forEach((phase) => appendDependencyValues(phase.effectAssetDependencies, effects));

  for (const effectId of [...effects].sort()) {
    const effectDirectory = path.join(EFFECT_ROOT, effectId);
    const subject = `effect:${effectId}`;
    if (!fs.existsSync(effectDirectory)) {
      issue(errors, "effect-folder-missing", subject,
        "A dependência de efeito declarada não possui pasta.",
        { directory: path.relative(repoRoot, effectDirectory) });
      continue;
    }
    const states = directories(effectDirectory);
    if (!states.length) {
      issue(errors, "effect-without-states", subject,
        "A pasta do efeito não possui estados.",
        { directory: path.relative(repoRoot, effectDirectory) });
      continue;
    }
    for (const state of states) {
      await validateFrameSequence(
        path.join(effectDirectory, state),
        `${subject}:${state}`,
      );
    }
  }
  return effects;
}

async function validateArenas() {
  for (const phase of PHASES) {
    const arena = path.join(ARENA_ROOT, `${phase.arenaId}.webp`);
    if (!fs.existsSync(arena)) {
      issue(errors, "arena-missing", `phase:${phase.id}`,
        `A arena '${phase.arenaId}' não existe.`,
        { file: path.relative(repoRoot, arena) });
      continue;
    }
    try {
      const metadata = await sharp(arena, { failOn: "error" }).metadata();
      if (metadata.format !== "webp" || !metadata.width || !metadata.height) {
        issue(errors, "invalid-arena", `phase:${phase.id}`,
          "A arena não possui metadados WebP válidos.",
          { file: path.relative(repoRoot, arena) });
      }
    } catch (error) {
      issue(errors, "arena-decode-failed", `phase:${phase.id}`,
        `O Sharp não conseguiu decodificar a arena: ${error.message}`,
        { file: path.relative(repoRoot, arena) });
    }
  }
}

for (const [id, troop] of Object.entries(TROOPS)) {
  await validateEntity("troop", id, troop);
}
for (const [id, enemy] of Object.entries(ENEMIES)) {
  await validateEntity("enemy", id, enemy);
}
const effects = await validateEffects();
await validateArenas();

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  options: { skipDecode },
  stats: {
    troops: Object.keys(TROOPS).length,
    enemies: Object.keys(ENEMIES).length,
    effects: effects.size,
    phases: PHASES.length,
    decodedFiles: decodedFiles.size,
    validatedStates: validatedStates.size,
  },
  errors,
  warnings,
};

if (jsonOutput) {
  fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
  fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (warnings.length) {
  console.warn(`Manifesto de assets: ${warnings.length} aviso(s).`);
  warnings.forEach((entry) => console.warn(`- [${entry.code}] ${entry.subject}: ${entry.message}`));
}
if (errors.length) {
  console.error(`Manifesto de assets inválido: ${errors.length} erro(s).`);
  errors.forEach((entry) => console.error(`- [${entry.code}] ${entry.subject}: ${entry.message}`));
  process.exitCode = 1;
} else {
  console.log(
    `Manifesto de assets válido: ${report.stats.troops} tropas, `
    + `${report.stats.enemies} inimigos, ${report.stats.effects} efeitos e `
    + `${report.stats.decodedFiles} arquivos decodificados.`,
  );
}
