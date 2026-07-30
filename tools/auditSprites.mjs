#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { TROOPS } from "../src/game/content.js";

export const DEFAULT_THRESHOLDS = Object.freeze({
  minOccupancy: 0.65,
  maxOccupancy: 0.94,
  footTolerance: 4,
  lowColorCount: 32,
  displayResolutionFactor: 2.16,
});

const FRAME_PATTERN = /^frame(\d+)\.png$/i;

function maxDisplayHeight(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  let maximum = Number.isFinite(value.height) ? value.height : 0;
  for (const child of Object.values(value)) {
    maximum = Math.max(maximum, maxDisplayHeight(child, seen));
  }
  return maximum;
}

function classify(issues) {
  if (issues.some((issue) => issue.level === "error")) return "error";
  if (issues.length) return "warning";
  return "ok";
}

export async function auditSpriteFile(filePath, thresholds = DEFAULT_THRESHOLDS) {
  const input = sharp(filePath, { failOn: "error" });
  const metadata = await input.metadata();
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  let opaquePixels = 0;
  let transparentPixels = 0;
  const colors = new Set();
  const sampleStride = Math.max(1, Math.floor((info.width * info.height) / 65536));
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * info.channels;
    const alpha = data[offset + 3];
    if (alpha < 255) transparentPixels += 1;
    if (alpha === 0) continue;
    opaquePixels += 1;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    if (pixel % sampleStride === 0 && colors.size <= 65536) {
      colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]},${alpha}`);
    }
  }
  const empty = right < left || bottom < top;
  const bbox = empty
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1, right, bottom };
  const occupancy = empty ? 0 : (bbox.width * bbox.height) / (info.width * info.height);
  const issues = [];
  if (empty) issues.push({ level: "error", code: "EMPTY_FRAME", message: "Frame totalmente vazio." });
  if (!metadata.hasAlpha) issues.push({ level: "error", code: "NO_TRANSPARENCY", message: "PNG sem canal alfa." });
  else if (transparentPixels === 0) issues.push({ level: "error", code: "NO_TRANSPARENT_PIXELS", message: "Canal alfa existe, mas o frame é totalmente opaco." });
  if (metadata.isPalette) issues.push({ level: "warning", code: "INDEXED_PNG", message: "PNG usa paleta indexada." });
  if (/^(char|uchar|ushort)$/.test(metadata.depth || "") === false) {
    issues.push({ level: "warning", code: "LOW_BIT_DEPTH", message: `Profundidade incomum: ${metadata.depth || "desconhecida"}.` });
  }
  if (!empty && colors.size < thresholds.lowColorCount) {
    issues.push({ level: "warning", code: "LOW_COLOR_COUNT", message: `Apenas ~${colors.size} cores na amostra.` });
  }
  if (!empty && occupancy < thresholds.minOccupancy) {
    issues.push({ level: "warning", code: "LOW_OCCUPANCY", message: `Personagem ocupa ${(occupancy * 100).toFixed(1)}% do frame.` });
  }
  if (!empty && occupancy > thresholds.maxOccupancy) {
    issues.push({ level: "warning", code: "HIGH_OCCUPANCY", message: `Personagem ocupa ${(occupancy * 100).toFixed(1)}% do frame.` });
  }
  const stat = await fs.stat(filePath);
  return {
    file: filePath,
    name: path.basename(filePath),
    frame: FRAME_PATTERN.test(path.basename(filePath))
      ? Number(FRAME_PATTERN.exec(path.basename(filePath))[1])
      : null,
    width: metadata.width,
    height: metadata.height,
    aspectRatio: metadata.width / metadata.height,
    colorSpace: metadata.space,
    depth: metadata.depth,
    bitsPerSample: metadata.bitsPerSample,
    indexed: Boolean(metadata.isPalette),
    hasAlpha: Boolean(metadata.hasAlpha),
    fileSize: stat.size,
    approximateColors: colors.size,
    opaquePixels,
    transparentPixels,
    occupancy,
    bbox,
    margins: bbox ? {
      top: bbox.y,
      right: metadata.width - bbox.right - 1,
      bottom: metadata.height - bbox.bottom - 1,
      left: bbox.x,
    } : null,
    issues,
    classification: classify(issues),
  };
}

async function pngFiles(root) {
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) files.push(target);
    }
  }
  await visit(root);
  return files.sort();
}

function stateIssues(frames, displayHeight, thresholds) {
  const issues = [];
  const invalid = frames.filter((frame) => frame.frame == null);
  if (invalid.length) issues.push({ level: "error", code: "INVALID_NAME", message: `${invalid.length} arquivo(s) fora do padrão frameN.png.` });
  const indices = frames.map((frame) => frame.frame).filter(Number.isFinite).sort((a, b) => a - b);
  const missing = [];
  for (let frame = 0; frame <= (indices.at(-1) ?? -1); frame += 1) {
    if (!indices.includes(frame)) missing.push(frame);
  }
  if (missing.length) issues.push({ level: "error", code: "FRAME_GAPS", message: `Frames ausentes: ${missing.join(", ")}.` });
  const dimensions = new Set(frames.map((frame) => `${frame.width}x${frame.height}`));
  if (dimensions.size > 1) issues.push({ level: "error", code: "DIMENSION_MISMATCH", message: "Dimensões inconsistentes no estado." });
  const usefulHeights = frames.map((frame) => frame.bbox?.height || 0);
  const requiredHeight = displayHeight * thresholds.displayResolutionFactor;
  if (displayHeight > 0 && Math.min(...usefulHeights) < requiredHeight) {
    issues.push({
      level: "warning",
      code: "LOW_USEFUL_RESOLUTION",
      message: `Altura útil mínima ${Math.min(...usefulHeights)}px; recomendado ${requiredHeight.toFixed(0)}px.`,
    });
  }
  const feet = frames.map((frame) => frame.bbox?.bottom).filter(Number.isFinite);
  const footVariation = feet.length ? Math.max(...feet) - Math.min(...feet) : 0;
  if (footVariation > thresholds.footTolerance) {
    issues.push({ level: "warning", code: "FOOT_DRIFT", message: `Ponto de apoio varia ${footVariation}px.` });
  }
  const centersX = frames.map((frame) => frame.bbox ? frame.bbox.x + frame.bbox.width / 2 : 0);
  const centersY = frames.map((frame) => frame.bbox ? frame.bbox.y + frame.bbox.height / 2 : 0);
  const widths = frames.map((frame) => frame.bbox?.width || 0);
  const heights = frames.map((frame) => frame.bbox?.height || 0);
  const variation = (values) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  return {
    issues,
    missingFrames: missing,
    dimensionVariants: [...dimensions],
    bboxVariation: { width: variation(widths), height: variation(heights) },
    horizontalShift: variation(centersX),
    verticalShift: variation(centersY),
    apparentScaleVariation: Math.max(
      variation(widths) / Math.max(1, Math.max(...widths)),
      variation(heights) / Math.max(1, Math.max(...heights)),
    ),
    footVariation,
    requiredUsefulHeight: requiredHeight,
  };
}

export async function auditSpriteRoots({
  roots,
  outputJson,
  outputMarkdown,
  thresholds = DEFAULT_THRESHOLDS,
  displayHeights = {},
} = {}) {
  const selectedRoots = roots || [path.resolve("src/game/assets/troop")];
  const files = (await Promise.all(selectedRoots.map(pngFiles))).flat();
  const groups = new Map();
  for (const file of files) {
    const root = selectedRoots.find((candidate) => path.resolve(file).startsWith(`${path.resolve(candidate)}${path.sep}`));
    const relative = path.relative(root, file).split(path.sep);
    const entity = relative[0] || "unknown";
    const state = relative.at(-2) || "unknown";
    const key = `${entity}/${state}`;
    if (!groups.has(key)) groups.set(key, { entity, state, files: [] });
    groups.get(key).files.push(file);
  }
  const states = [];
  for (const group of groups.values()) {
    const frames = [];
    for (const file of group.files) frames.push(await auditSpriteFile(file, thresholds));
    const aggregate = stateIssues(frames, displayHeights[group.entity] || 0, thresholds);
    const issues = [...aggregate.issues, ...frames.flatMap((frame) => frame.issues)];
    states.push({
      entity: group.entity,
      state: group.state,
      frameCount: frames.length,
      frames,
      ...aggregate,
      classification: classify(issues),
    });
  }
  states.sort((left, right) => `${left.entity}/${left.state}`.localeCompare(`${right.entity}/${right.state}`));
  const summary = {
    files: files.length,
    states: states.length,
    ok: states.filter((state) => state.classification === "ok").length,
    warnings: states.filter((state) => state.classification === "warning").length,
    errors: states.filter((state) => state.classification === "error").length,
  };
  const report = { generatedAt: new Date().toISOString(), thresholds, summary, states };
  if (outputJson) await fs.writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (outputMarkdown) {
    const rows = states.map((state) => `| ${state.entity} | ${state.state} | ${state.frameCount} | ${state.classification.toUpperCase()} |`).join("\n");
    await fs.writeFile(outputMarkdown, `# Sprite audit\n\n| Entidade | Estado | Frames | Status |\n|---|---:|---:|---|\n${rows}\n`, "utf8");
  }
  return report;
}

function configuredDisplayHeights() {
  return Object.fromEntries(Object.entries(TROOPS).map(([id, config]) => [config.spriteKey || id, maxDisplayHeight(config)]));
}

async function main() {
  const includeEnemies = process.argv.includes("--enemy");
  const roots = [path.resolve("src/game/assets/troop")];
  if (includeEnemies) roots.push(path.resolve("src/game/assets/enemy"));
  const report = await auditSpriteRoots({
    roots,
    displayHeights: configuredDisplayHeights(),
    outputJson: path.resolve("sprite-audit-report.json"),
    outputMarkdown: path.resolve("sprite-audit-report.md"),
  });
  console.table(report.states.map(({ entity, state, frameCount, classification }) => ({
    entity, state, frames: frameCount, status: classification,
  })));
  console.log(`Sprites: ${report.summary.files}; estados: ${report.summary.states}; OK: ${report.summary.ok}; avisos: ${report.summary.warnings}; erros: ${report.summary.errors}.`);
  process.exitCode = report.summary.errors > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await main();
}
