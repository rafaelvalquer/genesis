#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(
  fileURLToPath(import.meta.url),
);
const payloadRoot = path.join(packageRoot, "payload");
const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

class PatchError extends Error {}

function read(relativePath) {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

function write(relativePath, content) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function copyPayload(relativePath) {
  const source = path.join(payloadRoot, relativePath);
  const destination = path.join(repoRoot, relativePath);

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );
  fs.copyFileSync(source, destination);
}

function patchGameCanvas() {
  const relativePath = "src/game/GameCanvas.jsx";
  let source = read(relativePath);

  const importPattern = (
    /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\/visualGeometry\.js["'];?/
  );

  const match = importPattern.exec(source);

  if (!match) {
    throw new PatchError(
      "O import de visualGeometry.js não foi encontrado em GameCanvas.jsx.",
    );
  }

  const symbols = match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!symbols.includes("getAnchoredSpriteRect")) {
    symbols.unshift("getAnchoredSpriteRect");
  }

  const formattedImport = (
    "import {\n"
    + symbols
      .map((symbol) => `  ${symbol},`)
      .join("\n")
    + '\n} from "./visualGeometry.js";'
  );

  source = source.replace(
    importPattern,
    formattedImport,
  );

  write(relativePath, source);
}

function patchPackageJson() {
  const packageJson = JSON.parse(
    read("package.json"),
  );

  packageJson.scripts ||= {};

  packageJson.scripts[
    "verify:gamecanvas-render-dependencies"
  ] = (
    "node scripts/check-gamecanvas-render-dependencies.mjs"
  );

  const ci = packageJson.scripts.ci || "";

  if (
    ci
    && !ci.includes(
      "verify:gamecanvas-render-dependencies",
    )
  ) {
    if (ci.includes("npm run test")) {
      packageJson.scripts.ci = ci.replace(
        "npm run test",
        "npm run verify:gamecanvas-render-dependencies && npm run test",
      );
    } else {
      packageJson.scripts.ci = (
        "npm run verify:gamecanvas-render-dependencies"
        + ` && ${ci}`
      );
    }
  }

  write(
    "package.json",
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
}

function assertRepository() {
  const required = [
    "package.json",
    "src/game/GameCanvas.jsx",
    "src/game/visualGeometry.js",
  ];

  const missing = required.filter(
    (relativePath) => !fs.existsSync(
      path.join(repoRoot, relativePath),
    ),
  );

  if (missing.length) {
    throw new PatchError(
      "Estrutura esperada não encontrada:\n"
      + missing.join("\n"),
    );
  }
}

function main() {
  assertRepository();
  patchGameCanvas();
  patchPackageJson();

  copyPayload(
    "scripts/check-gamecanvas-render-dependencies.mjs",
  );
  copyPayload(
    "src/game/GameCanvasRenderDependencies.test.js",
  );

  console.log("Correção aplicada:");
  console.log("- getAnchoredSpriteRect importado em GameCanvas.jsx");
  console.log("- validação estática adicionada ao CI");
  console.log("- teste de regressão adicionado");
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
