import { CHAPTER_SIX_PHASES } from "../src/game/chapterSixPhases.js";
import { CHAPTER_SIX_PACKETS } from "../src/game/chapterSixWaves.js";
import { enqueueBossReinforcement } from "../src/game/systems/bossEncounterSystem.js";
import {
  createBattleSession,
  createTroopEntity,
  forceColossoAttack,
  startWave,
  stepBattle,
} from "../src/game/battleModel.js";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  return [key, value ?? true];
}));
const seedCount = Math.max(1, Number(args.seeds || 25));
const phase = CHAPTER_SIX_PHASES.find((entry) => entry.id === "fase_48");
if (!phase) throw new Error("Fase 48 não encontrada");

function finite(value) { return Number.isFinite(value); }
function addHarnessTroops(session) {
  const types = ["marine", "sniper", "ranger", "caçador", "krio", "guarda", "bombardeiro", "incinerador", "marine", "sniper"];
  types.forEach((type, index) => {
    const troop = createTroopEntity(session, type, index % 5, 1 + Math.floor(index / 5), { hpRatio: 1 });
    troop.hp = troop.maxHp * 100;
    troop.maxHp *= 100;
    session.troops.push(troop);
  });
}

function runSeed(seed) {
  const session = createBattleSession(phase, ["marine", "sniper", "ranger", "caçador", "krio", "guarda", "bombardeiro", "incinerador"], seed, {
    sandbox: true,
    sandboxSettings: { rulesMode: "free", invulnerableBase: true },
  });
  session.waveIndex = 5;
  addHarnessTroops(session);
  if (!startWave(session)) throw new Error(`seed ${seed}: não foi possível iniciar a Wave 6`);
  session.phase = { ...session.phase, alphaPressure: { ...session.phase.alphaPressure, baseChance: 1, maxChance: 1 } };
  session.alphaPressure.nextCheckAt = session.elapsed + 1;
  const metrics = {
    seed, peakEnemies: 0, peakProjectiles: 0, peakTemporaryHazards: 0, peakPermanentHazards: 0,
    peakRegularEnemies: 0, peakAlphaEnemies: 0, peakBossEnemies: 0, alphaSpawned: 0,
    riftsOpened: 0, reinforcementsSpawned: 0, bossPhases: [], maximumQueueSize: 0,
    totalSteps: 0, invalidNumbers: 0, outcome: null, attackSequence: [], alphaTypes: [], alphaRows: [],
    reinforcementSequence: [], riftTargets: [], stepMsTotal: 0, stepMsMax: 0,
  };
  let phaseIndex = 0;
  let forcedAttackIndex = 0;
  let bossRef = null;
  const attacks = ["rift", "fracture", "seismic", "slam"];
  for (let elapsed = 0; elapsed < 180000; elapsed += 100) {
    const started = performance.now();
    const events = stepBattle(session, 100);
    const duration = performance.now() - started;
    metrics.stepMsTotal += duration; metrics.stepMsMax = Math.max(metrics.stepMsMax, duration); metrics.totalSteps += 1;
    const boss = session.enemies.find((enemy) => enemy.type === "colossoCaldeira");
    if (boss) bossRef = boss;
    if (boss && !boss.dead) {
      const ratio = boss.hp / Math.max(1, boss.maxHp);
      if (phaseIndex === 0 && ratio <= .70) { phaseIndex = 1; metrics.bossPhases.push(2); }
      if (phaseIndex === 1 && ratio <= .35) { phaseIndex = 2; metrics.bossPhases.push(3); }
      if (phaseIndex === 2 && ratio <= .15) { phaseIndex = 3; metrics.bossPhases.push("finalCollapse"); }
      if (boss.colossoState === "idle" && !boss.colossoQueuedAttack) {
        if (forcedAttackIndex < attacks.length) {
          const attack = attacks[forcedAttackIndex++];
          if (forceColossoAttack(session, attack).ok) metrics.attackSequence.push(attack);
        } else if (phaseIndex === 0 && ratio > .70) boss.hp = boss.maxHp * .69;
        else if (phaseIndex === 1 && ratio > .35) boss.hp = boss.maxHp * .34;
        else if (phaseIndex === 2 && ratio > .15) boss.hp = boss.maxHp * .14;
        else if (phaseIndex === 3 && ratio > .01) boss.hp = 0;
      }
      if (metrics.reinforcementsSpawned === 0 && session.bossEncounter?.spawned) {
        const entries = enqueueBossReinforcement(session, "C6-06", { packets: CHAPTER_SIX_PACKETS, fieldRows: 5 });
        if (entries.length) {
          metrics.reinforcementsSpawned += entries.length;
          metrics.reinforcementSequence.push("C6-06");
        }
      }
    }
    for (const event of events) {
      if (event.type === "chapterSixAlphaPressureTriggered") { metrics.alphaTypes.push(event.enemyType); metrics.alphaRows.push(event.row); }
      if (event.type === "colossoRiftOpened") { metrics.riftsOpened += 1; metrics.riftTargets.push([event.row, event.col]); }
      if (event.type === "colossoReinforcementQueued" || event.type === "bossReinforcementQueued") { metrics.reinforcementsSpawned += 1; metrics.reinforcementSequence.push(event.packetKey || event.packet); }
      if (event.type === "spawn" && event.enemy?.variant === "alpha") metrics.alphaSpawned += 1;
    }
    const enemies = session.enemies.filter((enemy) => !enemy.dead);
    metrics.peakEnemies = Math.max(metrics.peakEnemies, enemies.length);
    metrics.peakRegularEnemies = Math.max(metrics.peakRegularEnemies, enemies.filter((enemy) => !enemy.variant && enemy.type !== "colossoCaldeira").length);
    metrics.peakAlphaEnemies = Math.max(metrics.peakAlphaEnemies, enemies.filter((enemy) => enemy.variant === "alpha").length);
    metrics.peakBossEnemies = Math.max(metrics.peakBossEnemies, enemies.filter((enemy) => enemy.type === "colossoCaldeira").length);
    metrics.peakProjectiles = Math.max(metrics.peakProjectiles, session.projectiles.filter((projectile) => projectile.active !== false).length);
    metrics.peakTemporaryHazards = Math.max(metrics.peakTemporaryHazards, (session.temporaryMagmaHazards || []).filter((hazard) => hazard.active).length);
    metrics.peakPermanentHazards = Math.max(metrics.peakPermanentHazards, (session.permanentThermalHazards || []).length);
    metrics.maximumQueueSize = Math.max(metrics.maximumQueueSize, session.queue.length);
    const critical = [...enemies, ...(session.troops || []), ...(session.projectiles || [])];
    if (critical.some((entity) => [entity.x, entity.y, entity.hp].some((value) => value != null && !finite(value)))) {
      metrics.invalidNumbers += 1;
      throw new Error(`seed ${seed}: NaN/Infinity detectado`);
    }
    if (boss?.dead && !(session.permanentThermalHazards || []).length && !(session.temporaryMagmaHazards || []).some((hazard) => hazard.active)) {
      metrics.outcome = "boss-clean";
      break;
    }
  }
  const finalBoss = session.enemies.find((enemy) => enemy.type === "colossoCaldeira") || bossRef;
  if (finalBoss && !finalBoss.dead) {
    finalBoss.hp = 0;
    for (let index = 0; index < 30 && !finalBoss.dead; index += 1) stepBattle(session, 100);
  }
  if (finalBoss && !finalBoss.dead) throw new Error(`seed ${seed}: boss não concluiu a morte`);
  for (let index = 0; index < 20; index += 1) stepBattle(session, 100);
  if ((session.permanentThermalHazards || []).length || (session.temporaryMagmaHazards || []).some((hazard) => hazard.active)) {
    throw new Error(`seed ${seed}: hazards do boss não foram limpos`);
  }
  metrics.outcome = finalBoss ? "boss-clean" : (session.outcome || "timeout");
  if (metrics.peakRegularEnemies > phase.waves[5].maximumLivingEnemies) {
    throw new Error(`seed ${seed}: limite de inimigos comuns excedido (${metrics.peakRegularEnemies})`);
  }
  metrics.averageStepMs = metrics.totalSteps ? metrics.stepMsTotal / metrics.totalSteps : 0;
  return metrics;
}

const reports = [];
for (let seed = 1; seed <= seedCount; seed += 1) reports.push(runSeed(seed));
const deterministicFirst = runSeed(48123);
const deterministicSecond = runSeed(48123);
const deterministicView = (report) => {
  const { stepMsTotal, stepMsMax, averageStepMs, ...stable } = report;
  return stable;
};
if (JSON.stringify(deterministicView(deterministicFirst)) !== JSON.stringify(deterministicView(deterministicSecond))) {
  throw new Error("seed 48123 não é determinística");
}
const summary = {
  seeds: seedCount,
  reports,
  deterministicCheck: { equal: true, summary: deterministicView(deterministicFirst) },
};
console.log(JSON.stringify(summary, null, 2));
