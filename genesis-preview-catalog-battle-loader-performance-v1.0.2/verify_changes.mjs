#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

let failed = false;

function requireFile(relativePath) {
  const filePath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERRO] Arquivo ausente: ${relativePath}`);
    failed = true;
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

const gameCanvas = requireFile(
  "src/game/GameCanvas.jsx",
);

const importMatch = (
  /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\/visualGeometry\.js["'];?/
    .exec(gameCanvas)
);

if (!importMatch) {
  console.error(
    "[ERRO] Import de visualGeometry.js ausente.",
  );
  failed = true;
} else {
  const symbols = importMatch[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const count = symbols.filter(
    (symbol) => symbol === "getAnchoredSpriteRect",
  ).length;

  if (count !== 1) {
    console.error(
      "[ERRO] getAnchoredSpriteRect deve ser importado exatamente uma vez.",
    );
    failed = true;
  }
}

if (!gameCanvas.includes("getAnchoredSpriteRect(")) {
  console.error(
    "[ERRO] O uso de getAnchoredSpriteRect não foi encontrado.",
  );
  failed = true;
}

requireFile(
  "scripts/check-gamecanvas-render-dependencies.mjs",
);
requireFile(
  "src/game/GameCanvasRenderDependencies.test.js",
);

const packageJson = JSON.parse(
  requireFile("package.json"),
);

if (
  !packageJson.scripts?.[
    "verify:gamecanvas-render-dependencies"
  ]
) {
  console.error(
    "[ERRO] Script de verificação não registrado no package.json.",
  );
  failed = true;
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Verificação estrutural concluída com sucesso.",
  );
}
