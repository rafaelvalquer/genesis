#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(process.argv[2] || process.cwd());
const packageJsonPath = path.join(repositoryRoot, "package.json");

function fail(message) {
  console.error(`\n[ERRO] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
  fail(`package.json não encontrado em: ${repositoryRoot}`);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
if (packageJson.name !== "genesis-defense") {
  fail(`O diretório não parece ser o Genesis Defense. package.json.name=${packageJson.name || "<ausente>"}`);
}

const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupRoot = path.join(repositoryRoot, `.genesis-fase39-backup-${timestamp}`);
const changes = [];

function backup(relativePath) {
  const source = path.join(repositoryRoot, relativePath);
  if (!fs.existsSync(source)) fail(`Arquivo esperado não encontrado: ${relativePath}`);
  const destination = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function replaceExact(relativePath, before, after, label) {
  const target = path.join(repositoryRoot, relativePath);
  const content = fs.readFileSync(target, "utf8");

  if (content.includes(after)) {
    console.log(`[OK] ${label}: correção já aplicada.`);
    return;
  }
  if (!content.includes(before)) {
    fail(`${label}: o trecho esperado não foi encontrado. O arquivo pode ter mudado após o commit analisado.`);
  }

  backup(relativePath);
  fs.writeFileSync(target, content.replace(before, after), "utf8");
  changes.push(relativePath);
  console.log(`[APLICADO] ${label}`);
}

replaceExact(
  "src/game/battleModel.js",
  "return !config?.boss && enemy.type !== \"carapacaNereida\" && carrier.row === enemy.row",
  "return !ENEMIES[enemy.type]?.boss && enemy.type !== \"carapacaNereida\" && carrier.row === enemy.row",
  "Impacto do Ícaro contra alvo escoltado pela Carapaça de Nereida",
);

replaceExact(
  "src/campaign/CampaignPlanet.jsx",
  "    if (!runtime) return;\n    event.preventDefault();\n    runtime.killAuto?.();",
  "    if (!runtime) return;\n    runtime.killAuto?.();",
  "Aviso de preventDefault no zoom do mapa da campanha",
);

const testSource = path.join(packageRoot, "src/game/icaroNereidaProtection.test.js");
const testDestination = path.join(repositoryRoot, "src/game/icaroNereidaProtection.test.js");
if (fs.existsSync(testDestination)) backup("src/game/icaroNereidaProtection.test.js");
fs.mkdirSync(path.dirname(testDestination), { recursive: true });
fs.copyFileSync(testSource, testDestination);
changes.push("src/game/icaroNereidaProtection.test.js");
console.log("[APLICADO] Teste de regressão da fase 39.");

console.log("\nCorreção concluída.");
console.log(`Backup: ${backupRoot}`);
console.log("Arquivos tratados:");
for (const file of [...new Set(changes)]) console.log(`  - ${file}`);
console.log("\nValidação recomendada:");
console.log("  npm test -- src/game/icaroNereidaProtection.test.js");
console.log("  npm run build");
