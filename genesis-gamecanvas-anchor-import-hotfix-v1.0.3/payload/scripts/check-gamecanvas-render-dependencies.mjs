#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findNamedImport } from "./gamecanvas-import-tools.mjs";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const gameCanvasPath = path.join(repoRoot, "src", "game", "GameCanvas.jsx");
const visualGeometryPath = path.join(repoRoot, "src", "game", "visualGeometry.js");
const errors = [];

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} não foi encontrado: ${filePath}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

const gameCanvasSource = requireFile(gameCanvasPath, "GameCanvas.jsx");
requireFile(visualGeometryPath, "visualGeometry.js");

if (gameCanvasSource) {
  let reactImport = null;
  let geometryImport = null;

  try {
    reactImport = findNamedImport(gameCanvasSource, "react");
    geometryImport = findNamedImport(
      gameCanvasSource,
      "./visualGeometry.js",
    );
  } catch (error) {
    errors.push(error.message);
  }

  if (!reactImport) {
    errors.push('Import nomeado de "react" ausente.');
  }

  if (!geometryImport) {
    errors.push('Import nomeado de "./visualGeometry.js" ausente.');
  }

  if (reactImport?.symbols.includes("getAnchoredSpriteRect")) {
    errors.push(
      "getAnchoredSpriteRect foi importada incorretamente de react.",
    );
  }

  if (!geometryImport?.symbols.includes("getAnchoredSpriteRect")) {
    errors.push(
      "getAnchoredSpriteRect não foi importada de ./visualGeometry.js.",
    );
  }

  const geometryOccurrences = geometryImport?.symbols.filter(
    (symbol) => symbol === "getAnchoredSpriteRect",
  ).length || 0;

  if (geometryOccurrences !== 1) {
    errors.push(
      "getAnchoredSpriteRect deve aparecer exatamente uma vez no import de visualGeometry.js.",
    );
  }

  if (!gameCanvasSource.includes("getAnchoredSpriteRect(")) {
    errors.push(
      "GameCanvas.jsx não contém o uso esperado de getAnchoredSpriteRect.",
    );
  }
}

if (!errors.length) {
  try {
    const visualGeometry = await import(
      pathToFileURL(visualGeometryPath).href
        + `?validation=${Date.now()}`
    );

    if (typeof visualGeometry.getAnchoredSpriteRect !== "function") {
      errors.push(
        "visualGeometry.js não exporta getAnchoredSpriteRect como função.",
      );
    } else {
      const rect = visualGeometry.getAnchoredSpriteRect(
        { x: 100, y: 120 },
        80,
        2,
        { x: 0.5, y: 1 },
      );

      if (
        !rect
        || !Number.isFinite(rect.x)
        || !Number.isFinite(rect.y)
        || rect.width !== 160
        || rect.height !== 80
      ) {
        errors.push(
          "getAnchoredSpriteRect retornou uma geometria inválida.",
        );
      }
    }
  } catch (error) {
    errors.push(
      `Falha ao importar visualGeometry.js: ${error.message}`,
    );
  }
}

if (errors.length) {
  console.error(
    `Dependências do GameCanvas inválidas: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    "GameCanvas importa getAnchoredSpriteRect do módulo correto e a exportação é executável.",
  );
}
