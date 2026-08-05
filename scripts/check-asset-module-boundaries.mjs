#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const srcRoot = path.join(repoRoot, "src");

const errors = [];
const warnings = [];

const sourceExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

function normalize(relativePath) {
  return relativePath.replaceAll(path.sep, "/");
}

function collectFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;

  for (const entry of fs.readdirSync(
    directory,
    { withFileTypes: true },
  )) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      collectFiles(fullPath, result);
      continue;
    }

    if (
      sourceExtensions.has(
        path.extname(entry.name),
      )
    ) {
      result.push(fullPath);
    }
  }

  return result;
}

function read(relativePath) {
  const fullPath = path.join(
    repoRoot,
    relativePath,
  );

  if (!fs.existsSync(fullPath)) {
    errors.push(
      `Arquivo obrigatório ausente: ${relativePath}`,
    );
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

const importFromFacadePattern = (
  /(?:import|export)\s*\{[^}]*\}\s*from\s*["'][^"']*assetCatalog\.js["']/g
);

for (const filePath of collectFiles(srcRoot)) {
  const relativePath = normalize(
    path.relative(repoRoot, filePath),
  );

  if (
    relativePath
      === "src/game/assetCatalog.js"
  ) {
    continue;
  }

  const source = fs.readFileSync(
    filePath,
    "utf8",
  );

  if (importFromFacadePattern.test(source)) {
    errors.push(
      `${relativePath} ainda importa o facade assetCatalog.js.`,
    );
  }

  importFromFacadePattern.lastIndex = 0;
}

const appSource = read("src/App.jsx");

if (
  appSource.includes("assetCatalog.js")
  || appSource.includes(
    "battleAssetLoader.js",
  )
) {
  errors.push(
    "src/App.jsx não pode importar o facade nem o loader de batalha.",
  );
}

const battleSource = read(
  "src/game/assets/battleAssetLoader.js",
);

for (const forbidden of [
  "frame0.png",
  "./arenas/",
  "./enemy/concepts/",
]) {
  if (battleSource.includes(forbidden)) {
    errors.push(
      `battleAssetLoader.js contém catálogo de preview/arena: ${forbidden}`,
    );
  }
}

for (const required of [
  "./troop/**/*.png",
  "./enemy/**/*.png",
  "./defense/**/*.png",
  "./effects/**/*.png",
]) {
  if (!battleSource.includes(required)) {
    errors.push(
      `battleAssetLoader.js não registra ${required}`,
    );
  }
}

const staticTroopPreviewSource = read(
  "src/game/assets/troopPreviewCatalog.js",
);

if (
  staticTroopPreviewSource.includes(
    "./troop/**/*.png",
  )
) {
  errors.push(
    "troopPreviewCatalog.js não deve registrar todos os frames.",
  );
}

if (
  !staticTroopPreviewSource.includes(
    "frame0.png",
  )
) {
  errors.push(
    "troopPreviewCatalog.js deve registrar apenas previews frame0.",
  );
}

const animatedTroopPreviewSource = read(
  "src/game/assets/troopPreviewAnimationCatalog.js",
);

if (
  !animatedTroopPreviewSource.includes(
    "./troop/**/*.png",
  )
) {
  errors.push(
    "troopPreviewAnimationCatalog.js deve registrar os frames animados.",
  );
}

const enemyPreviewSource = read(
  "src/game/assets/enemyPreviewCatalog.js",
);

if (
  !enemyPreviewSource.includes(
    "frame0.png",
  )
) {
  errors.push(
    "enemyPreviewCatalog.js deve registrar previews frame0.",
  );
}

if (
  enemyPreviewSource.includes(
    "./enemy/**/*.png",
  )
) {
  errors.push(
    "enemyPreviewCatalog.js não deve registrar todos os frames de batalha.",
  );
}

const facadeSource = read(
  "src/game/assetCatalog.js",
);

if (facadeSource.includes("import.meta.glob")) {
  errors.push(
    "O facade assetCatalog.js não deve registrar assets.",
  );
}

for (const requiredModule of [
  "arenaCatalog.js",
  "enemyPreviewCatalog.js",
  "troopPreviewCatalog.js",
  "troopPreviewAnimationCatalog.js",
  "assetDependencyResolver.js",
  "battleAssetLoader.js",
]) {
  if (!facadeSource.includes(requiredModule)) {
    errors.push(
      `O facade não reexporta ${requiredModule}.`,
    );
  }
}

const packageJsonPath = path.join(
  repoRoot,
  "package.json",
);

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(
    fs.readFileSync(
      packageJsonPath,
      "utf8",
    ),
  );

  if (
    !packageJson.scripts?.[
      "verify:asset-boundaries"
    ]
  ) {
    errors.push(
      "Script verify:asset-boundaries ausente no package.json.",
    );
  }
}

if (warnings.length) {
  console.warn(
    `Limites de assets: ${warnings.length} aviso(s).`,
  );

  warnings.forEach((warning) => {
    console.warn(`- ${warning}`);
  });
}

if (errors.length) {
  console.error(
    `Limites de assets inválidos: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else {
  console.log(
    "Catálogos de preview e loader de batalha estão isolados.",
  );
}
