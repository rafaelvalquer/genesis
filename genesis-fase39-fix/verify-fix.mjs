#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || process.cwd());
const checks = [
  {
    file: "src/game/battleModel.js",
    valid: (content) => content.includes("return !ENEMIES[enemy.type]?.boss && enemy.type !== \"carapacaNereida\"")
      && !content.includes("return !config?.boss && enemy.type !== \"carapacaNereida\""),
    message: "proteção da Carapaça usa a configuração do inimigo atingido",
  },
  {
    file: "src/campaign/CampaignPlanet.jsx",
    valid: (content) => {
      const start = content.indexOf("const onWheel = (event) =>");
      const end = content.indexOf("const onKeyDown", start);
      return start >= 0 && end > start && !content.slice(start, end).includes("event.preventDefault()");
    },
    message: "onWheel não chama preventDefault dentro do listener passivo do React",
  },
  {
    file: "src/game/icaroNereidaProtection.test.js",
    valid: (content) => content.includes("Fase 39 — impacto do Interceptador Ícaro"),
    message: "teste de regressão instalado",
  },
];

let failed = false;
for (const check of checks) {
  const file = path.join(root, check.file);
  const exists = fs.existsSync(file);
  const valid = exists && check.valid(fs.readFileSync(file, "utf8"));
  console.log(`${valid ? "[OK]" : "[FALHA]"} ${check.message}`);
  failed ||= !valid;
}

process.exitCode = failed ? 1 : 0;
