import { ENEMIES, TROOPS } from "../content.js";
import { CELL, FIELD } from "../visualGeometry.js";

export const WAVE_OUTRO_TIMINGS = Object.freeze({
  finalKillSlowMotionMs: 600,
  cleanupMs: 400,
  waveCompletedBannerMs: 2000,
  tacticalAdvantageIntroMs: 1100,
  totalMs: 4100,
});

const phaseEnds = Object.freeze({
  finalKill: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs,
  cleanup: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs + WAVE_OUTRO_TIMINGS.cleanupMs,
  banner: WAVE_OUTRO_TIMINGS.totalMs - WAVE_OUTRO_TIMINGS.tacticalAdvantageIntroMs,
  decisionIntro: WAVE_OUTRO_TIMINGS.totalMs,
});
const minimumBannerVisibleBeforeSkipMs = 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function isWaveOutroActive(session) {
  return Boolean(session?.waveOutro?.status && !["idle", "completed"].includes(session.waveOutro.status));
}

export function getWaveOutroCinematicFactor(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro) return 1;
  if (outro.status === "finalKill") return 0.3;
  if (outro.status === "cleanup") {
    const cleanupElapsed = Math.max(0, outro.elapsedMs - phaseEnds.finalKill);
    return 0.3 + 0.7 * Math.min(1, cleanupElapsed / WAVE_OUTRO_TIMINGS.cleanupMs);
  }
  return 1;
}

export function accelerateWaveOutro(session) {
  const outro = session?.waveOutro;
  const earliestSkipAt = phaseEnds.cleanup + minimumBannerVisibleBeforeSkipMs;
  if (outro?.status !== "waveCompleteBanner" || outro.elapsedMs < earliestSkipAt) return false;
  outro.elapsedMs = Math.max(outro.elapsedMs, phaseEnds.banner);
  return true;
}

function restoreTroopsForPlanning(session) {
  session.deployCooldowns = {};
  session.troops.forEach((troop) => {
    if (troop.dead) return;
    const config = TROOPS[troop.type];
    troop.attackReadyAt = session.elapsed;
    troop.mineReadyAt = session.elapsed;
    troop.gunReadyAt = session.elapsed;
    troop.interceptionReadyAt = config?.interceptionCooldownMs ? session.elapsed : Infinity;
    troop.specialReadyAt = config?.specialEveryMs ? session.elapsed : Infinity;
    if (config?.attack === "energy") troop.energyAccumulator = config.attackEveryMs;
    troop.state = "idle";
    troop.stateStartedAt = session.elapsed;
    troop.stateEndsAt = Infinity;
    troop.attackStartedAt = -Infinity;
    troop.lastAttackAt = -Infinity;
    troop.attackTargetId = null;
    troop.attackReleased = false;
    troop.attackReleaseAt = Infinity;
    troop.lastAttackMode = null;
    troop.attackBusyUntil = session.elapsed;
    troop.channelingAttack = false;
    troop.channelTickAccumulator = 0;
    troop.pendingImpact = null;
    troop.pendingComboImpact = null;
    troop.pendingRepulsorShot = null;
    troop.specialRequested = false;
    troop.comboStep = 0;
    troop.comboTargetId = null;
    troop.comboExpiresAt = null;
    troop.defenseActive = false;
    troop.defenseThreatId = null;
    troop.defenseExitAt = null;
    troop.icaroLockedTargetIds = [];
    troop.healTargetId = null;
    troop.healedThisCharge = 0;
    troop.lastHealPulseAt = -Infinity;
    troop.cooldownStartedAt = null;
    troop.cooldownEndsAt = null;
    troop.electricStacks = 0;
    troop.electricStacksExpireAt = session.elapsed;
    troop.electricParalyzedUntil = session.elapsed;
    troop.electricImmunityUntil = session.elapsed;
    troop.electricConductivityUntil = session.elapsed;
    troop.electricVulnerabilityUntil = session.elapsed;
    troop.electricReactorPausedUntil = session.elapsed;
    troop.webSlowUntil = session.elapsed;
    troop.webRangePenaltyUntil = session.elapsed;
  });
}

export function advanceWaveOutroState(session, realDt = 0, { finish, adaptiveAidBlocksIntermission }) {
  if (!isWaveOutroActive(session)) return [];
  const outro = session.waveOutro;
  const events = [];
  outro.elapsedMs += Math.max(0, Number(realDt) || 0);
  let transitioned = true;
  while (transitioned) {
    transitioned = false;
    if (outro.status === "finalKill" && outro.elapsedMs >= phaseEnds.finalKill) {
      outro.status = "cleanup";
      events.push({ type: "waveOutroCleanup", wave: outro.completedWave });
      transitioned = true;
    } else if (outro.status === "cleanup" && outro.elapsedMs >= phaseEnds.cleanup) {
      outro.status = "waveCompleteBanner";
      events.push({ type: "waveCompleteBanner", wave: outro.completedWave, killed: outro.killed, integrity: outro.integrityPercent, survivors: outro.survivors, energyGained: outro.energyGained });
      transitioned = true;
    } else if (outro.status === "waveCompleteBanner" && outro.elapsedMs >= phaseEnds.banner) {
      outro.status = outro.finalWave ? "victoryIntro" : "decisionIntro";
      events.push({ type: outro.finalWave ? "victoryIntro" : "decisionIntro", wave: outro.completedWave });
      transitioned = true;
    } else if (["decisionIntro", "victoryIntro"].includes(outro.status) && outro.elapsedMs >= phaseEnds.decisionIntro) {
      outro.status = "completed";
      if (outro.finalWave) {
        if (!adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) finish(session, "victory");
      } else {
        restoreTroopsForPlanning(session);
        session.pendingDecisionLevel = outro.decisionLevel;
        session.pendingDecision = outro.decisionOptions;
        session.preparing = true;
        events.push({ type: "waveDecisionReady", wave: outro.completedWave });
      }
      transitioned = true;
    }
  }
  return events;
}

export function getRouteTelemetry(session, enemyOccupiesTargetRow) {
  const activeEnemies = session.enemies.filter((enemy) => !enemy.dead);
  const queue = session.queue || [];
  const scheduledAlphas = (session.alphaPressure?.pendingSpawns || []).map((entry) => ({
    ...entry,
    startsInMs: Math.max(0, (entry.spawnAt || 0) - (session.elapsed || 0)),
  }));
  const wind = session.windCurrent || {};
  const affectedWindRows = new Set(wind.state === "active" ? [...(wind.selectedRows || []), wind.sourceRow, wind.targetRow].filter((row) => Number.isInteger(row) && row >= 0 && row < FIELD.rows) : []);
  const sandstormActive = session.sandstorm?.state === "active";
  return Array.from({ length: FIELD.rows }, (_, row) => {
    const enemies = activeEnemies.filter((enemy) => enemyOccupiesTargetRow(enemy, row));
    const nearest = enemies.reduce((current, enemy) => (!current || enemy.x < current.x ? enemy : current), null);
    const advance = nearest ? clamp(((FIELD.spawnX - nearest.x) / (FIELD.spawnX - FIELD.baseX)) * 100, 0, 100) : 0;
    const activeSpecial = enemies.find((enemy) => enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss);
    const queuedSpecial = [...queue.filter((entry) => (Number.isInteger(entry.row) ? entry.row : 0) === row).filter((entry) => entry.variant === "alpha" || ENEMIES[entry.type]?.boss).map((entry) => ({ ...entry, startsInMs: Math.max(0, ((session.waveStartedAt || 0) + entry.spawnAtMs) - (session.elapsed || 0)) })), ...scheduledAlphas.filter((entry) => entry.row === row)].sort((left, right) => left.startsInMs - right.startsInMs)[0];
    const imminentSpecial = queuedSpecial?.startsInMs <= 5000 ? queuedSpecial : null;
    const environmentalDanger = sandstormActive || affectedWindRows.has(row);
    const pressure = Math.round(clamp(advance * 0.75 + Math.min(15, enemies.length * 3) + (activeSpecial || imminentSpecial ? 10 : 0) + (environmentalDanger ? 5 : 0), 0, 100));
    const state = pressure >= 70 ? "critical" : pressure >= 35 ? "pressure" : pressure > 0 ? "attention" : "stable";
    const special = activeSpecial || imminentSpecial;
    return { row, state, pressure, activeCount: enemies.length, nearestAdvance: Math.round(advance), nearestThreat: nearest ? { label: ENEMIES[nearest.type]?.label || nearest.type, advance: Math.round(advance) } : null, imminentThreat: imminentSpecial ? { label: ENEMIES[imminentSpecial.type]?.label || imminentSpecial.type, startsInMs: imminentSpecial.startsInMs } : null, isAlpha: Boolean(special?.variant === "alpha"), isBoss: Boolean(special && ENEMIES[special.type]?.boss), fortified: session.fortifiedRow === row, environmentalDanger };
  });
}

export function cellFromPoint(x, y) {
  return { row: clamp(Math.floor(y / CELL.height), 0, FIELD.rows - 1), col: clamp(Math.floor(x / CELL.width), 0, FIELD.cols - 1) };
}
