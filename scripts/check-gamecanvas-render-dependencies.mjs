#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const gameCanvasPath = path.join(
  repoRoot,
  "src",
  "game",
  "GameCanvas.jsx",
);

if (!fs.existsSync(gameCanvasPath)) {
  console.error(
    "[ERRO] src/game/GameCanvas.jsx não foi encontrado.",
  );
  process.exitCode = 1;
} else {
  const source = fs.readFileSync(gameCanvasPath, "utf8");

  const visualGeometryImport = (
    /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\/visualGeometry\.js["'];?/
      .exec(source)
  );

  if (!visualGeometryImport) {
    console.error(
      "[ERRO] O import de visualGeometry.js não foi encontrado em GameCanvas.jsx.",
    );
    process.exitCode = 1;
  } else {
    const importedSymbols = new Set(
      visualGeometryImport[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

    const requiredRuntimeSymbols = [
      "getAnchoredSpriteRect",
    ];

    const missing = requiredRuntimeSymbols.filter(
      (symbol) => (
        source.includes(`${symbol}(`)
        && !importedSymbols.has(symbol)
      ),
    );

    if (missing.length) {
      console.error(
        "[ERRO] GameCanvas.jsx usa símbolos de geometria sem importá-los:",
      );

      missing.forEach((symbol) => {
        console.error(`- ${symbol}`);
      });

      process.exitCode = 1;
    } else {
      console.log(
        "Dependências de geometria do GameCanvas validadas.",
      );
    }
  }
}
