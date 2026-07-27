export const ELECTRIC_CHARGE = Object.freeze({
  maxStacks: 3,
  stackDurationMs: 6000,
  paralysisDurationMs: 2000,
  paralysisImmunityMs: 3000,
  conductivityDurationMs: 5000,
  structureVulnerabilityMs: 4000,
  structureDamageFactor: 1.15,
  reactorPauseMs: 4000,
});

export function initializeElectricState(entity) {
  entity.electricStacks ??= 0;
  entity.electricStacksExpireAt ??= 0;
  entity.electricParalyzedUntil ??= 0;
  entity.electricImmunityUntil ??= 0;
  entity.electricConductivityUntil ??= 0;
  entity.electricVulnerabilityUntil ??= 0;
  entity.electricReactorPausedUntil ??= 0;
  return entity;
}

export function expireElectricState(entity, now) {
  initializeElectricState(entity);
  if (entity.electricStacks > 0 && now >= entity.electricStacksExpireAt) {
    entity.electricStacks = 0;
    entity.electricStacksExpireAt = 0;
  }
  return entity;
}

export function isElectricParalyzed(entity, now) {
  return Number(entity?.electricParalyzedUntil || 0) > now;
}

export function applyElectricParalysis(
  entity,
  now,
  durationMs = ELECTRIC_CHARGE.paralysisDurationMs,
) {
  initializeElectricState(entity);
  if (now < entity.electricImmunityUntil) return false;
  entity.electricParalyzedUntil = Math.max(
    entity.electricParalyzedUntil,
    now + durationMs,
  );
  entity.electricImmunityUntil =
    entity.electricParalyzedUntil + ELECTRIC_CHARGE.paralysisImmunityMs;
  return true;
}

export function applyConductivity(
  entity,
  now,
  durationMs = ELECTRIC_CHARGE.conductivityDurationMs,
) {
  initializeElectricState(entity);
  entity.electricConductivityUntil = Math.max(
    entity.electricConductivityUntil,
    now + durationMs,
  );
}

export function applyElectricCharge(
  entity,
  now,
  {
    stacks = 1,
    troopType = entity?.type,
    paralysisDurationMs = ELECTRIC_CHARGE.paralysisDurationMs,
  } = {},
) {
  initializeElectricState(entity);
  expireElectricState(entity, now);
  const conductivityActive = now < entity.electricConductivityUntil;
  const appliedStacks = conductivityActive ? Math.max(2, stacks) : stacks;
  if (conductivityActive) entity.electricConductivityUntil = 0;
  entity.electricStacks = Math.min(
    ELECTRIC_CHARGE.maxStacks,
    entity.electricStacks + appliedStacks,
  );
  entity.electricStacksExpireAt = now + ELECTRIC_CHARGE.stackDurationMs;

  const result = {
    appliedStacks,
    stacks: entity.electricStacks,
    conductivityConsumed: conductivityActive,
    paralyzed: false,
    reactorPaused: false,
    structureExposed: false,
  };
  if (entity.electricStacks < ELECTRIC_CHARGE.maxStacks) return result;

  entity.electricStacks = 0;
  entity.electricStacksExpireAt = 0;
  result.paralyzed = applyElectricParalysis(entity, now, paralysisDurationMs);
  if (troopType === "reator") {
    entity.electricReactorPausedUntil = Math.max(
      entity.electricReactorPausedUntil,
      now + ELECTRIC_CHARGE.reactorPauseMs,
    );
    result.reactorPaused = true;
  }
  if (troopType === "muralhaReforcada") {
    entity.electricVulnerabilityUntil = Math.max(
      entity.electricVulnerabilityUntil,
      now + ELECTRIC_CHARGE.structureVulnerabilityMs,
    );
    result.structureExposed = true;
  }
  return result;
}

export function electricDamageTakenFactor(entity, now) {
  return now < Number(entity?.electricVulnerabilityUntil || 0)
    ? ELECTRIC_CHARGE.structureDamageFactor
    : 1;
}
