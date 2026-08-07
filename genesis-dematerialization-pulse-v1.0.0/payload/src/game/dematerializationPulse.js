import { CELL, FIELD } from "./visualGeometry.js";

export const DEMATERIALIZATION_PULSE = Object.freeze({
  damage: 500,
  chargeDurationMs: 2000,
  beamDurationMs: 360,
  disintegrationDurationMs: 420,
  scorchMarkDurationMs: 6000,
});

export function createDematerializationPulseState(row) {
  return {
    id: `dematerialization_pulse_${row}`,
    row,
    state: "ready",
    chargeStartedAt: null,
    fireAt: null,
    activationSource: null,
    activationReason: null,
  };
}

export function getDematerializationPulseForRow(session, row) {
  return session?.dematerializationPulses?.find((pulse) => pulse.row === row) || null;
}

export function canActivateDematerializationPulse(session, row, options = {}) {
  const pulse = getDematerializationPulseForRow(session, row);
  if (!pulse) return { ok: false, reason: "Canhão da rota não encontrado.", pulse: null };
  if (pulse.state !== "ready") {
    return {
      ok: false,
      reason: pulse.state === "charging" ? "Canhão já está carregando." : "Canhão desta rota já foi utilizado.",
      pulse,
    };
  }
  if (session?.outcome) return { ok: false, reason: "A batalha já foi encerrada.", pulse };
  if (!(session?.waveActive || session?.sandbox)) {
    return { ok: false, reason: "O canhão só pode ser ativado durante uma onda.", pulse };
  }
  if (options.requireTargets && !options.hasTargets) {
    return { ok: false, reason: "Não há inimigos válidos nesta rota.", pulse };
  }
  return { ok: true, pulse };
}

export function beginDematerializationPulse(session, row, options = {}) {
  const events = options.events || [];
  const validation = canActivateDematerializationPulse(session, row, options);
  if (!validation.ok) return { ...validation, events: [] };

  const { pulse } = validation;
  pulse.state = "charging";
  pulse.chargeStartedAt = session.elapsed;
  pulse.fireAt = session.elapsed + DEMATERIALIZATION_PULSE.chargeDurationMs;
  pulse.activationSource = options.source || "player";
  pulse.activationReason = options.reason || null;

  const event = {
    type: "pulseCharging",
    row: pulse.row,
    cannonId: pulse.id,
    source: pulse.activationSource,
    reason: pulse.activationReason,
    startedAt: pulse.chargeStartedAt,
    fireAt: pulse.fireAt,
    damagePerTarget: DEMATERIALIZATION_PULSE.damage,
    x: FIELD.combatOffsetX - 4,
    y: pulse.row * CELL.height + CELL.height / 2,
    color: "#22d3ee",
  };
  events.push(event);
  return { ok: true, pulse, event, events: [event] };
}

export function estimateDematerializationPulseValue(enemies, damage = DEMATERIALIZATION_PULSE.damage) {
  const living = (enemies || []).filter((enemy) => !enemy.dead && Number(enemy.hp) > 0);
  return living.reduce((summary, enemy) => {
    const hp = Math.max(0, Number(enemy.hp) || 0);
    const effectiveDamage = Math.min(hp, damage);
    summary.enemyCount += 1;
    summary.potentialDamage += effectiveDamage;
    if (hp <= damage) summary.potentialKills += 1;
    return summary;
  }, {
    enemyCount: 0,
    potentialDamage: 0,
    potentialKills: 0,
  });
}

export function calculateDematerializationPulseCollapseScore(lane) {
  if (!lane) return 0;
  const timeToBase = Number(lane.lowestTimeToBaseMs);
  const proximityPressure = !Number.isFinite(timeToBase)
    ? 0
    : timeToBase < 3000 ? 12
      : timeToBase < 5000 ? 6
        : timeToBase < 8000 ? 3
          : 0;
  const noFrontlinePenalty = Number(lane.activeThreat || 0) > 0 && !lane.hasFrontline ? 8 : 0;
  return Math.max(0,
    Number(lane.risk || 0)
    + Number(lane.criticalTroops || 0) * 4
    + noFrontlinePenalty
    + (lane.bossThreat ? 5 : 0)
    + proximityPressure,
  );
}
