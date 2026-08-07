import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const normalize = (text) => text.replace(/\r\n/g, "\n");
const read = (rel) => normalize(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
const write = (rel, content) => fs.writeFileSync(path.join(repoRoot, rel), content, "utf8");

function replaceBetween(content, start, end, replacement, label) {
  const a = content.indexOf(start);
  const b = a >= 0 ? content.indexOf(end, a) : -1;
  if (a < 0 || b <= a) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, a) + replacement + content.slice(b);
}

function insertOnce(content, anchor, insertion, marker, label) {
  if (content.includes(marker)) return content;
  const index = content.indexOf(anchor);
  if (index < 0) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, index + anchor.length) + insertion + content.slice(index + anchor.length);
}

function patchBattleModel() {
  const rel = "src/game/battleModel.js";
  let c = read(rel);

  c = insertOnce(
    c,
    'import { compactActive } from "./battleCollections.js";',
    '\nimport {\n  DEMATERIALIZATION_PULSE,\n  beginDematerializationPulse,\n  createDematerializationPulseState,\n} from "./dematerializationPulse.js";',
    'beginDematerializationPulse',
    "import dematerializationPulse",
  );

  c = c.replace(
    /export const DEMATERIALIZATION_PULSE = \{[\s\S]*?scorchMarkDurationMs:\s*6000,\s*\};/,
    'export { DEMATERIALIZATION_PULSE };',
  );

  c = c.replace(
    /dematerializationPulses:\s*Array\.from\(\{ length: FIELD\.rows \}, \(_, row\) => \(\{[\s\S]*?fireAt:\s*null,\s*\}\)\),/,
    'dematerializationPulses: Array.from({ length: FIELD.rows }, (_, row) => createDematerializationPulseState(row)),',
  );

  const pulseBlock = `function pulseForRow(session, row) {\n  return session.dematerializationPulses?.find((pulse) => pulse.row === row) || null;\n}\n\nfunction hasDematerializationPulseTargets(session, row) {\n  return session.enemies.some((enemy) => !enemy.dead && enemy.hp > 0 && enemyOccupiesTargetRow(enemy, row));\n}\n\nexport function activateDematerializationPulse(session, row, options = {}) {\n  const source = options.source || "player";\n  const targetRow = clamp(Math.floor(Number(row)), 0, FIELD.rows - 1);\n  const externalEvents = Array.isArray(options.events) ? options.events : [];\n  const before = externalEvents.length;\n  const result = beginDematerializationPulse(session, targetRow, {\n    source,\n    reason: options.reason || null,\n    events: externalEvents,\n    requireTargets: options.requireTargets ?? source !== "automatic",\n    hasTargets: hasDematerializationPulseTargets(session, targetRow),\n  });\n  return {\n    ...result,\n    row: targetRow,\n    events: externalEvents.slice(before),\n  };\n}\n\nfunction disintegrateEnemy(session, enemy, events) {\n  if (!enemy || enemy.dead) return;\n  if (enemy.type === "enguiaRasgamar" && enemy.rasgamarSubmerged) return;\n  enemy.hp = 0;\n  enemy.dead = true;\n  detachParasite(session, enemy);\n  session.killed += 1;\n  events.push({\n    type: "enemyDisintegrated",\n    enemyId: enemy.id,\n    row: enemy.row,\n    x: enemy.x,\n    y: enemy.y,\n    bornAt: session.elapsed,\n    entity: { ...enemy },\n    color: "#22d3ee",\n  });\n}\n\nfunction applyDematerializationPulseDamage(session, pulse, enemy, events) {\n  if (!enemy || enemy.dead || enemy.hp <= 0 || !enemyOccupiesTargetRow(enemy, pulse.row)) return;\n  const hpBefore = Math.max(0, Number(enemy.hp) || 0);\n  const damage = Math.min(DEMATERIALIZATION_PULSE.damage, hpBefore);\n  enemy.hp = Math.max(0, hpBefore - damage);\n  const killed = enemy.hp <= 0;\n  events.push({\n    type: "pulseHit",\n    row: pulse.row,\n    cannonId: pulse.id,\n    source: pulse.activationSource || "automatic",\n    reason: pulse.activationReason || null,\n    enemyId: enemy.id,\n    targetId: enemy.id,\n    damage,\n    hpBefore,\n    hpAfter: enemy.hp,\n    killed,\n    x: enemy.x,\n    y: enemy.y,\n    color: "#22d3ee",\n  });\n  if (killed) {\n    events.push({\n      type: "pulseKill", row: pulse.row, cannonId: pulse.id, enemyId: enemy.id, damage,\n      source: pulse.activationSource || "automatic", reason: pulse.activationReason || null,\n      x: enemy.x, y: enemy.y, color: "#22d3ee",\n    });\n    disintegrateEnemy(session, enemy, events);\n  }\n}\n\nfunction updateDematerializationPulses(session, events) {\n  for (const pulse of session.dematerializationPulses || []) {\n    if (pulse.state !== "charging" || session.elapsed < pulse.fireAt) continue;\n    pulse.state = "spent";\n    const y = pulse.row * CELL.height + CELL.height / 2;\n    const targets = session.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0 && enemyOccupiesTargetRow(enemy, pulse.row));\n    const hpBefore = targets.reduce((total, enemy) => total + Math.max(0, Number(enemy.hp) || 0), 0);\n    events.push({\n      type: "pulseFired",\n      row: pulse.row,\n      cannonId: pulse.id,\n      source: pulse.activationSource || "automatic",\n      reason: pulse.activationReason || null,\n      damagePerTarget: DEMATERIALIZATION_PULSE.damage,\n      targetCount: targets.length,\n      x0: FIELD.combatOffsetX - 4,\n      y0: y,\n      x1: FIELD.width + 24,\n      y1: y,\n      bornAt: session.elapsed,\n      color: "#22d3ee",\n      seed: nextEffectSeed(session),\n    });\n    targets.forEach((enemy) => applyDematerializationPulseDamage(session, pulse, enemy, events));\n    const hpAfter = targets.reduce((total, enemy) => total + Math.max(0, Number(enemy.hp) || 0), 0);\n    events.push({\n      type: "pulseResolved",\n      row: pulse.row,\n      cannonId: pulse.id,\n      source: pulse.activationSource || "automatic",\n      reason: pulse.activationReason || null,\n      damage: Math.max(0, hpBefore - hpAfter),\n      kills: targets.filter((enemy) => enemy.dead).length,\n      targetCount: targets.length,\n    });\n  }\n  compactActive(session.enemies, (enemy) => !enemy.dead);\n}\n\n`;

  c = replaceBetween(c, "function pulseForRow(session, row)", "export function getSilicaDiggerSwarmSpeedFactor", pulseBlock, "bloco do pulso");

  const breachBlock = `function resolveEnemyBreach(session, enemy, events) {\n  const pulse = pulseForRow(session, enemy.row);\n  if (pulse?.state === "ready") {\n    const activation = activateDematerializationPulse(session, enemy.row, {\n      source: "automatic",\n      reason: "barrierBreach",\n      requireTargets: false,\n      events,\n    });\n    if (activation.ok) {\n      enemy.x = FIELD.baseX;\n      enemy.moving = false;\n      return false;\n    }\n  }\n  if (pulse?.state === "charging") {\n    enemy.x = FIELD.baseX;\n    enemy.moving = false;\n    return false;\n  }\n  enemy.dead = true;\n  const shielded = !session.sandbox && session.shieldCharges > 0 && !ENEMIES[enemy.type]?.boss;\n  if (shielded) session.shieldCharges -= 1;\n  const breachDamage = shielded ? 0 : enemy.baseDamage * session.currentWaveBaseDamageFactor * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);\n  if (!session.sandboxSettings?.invulnerableBase) session.integrity = Math.max(0, session.integrity - breachDamage);\n  if (shielded) events.push({ type: "shieldBlock", x: FIELD.baseX, y: enemy.y, remaining: session.shieldCharges });\n  events.push({ type: "breach", damage: breachDamage, x: FIELD.baseX, y: enemy.y });\n  return true;\n}\n\n`;
  c = replaceBetween(c, "function resolveEnemyBreach(session, enemy, events)", "function moveEnemy(session, enemy, dt, events)", breachBlock, "resolveEnemyBreach");

  write(rel, c);
}

function patchGameCanvas() {
  const rel = "src/game/GameCanvas.jsx";
  let c = read(rel);

  if (!c.includes("activateDematerializationPulse,")) {
    c = c.replace("  activateTroopSpecial,\n", "  activateTroopSpecial,\n  activateDematerializationPulse,\n");
  }
  if (!c.includes('DematerializationPulseControls')) {
    const anchor = 'import { WaveOutroCinematicOverlay } from "./waveOutro/WaveOutroCinematicOverlay.jsx";';
    c = insertOnce(c, anchor, '\nimport { DematerializationPulseControls } from "./components/DematerializationPulseControls.jsx";', 'components/DematerializationPulseControls.jsx', "import PulseControls");
  }

  if (!c.includes("  DEMATERIALIZATION_PULSE,")) {
    c = c.replace("  WAVE_OUTRO_TIMINGS,\n", "  WAVE_OUTRO_TIMINGS,\n  DEMATERIALIZATION_PULSE,\n");
  }

  if (!c.includes("handleActivateDematerializationPulse")) {
    const anchor = "\n  const handleCanvasContextMenu = (event) => {";
    const insertion = `\n  const handleActivateDematerializationPulse = (row) => {\n    const result = activateDematerializationPulse(sessionRef.current, row, {\n      source: "player",\n      reason: "manualTactical",\n    });\n    if (!result.ok) {\n      setMessage(result.reason || "Não foi possível disparar o canhão.");\n      return;\n    }\n    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);\n    consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);\n    play("alert", 0.55);\n    setMessage(\`Pulso da rota \${row + 1} carregando · \${DEMATERIALIZATION_PULSE.damage} de dano por inimigo.\`);\n    setSnapshot(getSnapshot(sessionRef.current));\n  };\n`;
    const idx = c.indexOf(anchor);
    if (idx < 0) throw new Error("Patch incompatível: handler de contexto no GameCanvas");
    c = c.slice(0, idx) + insertion + c.slice(idx);
  }

  if (!c.includes("<DematerializationPulseControls")) {
    const anchor = "            {!fortuneBlocksIntermission && <ColossusSpecialButtons";
    const idx = c.indexOf(anchor);
    if (idx < 0) throw new Error("Patch incompatível: render dos controles especiais");
    const insertion = `            {!fortuneBlocksIntermission && <DematerializationPulseControls\n              session={sessionRef.current}\n              onActivate={handleActivateDematerializationPulse}\n            />}\n`;
    c = c.slice(0, idx) + insertion + c.slice(idx);
  }

  write(rel, c);
}

function patchGraphicsRuntime() {
  const rel = "src/game/graphicsRuntime.js";
  let c = read(rel);
  if (!c.includes("pulseHit: 1.1")) {
    const anchor = "    pulseFired: 9, enemyDisintegrated: 1.5,";
    if (!c.includes(anchor)) throw new Error("Patch incompatível: shake do pulso em graphicsRuntime");
    c = c.replace(anchor, "    pulseFired: 9, pulseHit: 1.1, enemyDisintegrated: 1.5,");
  }
  if (!c.includes("pulseHit: { radius: 68")) {
    const anchor = "    pulseCharging: { radius: 96, life: 420 }, pulseFired: { radius: 210, life: 420 },";
    if (!c.includes(anchor)) throw new Error("Patch incompatível: luz do pulso em graphicsRuntime");
    c = c.replace(anchor, "    pulseCharging: { radius: 96, life: 420 }, pulseFired: { radius: 210, life: 420 }, pulseHit: { radius: 68, life: 220 },");
  }
  c = c.replace('["hit", "shieldHit", "shieldBreak", "troopHit"].includes(event.type)', '["hit", "shieldHit", "shieldBreak", "troopHit", "pulseHit"].includes(event.type)');
  write(rel, c);
}

function patchObservation() {
  const rel = "src/game/simulation/observation/createBattleObservation.js";
  let c = read(rel);
  if (!c.includes("dematerializationPulses:")) {
    const anchor = "    adaptiveAid: {";
    const idx = c.indexOf(anchor);
    if (idx < 0) throw new Error("Patch incompatível: observation adaptiveAid");
    const block = `    defenses: {\n      dematerializationPulses: (session.dematerializationPulses || []).map((pulse) => ({\n        id: pulse.id,\n        row: pulse.row,\n        state: pulse.state,\n        chargeStartedAt: pulse.chargeStartedAt,\n        fireAt: pulse.fireAt,\n        activationSource: pulse.activationSource || null,\n      })),\n    },\n\n`;
    c = c.slice(0, idx) + block + c.slice(idx);
  }
  write(rel, c);
}

function patchStrategicAgent() {
  const rel = "src/game/simulation/ai/StrategicAgent.js";
  let c = read(rel);
  if (!c.includes("planDematerializationPulseActions")) {
    const anchor = 'import {\n  planSpecialActions,\n} from "../planners/AbilityPlanner.js";';
    c = insertOnce(c, anchor, '\nimport { planDematerializationPulseActions } from "../planners/DematerializationPulsePlanner.js";', 'DematerializationPulsePlanner.js', "import planner do pulso");

    const actionAnchor = "    actions.push(\n      ...planSpecialActions(";
    const idx = c.indexOf(actionAnchor);
    if (idx < 0) throw new Error("Patch incompatível: ações especiais do StrategicAgent");
    const block = `    actions.push(\n      ...planDematerializationPulseActions(\n        session,\n        observation,\n        this.profile,\n      ),\n    );\n\n`;
    c = c.slice(0, idx) + block + c.slice(idx);
  }
  write(rel, c);
}

function patchSimulationActions() {
  const rel = "src/game/simulation/engine/simulationActions.js";
  let c = read(rel);
  if (!c.includes("activateDematerializationPulse,")) {
    c = c.replace("  activateTroopSpecial,\n", "  activateTroopSpecial,\n  activateDematerializationPulse,\n");
  }
  if (!c.includes('case "activateDematerializationPulse":')) {
    const keyAnchor = '    case "activateSpecial":\n      return [\n        "special",\n        action.troopId,\n      ].join(":");\n';
    if (!c.includes(keyAnchor)) throw new Error("Patch incompatível: actionKey activateSpecial");
    c = c.replace(keyAnchor, keyAnchor + '\n    case "activateDematerializationPulse":\n      return ["pulse", action.row].join(":");\n');

    const switchAnchor = '    case "activateSpecial":\n      result = activateTroopSpecial(\n        session,\n        action.troopId,\n      );\n      break;\n';
    if (!c.includes(switchAnchor)) throw new Error("Patch incompatível: execução activateSpecial");
    c = c.replace(switchAnchor, switchAnchor + '\n    case "activateDematerializationPulse":\n      result = activateDematerializationPulse(\n        session,\n        action.row,\n        { source: "ai", reason: action.reason || "aiTactical" },\n      );\n      break;\n');
  }
  write(rel, c);
}

function patchStrategyProfiles() {
  const rel = "src/game/simulation/strategies/strategyProfiles.js";
  let c = read(rel);
  if (!c.includes("pulseRiskThreshold")) {
    c = c.replace("  specialRiskThreshold: 15,\n", "  specialRiskThreshold: 15,\n  pulseRiskThreshold: 16,\n  pulseEmergencyTimeMs: 6000,\n  pulseMinimumValue: 900,\n");
    c = c.replace("    specialRiskThreshold: 11,\n", "    specialRiskThreshold: 11,\n    pulseRiskThreshold: 12,\n    pulseEmergencyTimeMs: 7500,\n    pulseMinimumValue: 650,\n");
    c = c.replace("    specialRiskThreshold: 18,\n", "    specialRiskThreshold: 18,\n    pulseRiskThreshold: 20,\n    pulseEmergencyTimeMs: 4500,\n    pulseMinimumValue: 1200,\n");
    c = c.replace("    specialRiskThreshold: 9,\n", "    specialRiskThreshold: 9,\n    pulseRiskThreshold: 14,\n    pulseEmergencyTimeMs: 5000,\n    pulseMinimumValue: 1000,\n");
    c = c.replace("    specialRiskThreshold:\n      profile.specialRiskThreshold,\n", "    specialRiskThreshold:\n      profile.specialRiskThreshold,\n    pulseRiskThreshold:\n      profile.pulseRiskThreshold,\n    pulseEmergencyTimeMs:\n      profile.pulseEmergencyTimeMs,\n    pulseMinimumValue:\n      profile.pulseMinimumValue,\n");
  }
  write(rel, c);
}

function patchPolicyOptimizer() {
  const rel = "src/game/simulation/optimization/PolicyOptimizer.js";
  let c = read(rel);
  if (!c.includes("pulseRiskThreshold")) {
    c = c.replace("  specialRiskThreshold: [5, 28],\n", "  specialRiskThreshold: [5, 28],\n  pulseRiskThreshold: [8, 30],\n  pulseEmergencyTimeMs: [2000, 9000],\n  pulseMinimumValue: [300, 1800],\n");
  }
  write(rel, c);
}

function patchMetrics() {
  const rel = "src/game/simulation/metrics/SimulationMetrics.js";
  let c = read(rel);
  if (!c.includes("pulseActivations")) {
    c = c.replace("    this.adaptiveAidSelections = 0;\n", "    this.adaptiveAidSelections = 0;\n    this.pulseActivations = 0;\n    this.pulseAiActivations = 0;\n    this.pulseAutomaticActivations = 0;\n    this.pulseDamage = 0;\n    this.pulseKills = 0;\n    this.pulseDamageByRow = {};\n");
    c = c.replace("      if (type === \"energyGenerated\") {", `      if (type === "pulseCharging") {\n        this.pulseActivations += 1;\n        if (event.source === "ai") this.pulseAiActivations += 1;\n        if (event.source === "automatic") this.pulseAutomaticActivations += 1;\n      }\n\n      if (type === "pulseHit") {\n        this.pulseDamage += amount;\n        increment(this.pulseDamageByRow, String(event.row), amount);\n        if (event.killed) this.pulseKills += 1;\n      }\n\n      if (type === "energyGenerated") {`);
    c = c.replace('        case "activateSpecial":\n          this.specialsUsed += 1;\n          break;\n', '        case "activateSpecial":\n          this.specialsUsed += 1;\n          break;\n        case "activateDematerializationPulse":\n          break;\n');
    c = c.replace("      adaptiveAidSelections:\n        this.adaptiveAidSelections,\n", "      adaptiveAidSelections:\n        this.adaptiveAidSelections,\n      dematerializationPulse: {\n        activations: this.pulseActivations,\n        aiActivations: this.pulseAiActivations,\n        automaticActivations: this.pulseAutomaticActivations,\n        damage: this.pulseDamage,\n        kills: this.pulseKills,\n        damageByRow: { ...this.pulseDamageByRow },\n      },\n");
  }
  write(rel, c);
}

patchBattleModel();
patchGameCanvas();
patchGraphicsRuntime();
patchObservation();
patchStrategicAgent();
patchSimulationActions();
patchStrategyProfiles();
patchPolicyOptimizer();
patchMetrics();
console.log("Mecânica de Pulso de Desmaterialização tático aplicada com sucesso.");
