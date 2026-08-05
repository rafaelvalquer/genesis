#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  findNamedImport,
} from "./payload/scripts/gamecanvas-import-tools.mjs";

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

if (gameCanvas) {
  try {
    const reactImport = findNamedImport(
      gameCanvas,
      "react",
    );

    const geometryImport = findNamedImport(
      gameCanvas,
      "./visualGeometry.js",
    );

    if (!reactImport) {
      console.error(
        '[ERRO] Import nomeado de "react" ausente.',
      );
      failed = true;
    }

    if (!geometryImport) {
      console.error(
        '[ERRO] Import nomeado de "./visualGeometry.js" ausente.',
      );
      failed = true;
    }

    if (
      reactImport?.symbols.includes(
        "getAnchoredSpriteRect",
      )
    ) {
      console.error(
        "[ERRO] getAnchoredSpriteRect ainda está sendo importada de react.",
      );
      failed = true;
    }

    const count = geometryImport?.symbols.filter(
      (symbol) => symbol === "getAnchoredSpriteRect",
    ).length || 0;

    if (count !== 1) {
      console.error(
        "[ERRO] getAnchoredSpriteRect deve ser importada exatamente uma vez de visualGeometry.js.",
      );
      failed = true;
    }
  } catch (error) {
    console.error(`[ERRO] ${error.message}`);
    failed = true;
  }
}

requireFile(
  "scripts/gamecanvas-import-tools.mjs",
);
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
    "[ERRO] Script de verificação ausente no package.json.",
  );
  failed = true;
}

if (!failed) {
  const checker = path.join(
    repoRoot,
    "scripts",
    "check-gamecanvas-render-dependencies.mjs",
  );

  const result = spawnSync(
    process.execPath,
    [checker, repoRoot],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Verificação estrutural e executável concluída com sucesso.",
  );
}
