export const SIMULATION_VERSION = 1;

export const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  stepMs: 32,
  agentTickMs: 160,
  validationEveryMs: 1000,
  maximumDurationMs: 30 * 60 * 1000,
  maximumStagnationMs: 90 * 1000,
  preparationLimitMs: 18 * 1000,
  intermissionLimitMs: 12 * 1000,
  maximumActionsPerTick: 4,
  actionLogLimit: 600,
  collectEnergyPickups: true,
  allowAdaptiveAid: true,
  accelerateOutros: false,
  validateEveryStep: false,
});

export const QUICK_CAMPAIGN_SEEDS = Object.freeze([
  1001,
  1002,
  1003,
]);

export const DEFAULT_CAMPAIGN_SEEDS = Object.freeze([
  1001,
  1013,
  1031,
  1061,
  1091,
  1123,
  1151,
  1181,
  1213,
  1237,
]);

export const STRATEGY_IDS = Object.freeze([
  "balanced",
  "defensive",
  "economic",
  "aggressive",
]);

export function normalizeSimulationConfig(
  overrides = {},
) {
  const config = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...overrides,
  };

  const positiveNumber = (
    value,
    fallback,
  ) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : fallback;
  };

  return {
    ...config,
    stepMs: positiveNumber(
      config.stepMs,
      DEFAULT_SIMULATION_CONFIG.stepMs,
    ),
    agentTickMs: positiveNumber(
      config.agentTickMs,
      DEFAULT_SIMULATION_CONFIG.agentTickMs,
    ),
    validationEveryMs: positiveNumber(
      config.validationEveryMs,
      DEFAULT_SIMULATION_CONFIG.validationEveryMs,
    ),
    maximumDurationMs: positiveNumber(
      config.maximumDurationMs,
      DEFAULT_SIMULATION_CONFIG.maximumDurationMs,
    ),
    maximumStagnationMs: positiveNumber(
      config.maximumStagnationMs,
      DEFAULT_SIMULATION_CONFIG.maximumStagnationMs,
    ),
    preparationLimitMs: positiveNumber(
      config.preparationLimitMs,
      DEFAULT_SIMULATION_CONFIG.preparationLimitMs,
    ),
    intermissionLimitMs: positiveNumber(
      config.intermissionLimitMs,
      DEFAULT_SIMULATION_CONFIG.intermissionLimitMs,
    ),
    maximumActionsPerTick: Math.max(
      1,
      Math.floor(
        positiveNumber(
          config.maximumActionsPerTick,
          DEFAULT_SIMULATION_CONFIG.maximumActionsPerTick,
        ),
      ),
    ),
    actionLogLimit: Math.max(
      0,
      Math.floor(
        positiveNumber(
          config.actionLogLimit,
          DEFAULT_SIMULATION_CONFIG.actionLogLimit,
        ),
      ),
    ),
    collectEnergyPickups: (
      config.collectEnergyPickups !== false
    ),
    allowAdaptiveAid: (
      config.allowAdaptiveAid !== false
    ),
    accelerateOutros: Boolean(
      config.accelerateOutros,
    ),
    validateEveryStep: Boolean(
      config.validateEveryStep,
    ),
  };
}
