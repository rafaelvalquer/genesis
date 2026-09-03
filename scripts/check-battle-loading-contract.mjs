#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const errors = [];

function read(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Arquivo obrigatório ausente: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

const hookSource = read("src/game/hooks/useBattleAssets.js");
const loaderSource = read("src/game/assets/battleAssetLoader.js");
const battleScreenSource = read("src/game/BattleScreen.jsx");
const battleCanvasSource = read("src/game/render/BattleCanvas.jsx");
const eventSource = read("src/game/hooks/battleCanvasEvents.js");

if (!hookSource.includes('progress.phase === "deferred"')) {
  errors.push("useBattleAssets.js não separa progresso crítico de progresso adiado.");
}
if (!hookSource.includes("ready: true") || !hookSource.includes("deferredPercent")) {
  errors.push("useBattleAssets.js não preserva a prontidão durante o carregamento adiado.");
}
const deferredBranch = hookSource.match(/if\s*\(\s*progress\.phase\s*===\s*"deferred"\s*\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || "";
if (deferredBranch.includes("ready: false")) {
  errors.push("O ramo deferred ainda redefine ready para false.");
}

if (!loaderSource.includes('phase: "critical"') || !loaderSource.includes('phase: "deferred"')) {
  errors.push("battleAssetLoader.js não identifica as duas fases de progresso.");
}

if (!battleScreenSource.includes('from "./render/BattleCanvas.jsx"')) {
  errors.push("BattleScreen.jsx não usa BattleCanvas como fronteira DOM do canvas.");
}
if (!battleCanvasSource.includes("installNonPassiveContextMenuGuard")) {
  errors.push("BattleCanvas.jsx não instala o bloqueio nativo de contextmenu.");
}
if (!battleCanvasSource.includes("useBattleRenderLoop")) {
  errors.push("BattleCanvas.jsx não delega requestAnimationFrame para useBattleRenderLoop.");
}
if (!battleCanvasSource.includes("onContextMenu={onContextMenu}")) {
  errors.push("BattleCanvas.jsx não repassa o handler React de contextmenu.");
}

if (!eventSource.includes("passive: false") || !/addEventListener\(\s*"contextmenu"/.test(eventSource)) {
  errors.push("battleCanvasEvents.js não registra contextmenu como não passivo.");
}
if (!eventSource.includes("event.preventDefault()")) {
  errors.push("battleCanvasEvents.js não bloqueia o menu nativo no listener não passivo.");
}

const packageJsonSource = read("package.json");
if (packageJsonSource) {
  const packageJson = JSON.parse(packageJsonSource);
  if (!packageJson.scripts?.["verify:battle-loading"]) {
    errors.push("verify:battle-loading não foi registrado.");
  }
}

if (errors.length) {
  console.error(`Contrato de carregamento da batalha inválido: ${errors.length} erro(s).`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("BattleScreen/BattleCanvas preservam carregamento adiado e contextmenu não passivo.");
}
