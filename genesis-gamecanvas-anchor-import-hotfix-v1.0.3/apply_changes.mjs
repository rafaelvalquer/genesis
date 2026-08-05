#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findNamedImport,
  replaceNamedImport,
} from "./payload/scripts/gamecanvas-import-tools.mjs";

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

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

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

  const reactImport = findNamedImport(source, "react");
  const geometryImport = findNamedImport(
    source,
    "./visualGeometry.js",
  );

  if (!reactImport) {
    throw new PatchError(
      'O import nomeado de "react" não foi encontrado.',
    );
  }

  if (!geometryImport) {
    throw new PatchError(
      'O import nomeado de "./visualGeometry.js" não foi encontrado.',
    );
  }

  source = replaceNamedImport(
    source,
    "react",
    (symbols) => symbols.filter(
      (symbol) => symbol !== "getAnchoredSpriteRect",
    ),
  );

  source = replaceNamedImport(
    source,
    "./visualGeometry.js",
    (symbols) => [
      "getAnchoredSpriteRect",
      ...symbols.filter(
        (symbol) => symbol !== "getAnchoredSpriteRect",
      ),
    ],
  );

  const updatedReactImport = findNamedImport(
    source,
    "react",
  );

  const updatedGeometryImport = findNamedImport(
    source,
    "./visualGeometry.js",
  );

  if (
    updatedReactImport.symbols.includes(
      "getAnchoredSpriteRect",
    )
  ) {
    throw new PatchError(
      "getAnchoredSpriteRect permaneceu no import de react.",
    );
  }

  const occurrences = updatedGeometryImport.symbols.filter(
    (symbol) => symbol === "getAnchoredSpriteRect",
  ).length;

  if (occurrences !== 1) {
    throw new PatchError(
      "getAnchoredSpriteRect não foi adicionada corretamente ao import de visualGeometry.js.",
    );
  }

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
    "scripts/gamecanvas-import-tools.mjs",
  );

  copyPayload(
    "scripts/check-gamecanvas-render-dependencies.mjs",
  );

  copyPayload(
    "src/game/GameCanvasRenderDependencies.test.js",
  );

  console.log("Correção aplicada:");
  console.log(
    "- getAnchoredSpriteRect removida do import de react",
  );
  console.log(
    "- getAnchoredSpriteRect adicionada ao import de visualGeometry.js",
  );
  console.log(
    "- verificador anterior substituído por análise de imports isolados",
  );
  console.log(
    "- teste de regressão atualizado para validar origem e tipo",
  );
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
