#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || ".");
const checks = [
  ["content.js registra o Bastião", "src/game/content.js", '  bastiaoMare: {'],
  ["configura apenas idle/attack/death", "src/game/content.js", 'assetStates: ["idle", "attack", "death"]'],
  ["battleModel importa comportamento", "src/game/battleModel.js", 'from "./bastiaoMare.js"'],
  ["battleModel usa pickup compartilhado", "src/game/battleModel.js", 'export function spawnEnergyPickup'],
  ["battleModel registra dano do Bastião", "src/game/battleModel.js", 'recordBastiaoDamage(session, troop, actualHpDamage'],
  ["battleModel executa ataque", "src/game/battleModel.js", 'config.id === "bastiaoMare"'],
  ["vento não gera energia", "src/game/windCurrent.js", 'generateEnergy: false'],
  ["módulo do Bastião", "src/game/bastiaoMare.js", 'export function updateBastiaoMare'],
  ["teste unitário", "src/game/bastiaoMare.test.js", 'describe("Bastião de Maré"'],
  ["teste de integração", "src/game/bastiaoMare.integration.test.js", 'integração do Bastião de Maré'],
];
let failed = false;
for (const [label, relative, marker] of checks) {
  const target = path.join(repoRoot, relative);
  const ok = fs.existsSync(target) && fs.readFileSync(target, "utf8").includes(marker);
  console.log(`${ok ? "[OK]" : "[FALHA]"} ${label}`);
  failed ||= !ok;
}
for (const state of ["idle", "attack", "death"]) {
  const target = path.join(repoRoot, `src/game/assets/troop/bastiaoMare/${state}/frame0.png`);
  const ok = fs.existsSync(target) && fs.statSync(target).size > 1000;
  console.log(`${ok ? "[OK]" : "[FALHA]"} sprite ${state}/frame0.png`);
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
else console.log("\nVerificação estrutural concluída.");
