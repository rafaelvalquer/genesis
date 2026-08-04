#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const REQUIRED_REPO_FILES = [
  "package.json", "src/game/content.js", "src/game/battleModel.js",
  "src/game/tideCycle.js", "src/game/projectileRenderer.js", "src/game/assetCatalog.js",
];
const NEW_FILES = [
  "src/game/fuzileiroVoltaico.js",
  "src/game/fuzileiroVoltaico.test.js",
  "src/game/fuzileiroVoltaico.integration.test.js",
];
const PATCHED_FILES = [
  "src/game/content.js", "src/game/battleModel.js", "src/game/tideCycle.js",
  "src/game/projectileRenderer.js", "src/game/assetCatalog.js",
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

function patchContent(original) {
  let text = original;
  const changes = [];
  const troopBlock = String.raw`  fuzileiroVoltaico: {
    id: "fuzileiroVoltaico",
    label: "Fuzileiro Voltaico",
    title: "Condutor de Combate",
    role: "Dano elétrico / Antienxame aquático",
    spriteKey: "guarda",
    price: 22,
    supply: 6,
    deployCooldownMs: 6500,
    maxDeployed: 5,
    hp: 30,
    range: 5.5,
    attackEveryMs: 1800,
    damage: 9,
    attack: "chainLightning",
    chainRadiusTiles: 1.35,
    chainMaxTargets: 3,
    primaryWaterDamageFactor: 1.2,
    secondaryDamageFactor: 0.2,
    secondaryWaterDamageFactor: 0.4,
    amphibious: true,
    canDeployInFloodedCells: true,
    canDeployInDeepWater: true,
    ignoreTidePressure: true,
    ignoreTideAttackSpeedPenalty: true,
    color: "#22d3ee",
    unlockAt: 32,
    assetStates: ["idle", "attack", "death"],
    assetStateFallbacks: { death: "attack" },
    idleVisual: {
      state: "idle",
      height: 126,
      durationMs: 1600,
      loop: true,
      timeline: Array.from({ length: 8 }, (_, frame) => ({ atMs: frame * 200, frame })),
    },
    attackVisual: {
      state: "attack",
      height: 126,
      durationMs: 420,
      releaseMs: 210,
      loop: false,
      effect: "voltaicDischarge",
      timeline: Array.from({ length: 8 }, (_, frame) => ({ atMs: frame * 52.5, frame })),
      shots: [{ atMs: 210, frame: 4, muzzle: { x: 0.97, y: 0.37 } }],
    },
    deathVisual: {
      state: "death",
      height: 126,
      durationMs: 800,
      loop: false,
    },
    description:
      "Dispara um raio contra o primeiro inimigo da rota. A descarga ganha força na água e se propaga para até três inimigos próximos.",
  },
`;
  let changed;
  [text, changed] = insertBeforeOnce(text, '  operadorJano: {\n', troopBlock,
    '  fuzileiroVoltaico: {', "content.js/configuração da tropa");
  if (changed) changes.push("configuração do Fuzileiro Voltaico");
  [text, changed] = replaceOnce(text,
    '  guarda: "medium",\n  operadorJano: "light",',
    '  guarda: "medium",\n  fuzileiroVoltaico: "medium",\n  operadorJano: "light",',
    "content.js/classe de vento");
  if (changed) changes.push("classe de vento média");
  return [text, changes];
}

function patchBattleModel(original) {
  let text = original;
  const changes = [];
  let changed;
  [text, changed] = replaceOnce(text,
    '} from "./interceptadorIcaro.js";\n',
    '} from "./interceptadorIcaro.js";\nimport { updateFuzileiroVoltaico } from "./fuzileiroVoltaico.js";\n',
    "battleModel.js/import");
  if (changed) changes.push("importação do comportamento voltaico");

  [text, changed] = replaceOnce(text, String.raw`  const tidePlacementReason = getTidePlacementBlockReason(session, row, col);
  if (tidePlacementReason) return tidePlacementReason;`, String.raw`  const tideCell = getTideCellState(session, row, col);
  const canBypassTidePlacement = tideCell.status !== "drying" && (
    (tideCell.type === "deepWater" && troop.canDeployInDeepWater)
    || (tideCell.flooded && troop.canDeployInFloodedCells)
  );
  const tidePlacementReason = canBypassTidePlacement
    ? null
    : getTidePlacementBlockReason(session, row, col);
  if (tidePlacementReason) return tidePlacementReason;`, "battleModel.js/implantação aquática");
  if (changed) changes.push("implantação em células alagadas e profundas");

  [text, changed] = replaceOnce(text, String.raw`    supplyCost: Number.isFinite(options.supplyCost) ? Number(options.supplyCost) : config.supply,
    droneCount: troopId === "droneSentinela" ? 1 : undefined,`, String.raw`    supplyCost: Number.isFinite(options.supplyCost) ? Number(options.supplyCost) : config.supply,
    amphibious: Boolean(config.amphibious),
    canDeployInFloodedCells: Boolean(config.canDeployInFloodedCells),
    canDeployInDeepWater: Boolean(config.canDeployInDeepWater),
    ignoreTidePressure: Boolean(config.ignoreTidePressure),
    ignoreTideAttackSpeedPenalty: Boolean(config.ignoreTideAttackSpeedPenalty),
    droneCount: troopId === "droneSentinela" ? 1 : undefined,`, "battleModel.js/flags anfíbias");
  if (changed) changes.push("flags anfíbias na entidade");

  [text, changed] = replaceOnce(text, String.raw`    if (config.id === "interceptadorIcaro") {
      updateInterceptadorIcaro(session, troop, config, events, {
        createId: id,
        getMuzzleWorldPosition,
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
      });
      continue;
    }
    if (config.attack === "flame") {`, String.raw`    if (config.id === "interceptadorIcaro") {
      updateInterceptadorIcaro(session, troop, config, events, {
        createId: id,
        getMuzzleWorldPosition,
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
      });
      continue;
    }
    if (config.id === "fuzileiroVoltaico") {
      updateFuzileiroVoltaico(session, troop, config, events, {
        occupiesTargetRow: enemyOccupiesTargetRow,
        damageEnemy: (target, amount, context) =>
          damageEnemy(session, target, amount, events, context),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        getMuzzlePosition: (frame) => getMuzzleWorldPosition(troop, config, 0, frame),
        getTargetPoint: (target, targetRow) =>
          enemyHitPointForRow(target, targetRow, session.elapsed),
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
      });
      continue;
    }
    if (config.attack === "flame") {`, "battleModel.js/ciclo de ataque");
  if (changed) changes.push("máquina de estados idle/attack do Fuzileiro");
  return [text, changes];
}

function patchTideCycle(original) {
  let text = original;
  const changes = [];
  let changed;
  [text, changed] = replaceOnce(text, String.raw`  if (!config || !troop || troop.dead || troop.type === "reator"
    || !isTideCellFlooded(session, troop.row, troop.col)) return 1;`, String.raw`  if (!config || !troop || troop.dead || troop.type === "reator"
    || troop.ignoreTideAttackSpeedPenalty
    || !isTideCellFlooded(session, troop.row, troop.col)) return 1;`, "tideCycle.js/cadência anfíbia");
  if (changed) changes.push("imunidade à penalidade de cadência");

  [text, changed] = replaceOnce(text,
    '    const pressureStart = troop.submergedStartedAt + config.pressureGraceMs;', String.raw`    if (troop.ignoreTidePressure) {
      troop.tidePressureDamageApplied = 0;
      continue;
    }

    const pressureStart = troop.submergedStartedAt + config.pressureGraceMs;`, "tideCycle.js/pressão da maré");
  if (changed) changes.push("imunidade ao dano de pressão");
  return [text, changes];
}

function patchProjectileRenderer(original) {
  let text = original;
  const changes = [];
  let changed;
  [text, changed] = replaceOnce(text,
    '    || event.type === "prismaticPulse" || event.type === "iceImpact"',
    '    || event.type === "prismaticPulse" || event.type === "iceImpact"\n    || event.type === "voltaicDischarge"',
    "projectileRenderer.js/evento essencial");
  if (changed) changes.push("descarga marcada como efeito essencial");

  const eventBlock = String.raw`    if (event.type === "voltaicDischarge") {
      const primaryLife = settings.reduceMotion ? 150 : 190;
      particles.push({
        kind: "voltaicArc",
        x0: event.x0, y0: event.y0, x1: event.x1, y1: event.y1,
        color: event.color || "#22d3ee", seed: event.seed,
        width: 7, born: now, life: primaryLife, primary: true, essential: true,
      });
      particles.push({
        kind: "muzzle", x: event.x0, y: event.y0,
        color: "#cffafe", born: now, life: 150, size: 18, essential: true,
      });
      particles.push({
        kind: "ring", x: event.x1, y: event.y1,
        color: event.color || "#22d3ee", born: now, life: 260,
        maxRadius: event.primaryInWater ? 42 : 28, essential: true,
      });
      addSparks(particles, { ...event, x: event.x1, y: event.y1 }, now,
        settings.reduceMotion ? 5 : Math.max(9, Math.round(18 * quality.density)), random, {
          color: "#a5f3fc", minSpeed: 22, speed: 98, life: 360, size: 1.8,
        });
      (event.chains || []).forEach((chain, index) => {
        particles.push({
          kind: "voltaicArc",
          x0: chain.x0, y0: chain.y0, x1: chain.x1, y1: chain.y1,
          color: event.color || "#22d3ee", seed: chain.seed || event.seed + index + 1,
          width: 4.2, born: now + (settings.reduceMotion ? 0 : 40),
          life: settings.reduceMotion ? 130 : 160, primary: false, essential: true,
        });
        particles.push({
          kind: "ring", x: chain.x1, y: chain.y1,
          color: chain.inWater ? "#67e8f9" : event.color || "#22d3ee",
          born: now + (settings.reduceMotion ? 0 : 40), life: 220,
          maxRadius: chain.inWater ? 34 : 20, essential: true,
        });
        addSparks(particles, { ...event, x: chain.x1, y: chain.y1 }, now,
          settings.reduceMotion ? 3 : Math.max(5, Math.round(10 * quality.density)), random, {
            color: chain.inWater ? "#ecfeff" : "#67e8f9",
            minSpeed: 16, speed: 72, life: 300, size: 1.5,
          });
      });
      continue;
    }

`;
  [text, changed] = insertBeforeOnce(text,
    '    if (event.type === "electricCharge") {\n', eventBlock,
    '    if (event.type === "voltaicDischarge") {', "projectileRenderer.js/criação dos raios");
  if (changed) changes.push("raio principal, ramificações e impactos aquáticos");

  const drawBlock = String.raw`function drawVoltaicArc(ctx, particle, progress, settings) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const alpha = Math.pow(1 - clampedProgress, 0.72);
  const dx = particle.x1 - particle.x0;
  const dy = particle.y1 - particle.y0;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const segmentCount = settings.reduceMotion
    ? 1
    : Math.max(5, Math.min(10, Math.round(distance / 58)));
  const phase = settings.reduceMotion ? 0 : Math.floor(clampedProgress * 4);
  const random = seeded((particle.seed || 1) + phase * 7919);
  const points = [{ x: particle.x0, y: particle.y0 }];
  for (let index = 1; index < segmentCount; index += 1) {
    const ratio = index / segmentCount;
    const envelope = Math.sin(ratio * Math.PI);
    const jitter = (random() - 0.5) * (particle.primary ? 18 : 12) * envelope;
    points.push({
      x: particle.x0 + dx * ratio + normalX * jitter,
      y: particle.y0 + dy * ratio + normalY * jitter,
    });
  }
  points.push({ x: particle.x1, y: particle.y1 });

  const stroke = (color, width, shadowBlur = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width);
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
  };

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  stroke("rgba(8,47,73,.72)", particle.width * 1.9, 12);
  stroke(particle.color || "#22d3ee", particle.width, 18);
  stroke("rgba(236,254,255," + (0.96 * alpha) + ")", particle.width * 0.3, 6);
}

`;
  [text, changed] = insertBeforeOnce(text,
    'function drawLaser(ctx, particle, progress, settings) {\n', drawBlock,
    'function drawVoltaicArc(ctx, particle, progress, settings) {', "projectileRenderer.js/desenho do raio");
  if (changed) changes.push("renderização de raio elétrico segmentado");

  [text, changed] = replaceOnce(text, String.raw`    const progress = (now - particle.born) / particle.life;
    if (progress >= 1) continue;
    particles[write] = particle;
    write += 1;`, String.raw`    const progress = (now - particle.born) / particle.life;
    if (progress >= 1) continue;
    particles[write] = particle;
    write += 1;
    if (progress < 0) continue;`, "projectileRenderer.js/atraso das ramificações");
  if (changed) changes.push("atraso visual seguro para raios secundários");

  [text, changed] = replaceOnce(text,
    '    } else if (particle.kind === "laser") drawLaser(ctx, particle, progress, settings);',
    '    } else if (particle.kind === "voltaicArc") drawVoltaicArc(ctx, particle, progress, settings);\n    else if (particle.kind === "laser") drawLaser(ctx, particle, progress, settings);',
    "projectileRenderer.js/ciclo de desenho");
  if (changed) changes.push("integração da partícula voltaica");
  return [text, changes];
}

function patchAssetCatalog(original) {
  let text = original;
  const changes = [];
  let changed;
  [text, changed] = replaceOnce(text, String.raw`      const task = async () => {
        result.troops[troopId][state] = await loadFrameSet(
          troopFrameModules, troop.spriteKey, state, loadOptions,
        );
      };`, String.raw`      const task = async () => {
        let frames = await loadFrameSet(
          troopFrameModules, troop.spriteKey, state, loadOptions,
        );
        const fallbackState = troop.assetStateFallbacks?.[state];
        if (!frames.some(Boolean) && fallbackState) {
          frames = await loadFrameSet(
            troopFrameModules, troop.spriteKey, fallbackState, loadOptions,
          );
        }
        result.troops[troopId][state] = frames;
      };`, "assetCatalog.js/fallback de animação");
  if (changed) changes.push("fallback temporário da animação de morte para os frames de ataque da Guarda");
  return [text, changes];
}

const PATCHERS = new Map([
  ["src/game/content.js", patchContent],
  ["src/game/battleModel.js", patchBattleModel],
  ["src/game/tideCycle.js", patchTideCycle],
  ["src/game/projectileRenderer.js", patchProjectileRenderer],
  ["src/game/assetCatalog.js", patchAssetCatalog],
]);

function parseArgs(argv) {
  const result = { repoRoot: "", noBackup: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo-root") result.repoRoot = argv[++index] || "";
    else if (arg === "--no-backup") result.noBackup = true;
    else throw new PatchError(`Argumento desconhecido: ${arg}`);
  }
  if (!result.repoRoot) throw new PatchError("Informe --repo-root com a raiz do Genesis.");
  return result;
}

function validateRepo(repoRoot) {
  const missing = REQUIRED_REPO_FILES.filter((relative) => !fs.existsSync(path.join(repoRoot, relative)));
  if (missing.length) {
    throw new PatchError(`Raiz do Genesis inválida. Arquivos ausentes: ${missing.join(", ")}`);
  }
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function createBackup(repoRoot) {
  const backupRoot = path.join(repoRoot, ".genesis-backups", `fuzileiro-voltaico-${timestamp()}`);
  for (const relative of [...PATCHED_FILES, ...NEW_FILES]) {
    const source = path.join(repoRoot, relative);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  return backupRoot;
}

function planPatches(repoRoot) {
  const planned = new Map();
  const report = new Map();
  for (const [relative, patcher] of PATCHERS) {
    const [updated, changes] = patcher(read(path.join(repoRoot, relative)));
    planned.set(relative, updated);
    report.set(relative, changes);
  }
  for (const relative of NEW_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    if (!fs.existsSync(source)) throw new PatchError(`Payload ausente: ${relative}`);
    read(source);
  }
  return { planned, report };
}

function installPayload(repoRoot) {
  const installed = [];
  for (const relative of NEW_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    const destination = path.join(repoRoot, relative);
    const newContent = read(source);
    const oldContent = fs.existsSync(destination) ? read(destination) : null;
    if (oldContent === newContent) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    installed.push(relative);
  }
  return installed;
}

function applyPlannedPatches(repoRoot, planned) {
  for (const [relative, updated] of planned) {
    const destination = path.join(repoRoot, relative);
    if (read(destination) !== updated) write(destination, updated);
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = path.resolve(args.repoRoot);
    validateRepo(repoRoot);
    const { planned, report } = planPatches(repoRoot);
    const backupRoot = args.noBackup ? null : createBackup(repoRoot);
    const installed = installPayload(repoRoot);
    applyPlannedPatches(repoRoot, planned);

    console.log("[OK] Fuzileiro Voltaico instalado.");
    if (backupRoot) console.log(`[OK] Backup: ${backupRoot}`);
    if (installed.length) {
      console.log("[OK] Arquivos instalados:");
      for (const relative of installed) console.log(`  - ${relative}`);
    }
    for (const [relative, changes] of report) {
      if (!changes.length) {
        console.log(`[OK] ${relative}: já estava atualizado.`);
        continue;
      }
      console.log(`[OK] ${relative}:`);
      for (const change of changes) console.log(`  - ${change}`);
    }
  } catch (error) {
    console.error(`[ERRO] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
