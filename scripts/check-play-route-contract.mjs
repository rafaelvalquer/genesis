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

const app = read("src/App.jsx");
const loader = read("src/routing/retryableLazyModule.js");
const battleScreen = read("src/game/BattleScreen.jsx");
const gameCanvasFacade = read("src/game/GameCanvas.jsx");

if (!app.includes('import { createRetryableLazyModule } from "./routing/retryableLazyModule.js";')) {
  errors.push("App.jsx não importa createRetryableLazyModule.");
}

if (!app.includes('export const loadGameCanvasModule = createRetryableLazyModule(() => import("./game/BattleScreen.jsx"));')) {
  errors.push("A rota de batalha não usa BattleScreen com o carregador reutilizável.");
}

if (!app.includes("const GameCanvas = lazy(loadGameCanvasModule);")) {
  errors.push("React.lazy não usa loadGameCanvasModule.");
}

if (!app.includes("loadGameCanvasModule.preload()")) {
  errors.push("PlayPage não inicia o preload do módulo da batalha.");
}

if (!battleScreen.includes("export function BattleScreen")) {
  errors.push("BattleScreen.jsx não exporta BattleScreen.");
}

if (!gameCanvasFacade.includes('export { BattleScreen as default } from "./BattleScreen.jsx";')) {
  errors.push("GameCanvas.jsx não preserva a façade de compatibilidade.");
}

const playStart = app.indexOf("export function PlayPage");
const settingsStart = app.indexOf("export function SettingsPage");
if (playStart < 0 || settingsStart <= playStart) {
  errors.push("Não foi possível isolar PlayPage em App.jsx.");
} else {
  const playPage = app.slice(playStart, settingsStart);
  if (!/if\s*\(!started\)[\s\S]*?<Suspense[\s\S]*?<LoadoutPicker/.test(playPage)) {
    errors.push("LoadoutPicker não possui Suspense local.");
  }
  if (!/<Suspense[\s\S]*?<GameCanvas[\s\S]*?<\/Suspense>/.test(playPage)) {
    errors.push("BattleScreen lazy não possui Suspense local.");
  }
  const suspenseCount = (playPage.match(/<Suspense\b/g) || []).length;
  if (suspenseCount < 2) errors.push("PlayPage deve possuir dois limites Suspense locais.");
}

if (!loader.includes("pendingModule = null") || !loader.includes("load.preload = load")) {
  errors.push("retryableLazyModule.js não possui cache e retry.");
}

const packageJsonSource = read("package.json");
if (packageJsonSource) {
  const packageJson = JSON.parse(packageJsonSource);
  if (!packageJson.scripts?.["verify:play-route"]) {
    errors.push("verify:play-route não foi registrado.");
  }
}

if (errors.length) {
  console.error(`Contrato da rota de batalha inválido: ${errors.length} erro(s).`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Rota de batalha usa BattleScreen lazy/preload com façade GameCanvas compatível.");
}
