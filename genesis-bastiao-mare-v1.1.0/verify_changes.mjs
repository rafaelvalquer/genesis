#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || ".");
const checks = [
  ["content.js registra o Bastião", "src/game/content.js", '  bastiaoMare: {'],
  ["limite de cinco Bastiões", "src/game/content.js", "maxDeployed: 5"],
  ["dano da sobrecarga", "src/game/content.js", "overloadDamage: 5"],
  ["raio da sobrecarga", "src/game/content.js", "overloadRadiusTiles: 1.25"],
  ["máximo de seis alvos", "src/game/content.js", "overloadMaxTargets: 6"],
  ["redução de dano em chefes", "src/game/content.js", "overloadBossDamageFactor: 0.5"],
  ["battleModel integra os alvos da sobrecarga", "src/game/battleModel.js", "configForEnemy: (enemy) => ENEMIES[enemy.type]"],
  ["battleModel ignora Enguia submersa", "src/game/battleModel.js", "isEnemySubmerged: isRasgamarSubmerged"],
  ["renderer reconhece a sobrecarga", "src/game/projectileRenderer.js", 'event.type === "bastiaoOverload"'],
  ["renderer cria arcos elétricos", "src/game/projectileRenderer.js", 'kind: "voltaicArc"'],
  ["módulo seleciona alvos da área", "src/game/bastiaoMare.js", "export function selectBastiaoOverloadTargets"],
  ["módulo aplica a sobrecarga", "src/game/bastiaoMare.js", "export function applyBastiaoOverload"],
  ["teste unitário atualizado", "src/game/bastiaoMare.test.js", "renderer cria anel, clarão e arcos elétricos"],
  ["teste de integração atualizado", "src/game/bastiaoMare.integration.test.js", "permite cinco unidades e bloqueia a sexta"],
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
