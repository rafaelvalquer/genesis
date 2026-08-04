#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const REQUIRED_REPO_FILES = [
  "package.json",
  "src/game/content.js",
  "src/game/battleModel.js",
  "src/game/projectileRenderer.js",
  "src/game/bastiaoMare.js",
  "src/game/bastiaoMare.test.js",
  "src/game/bastiaoMare.integration.test.js",
];
const REPLACEMENT_FILES = [
  "src/game/bastiaoMare.js",
  "src/game/bastiaoMare.test.js",
  "src/game/bastiaoMare.integration.test.js",
];

class PatchError extends Error {}
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const write = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

function occurrenceCount(text, value) {
  let count = 0;
  let cursor = 0;
  while (value && (cursor = text.indexOf(value, cursor)) >= 0) {
    count += 1;
    cursor += value.length;
  }
  return count;
}

function replaceOnce(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return [text, false];
  const count = occurrenceCount(text, oldValue);
  if (count !== 1) throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  return [text.replace(oldValue, newValue), true];
}

function insertBeforeOnce(text, marker, block, identity, label) {
  if (text.includes(identity)) return [text, false];
  const count = occurrenceCount(text, marker);
  if (count !== 1) throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  return [text.replace(marker, block + marker), true];
}

function findObjectBlock(text, identity, label) {
  const start = text.indexOf(identity);
  if (start < 0) throw new PatchError(`${label}: configuração não encontrada.`);
  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) throw new PatchError(`${label}: início do objeto não encontrado.`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (["\"", "'", "`"].includes(char)) { quote = char; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, block: text.slice(start, index + 1) };
    }
  }
  throw new PatchError(`${label}: fim do objeto não encontrado.`);
}

function patchContent(original) {
  const located = findObjectBlock(original, "  bastiaoMare: {", "content.js/Bastião");
  let block = located.block;
  const changes = [];

  if (!/\bmaxDeployed:\s*5\b/.test(block)) {
    if (!/\bmaxDeployed:\s*\d+\b/.test(block)) {
      throw new PatchError("content.js/limite: propriedade maxDeployed não encontrada.");
    }
    block = block.replace(/\bmaxDeployed:\s*\d+\b/, "maxDeployed: 5");
    changes.push("limite de implantação alterado para cinco");
  }

  if (!block.includes("overloadDamage:")) {
    const marker = "    energyPickupOffset: { x: 6, y: -68 },\n";
    const overloadConfig = String.raw`    overloadDamage: 5,
    overloadRadiusTiles: 1.25,
    overloadMaxTargets: 6,
    overloadBossDamageFactor: 0.5,
    overloadColor: "#22d3ee",
    overloadCoreColor: "#ecfeff",
    overloadDurationMs: 420,
`;
    const count = occurrenceCount(block, marker);
    if (count !== 1) throw new PatchError(`content.js/sobrecarga: esperado 1 marcador, encontrado ${count}.`);
    block = block.replace(marker, marker + overloadConfig);
    changes.push("configuração da Sobrecarga Capacitiva");
  }

  const oldDescription = String.raw`    description:
      "Tanque anfíbio que converte o dano recebido em bolas de energia. Dentro da água, recebe menos dano e carrega o gerador mais rapidamente."`;
  const newDescription = String.raw`    description:
      "Tanque anfíbio que converte impactos em bolas de energia e libera uma sobrecarga elétrica contra os inimigos próximos."`;
  if (block.includes(oldDescription)) {
    block = block.replace(oldDescription, newDescription);
    changes.push("descrição atualizada");
  }

  return [original.slice(0, located.start) + block + original.slice(located.end), changes];
}

function patchBattleModel(original) {
  if (original.includes("configForEnemy: (enemy) => ENEMIES[enemy.type]")) {
    return [original, []];
  }
  const pattern = /recordBastiaoDamage\(session, troop, actualHpDamage, events, \{\s*config,\s*flooded,\s*spawnEnergyPickup,\s*\}\);/;
  const matches = original.match(new RegExp(pattern.source, "g")) || [];
  if (matches.length !== 1) {
    throw new PatchError(`battleModel.js/integração da sobrecarga: esperado 1 marcador, encontrado ${matches.length}.`);
  }
  const replacement = String.raw`recordBastiaoDamage(session, troop, actualHpDamage, events, {
      config,
      flooded,
      spawnEnergyPickup,
      enemies: session.enemies,
      isEnemyTargetable,
      isEnemySubmerged: isRasgamarSubmerged,
      damageEnemy: (enemy, damage, damageContext) =>
        damageEnemy(session, enemy, damage, events, damageContext),
      configForEnemy: (enemy) => ENEMIES[enemy.type],
      nextEffectSeed: () => nextEffectSeed(session),
      cellWidth: CELL.width,
      cellHeight: CELL.height,
    });`;
  return [original.replace(pattern, replacement), ["dependências do dano elétrico em área"]];
}

function patchProjectileRenderer(original) {
  let text = original;
  const changes = [];
  let changed;

  [text, changed] = replaceOnce(
    text,
    '    || event.type === "voltaicDischarge"\n',
    '    || event.type === "voltaicDischarge" || event.type === "bastiaoOverload"\n',
    "projectileRenderer.js/evento essencial",
  );
  if (changed) changes.push("sobrecarga marcada como efeito essencial");

  const handler = String.raw`    if (event.type === "bastiaoOverload") {
      const delayMs = Math.max(0, Number(event.delayMs) || 0);
      const born = now + delayMs;
      const durationMs = Math.max(180, Number(event.durationMs) || 420);
      const originX = Number(event.x) || 0;
      const originY = Number(event.y) || 0;
      const centerX = Number(event.centerX ?? event.x) || 0;
      const centerY = Number(event.centerY ?? event.y) || 0;
      const radius = Math.max(44, Number(event.radiusX) || 100);
      const effectColor = event.color || "#22d3ee";
      const coreColor = event.coreColor || "#ecfeff";

      particles.push({
        kind: "ring", x: centerX, y: centerY, color: effectColor,
        born, life: durationMs, maxRadius: radius, essential: true,
      });
      particles.push({
        kind: "muzzle", x: originX, y: originY, color: coreColor,
        born, life: Math.min(220, durationMs), size: settings.quality === "low" ? 24 : 34,
        essential: true,
      });

      const localArcCount = settings.reduceMotion
        ? 2
        : settings.quality === "low" ? 3 : settings.quality === "medium" ? 5 : 8;
      for (let index = 0; index < localArcCount; index += 1) {
        const angle = random() * Math.PI * 2;
        const nextAngle = angle + (0.35 + random() * 0.75) * (random() < 0.5 ? -1 : 1);
        const innerRadius = 18 + random() * 18;
        const outerRadius = 32 + random() * 32;
        particles.push({
          kind: "voltaicArc",
          x0: originX + Math.cos(angle) * innerRadius,
          y0: originY + Math.sin(angle) * innerRadius * 0.72,
          x1: originX + Math.cos(nextAngle) * outerRadius,
          y1: originY + Math.sin(nextAngle) * outerRadius * 0.72,
          color: effectColor,
          seed: (event.seed || 1) + index + 1,
          width: settings.quality === "low" ? 2.4 : 3.2,
          born,
          life: settings.reduceMotion ? 150 : 210,
          primary: false,
          essential: index < 2,
        });
      }

      addSparks(particles, { ...event, x: originX, y: originY }, born,
        settings.reduceMotion ? 4 : Math.max(7, Math.round(16 * quality.density)), random, {
          color: "#a5f3fc", minSpeed: 20, speed: 100, life: 380, size: 1.8,
        });

      (event.targets || []).forEach((target, index) => {
        const targetBorn = born + (settings.reduceMotion ? 0 : 28);
        particles.push({
          kind: "voltaicArc",
          x0: originX, y0: originY,
          x1: target.x, y1: target.y,
          color: effectColor,
          seed: (event.seed || 1) + 100 + index,
          width: settings.quality === "low" ? 3 : 4,
          born: targetBorn,
          life: settings.reduceMotion ? 140 : 190,
          primary: false,
          essential: true,
        });
        particles.push({
          kind: "ring", x: target.x, y: target.y,
          color: target.boss ? "#bae6fd" : effectColor,
          born: targetBorn, life: 230,
          maxRadius: target.boss ? 24 : 30, essential: true,
        });
        addSparks(particles, { ...event, x: target.x, y: target.y }, targetBorn,
          settings.reduceMotion ? 2 : Math.max(3, Math.round(7 * quality.density)), random, {
            color: coreColor, minSpeed: 14, speed: 66, life: 280, size: 1.4,
          });
      });
      continue;
    }

`;
  [text, changed] = insertBeforeOnce(
    text,
    '    if (event.type === "voltaicDischarge") {\n',
    handler,
    '    if (event.type === "bastiaoOverload") {',
    "projectileRenderer.js/efeito da sobrecarga",
  );
  if (changed) changes.push("anel, clarão, arcos locais e raios nos alvos");

  return [text, changes];
}

function main() {
  const repoRoot = path.resolve(process.argv[2] || ".");
  for (const relative of REQUIRED_REPO_FILES) {
    if (!fs.existsSync(path.join(repoRoot, relative))) {
      throw new PatchError(`Arquivo obrigatório não encontrado: ${relative}`);
    }
  }

  const contentPath = path.join(repoRoot, "src/game/content.js");
  if (!read(contentPath).includes('  bastiaoMare: {')) {
    throw new PatchError("Esta atualização requer o Bastião de Maré v1.0 já instalado no projeto.");
  }

  const reports = [];
  const patches = [
    ["src/game/content.js", patchContent],
    ["src/game/battleModel.js", patchBattleModel],
    ["src/game/projectileRenderer.js", patchProjectileRenderer],
  ];

  for (const [relative, patcher] of patches) {
    const target = path.join(repoRoot, relative);
    const original = read(target);
    const [patched, changes] = patcher(original);
    if (patched !== original) write(target, patched);
    reports.push({ file: relative, changes });
  }

  for (const relative of REPLACEMENT_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    const target = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    reports.push({ file: relative, changes: ["arquivo atualizado para v1.1.0"] });
  }

  console.log("\nBastião de Maré v1.1.0 aplicado com sucesso.");
  for (const report of reports) {
    console.log(`- ${report.file}: ${report.changes.length ? report.changes.join(", ") : "já estava atualizado"}`);
  }
}

try { main(); }
catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
