#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

const errors = [];

function read(relativePath) {
  const filePath = path.join(
    repoRoot,
    relativePath,
  );

  if (!fs.existsSync(filePath)) {
    errors.push(
      `Arquivo obrigatório ausente: ${relativePath}`,
    );
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

const hookSource = read(
  "src/game/hooks/useBattleAssets.js",
);

const loaderSource = read(
  "src/game/assets/battleAssetLoader.js",
);

const canvasSource = read(
  "src/game/GameCanvas.jsx",
);

const eventSource = read(
  "src/game/hooks/battleCanvasEvents.js",
);

if (
  !hookSource.includes(
    'progress.phase === "deferred"',
  )
) {
  errors.push(
    "useBattleAssets.js não separa progresso crítico de progresso adiado.",
  );
}

if (
  !hookSource.includes(
    "ready: true",
  )
  || !hookSource.includes(
    "deferredPercent",
  )
) {
  errors.push(
    "useBattleAssets.js não preserva a prontidão durante o carregamento adiado.",
  );
}

const deferredBranch = (
  hookSource.match(
    /if\s*\(\s*progress\.phase\s*===\s*"deferred"\s*\)\s*\{([\s\S]*?)\n\s*\}/,
  )?.[1]
  || ""
);

if (
  deferredBranch.includes(
    "ready: false",
  )
) {
  errors.push(
    "O ramo deferred ainda redefine ready para false.",
  );
}

if (
  !loaderSource.includes(
    'phase: "critical"',
  )
  || !loaderSource.includes(
    'phase: "deferred"',
  )
) {
  errors.push(
    "battleAssetLoader.js não identifica as duas fases de progresso.",
  );
}

if (
  !canvasSource.includes(
    "installNonPassiveContextMenuGuard",
  )
) {
  errors.push(
    "GameCanvas.jsx não instala o bloqueio nativo de contextmenu.",
  );
}

const contextMenuHandler = (
  /const handleCanvasContextMenu\s*=\s*\(event\)\s*=>\s*\{([\s\S]*?)\n\s*\};/
    .exec(canvasSource)?.[1]
  || ""
);

if (
  contextMenuHandler.includes(
    "preventDefault",
  )
) {
  errors.push(
    "O handler React de contextmenu ainda chama preventDefault.",
  );
}

if (
  !eventSource.includes(
    'passive: false',
  )
  || !eventSource.includes(
    'addEventListener(\n    "contextmenu"',
  )
) {
  errors.push(
    "battleCanvasEvents.js não registra contextmenu como não passivo.",
  );
}

const packageJsonSource = read("package.json");

if (packageJsonSource) {
  const packageJson = JSON.parse(
    packageJsonSource,
  );

  if (
    !packageJson.scripts?.[
      "verify:battle-loading"
    ]
  ) {
    errors.push(
      "Script verify:battle-loading ausente no package.json.",
    );
  }
}

if (errors.length) {
  console.error(
    `Contrato de carregamento inválido: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else {
  console.log(
    "Carregamento crítico, assets adiados e eventos do canvas estão isolados corretamente.",
  );
}
