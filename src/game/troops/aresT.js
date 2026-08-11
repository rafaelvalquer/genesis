import { isSessionMagmaCell } from "../thermalTerrain.js";

export function isAresT(troop) {
  return troop?.type === "aresT";
}

export function isAresOnMagma(session, troop, config) {
  return Boolean(isAresT(troop) && config?.thermalShield?.onlyOnMagma
    && isSessionMagmaCell(session, troop.row, troop.col));
}

export function updateAresThermalShields(session, events) {
  const activePhase = Boolean(session.waveActive || session.sandbox);
  for (const troop of session.troops || []) {
    if (!isAresT(troop) || troop.dead) continue;
    const config = session.troopConfigs?.[troop.type];
    const shield = config?.thermalShield;
    if (!shield) continue;

    if (!activePhase) {
      if (troop.thermalShieldPausedAt == null) troop.thermalShieldPausedAt = session.elapsed;
      continue;
    }
    if (troop.thermalShieldPausedAt != null) {
      const pausedMs = Math.max(0, session.elapsed - troop.thermalShieldPausedAt);
      if (Number.isFinite(troop.thermalShieldNextPulseAt)) troop.thermalShieldNextPulseAt += pausedMs;
      troop.thermalShieldPausedAt = null;
    }
    if (!isAresOnMagma(session, troop, config)) continue;
    if (!Number.isFinite(troop.thermalShieldNextPulseAt)) {
      troop.thermalShieldNextPulseAt = session.elapsed + shield.pulseEveryMs;
    }
    while (session.elapsed >= troop.thermalShieldNextPulseAt) {
      const before = troop.thermalShieldHp;
      troop.thermalShieldHp = Math.min(shield.maxHp, troop.thermalShieldHp + shield.gainHp);
      troop.thermalShieldNextPulseAt += shield.pulseEveryMs;
      if (troop.thermalShieldHp > before) {
        session.thermalMetrics.aresShieldGained += troop.thermalShieldHp - before;
        events.push({ type: "aresThermalShieldGain", targetId: troop.id, amount: troop.thermalShieldHp - before, current: troop.thermalShieldHp, max: shield.maxHp, x: troop.x, y: troop.y - 54 });
      }
    }
  }
}

export function getAresFireBonus(troop, target, targetConfig) {
  return isAresT(troop) && targetConfig?.traits?.includes("fire")
    ? 1.2
    : 1;
}
