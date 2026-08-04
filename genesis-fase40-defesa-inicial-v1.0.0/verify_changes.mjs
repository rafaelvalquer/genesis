#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || ".");
const checks = [
  ["fase 40 possui tropas iniciais", "src/game/chapterFivePhases.js", "startingTroops: ["],
  ["cinco Bastiões na coluna 6", "src/game/chapterFivePhases.js", '{ type: "bastiaoMare", row: 4, col: 6 }'],
  ["cinco Fuzileiros na coluna 5", "src/game/chapterFivePhases.js", '{ type: "fuzileiroVoltaico", row: 4, col: 5 }'],
  ["energia inicial não é consumida", "src/game/chapterFivePhases.js", "consumeEnergy: false"],
  ["Supply inicial não é consumido", "src/game/chapterFivePhases.js", "consumeSupply: false"],
  ["loadout não é obrigatório", "src/game/chapterFivePhases.js", "requireLoadout: false"],
  ["sessão implanta a guarnição", "src/game/battleModel.js", "deployStartingTroops(session);"],
  ["contador separado da missão", "src/game/battleModel.js", "providedTroops: {}"],
  ["tropas recebem custo zero", "src/game/battleModel.js", "energyCost,"],
  ["tropas bônus são marcadas", "src/game/battleModel.js", "troop.missionProvided = true"],
  ["remoção manual é bloqueada", "src/game/battleModel.js", "defesa inicial da missão e não pode ser removida"],
  ["teste da fase 40 instalado", "src/game/phase40StartingDefense.test.js", "preserva energia e Supply"],
];

let failed = false;
for (const [label, relative, marker] of checks) {
  const target = path.join(repoRoot, relative);
  const ok = fs.existsSync(target) && fs.readFileSync(target, "utf8").includes(marker);
  console.log(`${ok ? "[OK]" : "[FALHA]"} ${label}`);
  failed ||= !ok;
}

if (failed) process.exitCode = 1;
else console.log("\nVerificação estrutural concluída.");
