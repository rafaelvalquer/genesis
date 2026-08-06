#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const assertContains = (content, value, label) => {
  if (!content.includes(value)) throw new Error(`Contrato ausente: ${label}`);
};

const content = read("src/game/content.js");
const battle = read("src/game/battleModel.js");
const tactics = read("src/game/enemies/chapter05/enguiaRasgamarTactics.js");

assertContains(content, "fullLaneRangedAttack: true", "configuração de alcance total");
assertContains(battle, "config.fullLaneRangedAttack", "uso da configuração de alcance total");
assertContains(battle, "maximumRangePx = config.fullLaneRangedAttack", "cálculo do alcance máximo");
assertContains(battle, "FIELD.width", "alcance equivalente à largura do campo");
assertContains(battle, "rasgamarFullLaneTargeted", "telemetria do alvo distante");
assertContains(battle, "enemy.rasgamarBaseAssault && hasLivingTroopsForRasgamar(session)", "cancelamento do ataque à base quando surge tropa");
assertContains(battle, "applyRasgamarBaseAttack(session, enemy, config, events)", "dano direto à integridade sem tropas");
assertContains(tactics, "export function selectRasgamarRangedTarget", "seletor determinístico de alvo");
assertContains(tactics, "troop.type === \"reator\" ? 0 : 1", "prioridade do Reator");

console.log("Contrato da Enguia Rasgamar com alcance total validado.");
