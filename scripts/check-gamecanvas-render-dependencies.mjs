#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findNamedImport } from "./gamecanvas-import-tools.mjs";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const facadePath = path.join(repoRoot, "src", "game", "GameCanvas.jsx");
const battleScreenPath = path.join(repoRoot, "src", "game", "BattleScreen.jsx");
const entityRendererPath = path.join(repoRoot, "src", "game", "render", "entityRenderer.js");
const visualGeometryPath = path.join(repoRoot, "src", "game", "visualGeometry.js");
const errors = [];

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} não foi encontrado: ${filePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

const facadeSource = requireFile(facadePath, "GameCanvas.jsx");
const screenSource = requireFile(battleScreenPath, "BattleScreen.jsx");
const entitySource = requireFile(entityRendererPath, "entityRenderer.js");
requireFile(visualGeometryPath, "visualGeometry.js");

if (facadeSource) {
  if (!facadeSource.includes('export { BattleScreen as default } from "./BattleScreen.jsx";')) {
    errors.push("GameCanvas.jsx não preserva a façade default para BattleScreen.");
  }
  if (facadeSource.includes("getAnchoredSpriteRect")) {
    errors.push("GameCanvas.jsx voltou a conhecer geometria de sprite.");
  }
}

if (screenSource) {
  if (!screenSource.includes('from "./render/battleFrameRenderer.js"')) {
    errors.push("BattleScreen.jsx não delega o frame ao battleFrameRenderer.");
  }
  for (const forbidden of [
    'from "./render/battleLayerRenderers.js"',
    'from "./chapter07/forestObstacleRenderer.js"',
    'from "./chapter07/convoyRenderer.js"',
    'from "./render/entityRenderer.js"',
    "getAnchoredSpriteRect",
  ]) {
    if (screenSource.includes(forbidden)) {
      errors.push(`BattleScreen.jsx contém dependência visual concreta proibida: ${forbidden}`);
    }
  }
}

if (entitySource) {
  let geometryImport = null;
  try {
    geometryImport = findNamedImport(entitySource, "../visualGeometry.js");
  } catch (error) {
    errors.push(error.message);
  }
  if (!geometryImport?.symbols.includes("getAnchoredSpriteRect")) {
    errors.push("entityRenderer.js não importa getAnchoredSpriteRect de ../visualGeometry.js.");
  }
  const occurrences = geometryImport?.symbols.filter((symbol) => symbol === "getAnchoredSpriteRect").length || 0;
  if (occurrences !== 1) {
    errors.push("getAnchoredSpriteRect deve aparecer exatamente uma vez no import de entityRenderer.js.");
  }
}

if (!errors.length) {
  try {
    const visualGeometry = await import(`${pathToFileURL(visualGeometryPath).href}?validation=${Date.now()}`);
    if (typeof visualGeometry.getAnchoredSpriteRect !== "function") {
      errors.push("visualGeometry.js não exporta getAnchoredSpriteRect como função.");
    } else {
      const rect = visualGeometry.getAnchoredSpriteRect(
        { x: 100, y: 120 },
        80,
        2,
        { x: 0.5, y: 1 },
      );
      if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || rect.width !== 160 || rect.height !== 80) {
        errors.push("getAnchoredSpriteRect retornou uma geometria inválida.");
      }
    }
  } catch (error) {
    errors.push(`Falha ao importar visualGeometry.js: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`Dependências da tela/render inválidas: ${errors.length} erro(s).`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("BattleScreen delega render concreto e a façade GameCanvas permanece compatível.");
}
