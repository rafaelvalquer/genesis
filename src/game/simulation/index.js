export {
  runBattleSimulation,
} from "./engine/runSimulation.js";

export {
  createHeadlessSession,
} from "./engine/createHeadlessSession.js";

export {
  createBattleObservation,
} from "./observation/createBattleObservation.js";

export {
  createLaneThreatMap,
  getMostThreatenedLane,
} from "./observation/laneThreatMap.js";

export {
  planLoadoutForPhase,
  generateLoadoutCandidates,
  describeLoadout,
} from "./planners/LoadoutPlanner.js";

export {
  createPhaseForecast,
  getCurrentWaveForecast,
} from "./planners/phaseForecast.js";

export {
  planReplacementActions,
} from "./planners/ReplacementPlanner.js";

export {
  validateSimulationState,
  createProgressFingerprint,
  StagnationDetector,
  SimulationValidationError,
} from "./engine/simulationValidation.js";

export {
  STRATEGY_PROFILES,
  resolveStrategyProfile,
} from "./strategies/strategyProfiles.js";

export {
  DEFAULT_SIMULATION_CONFIG,
  QUICK_CAMPAIGN_SEEDS,
  DEFAULT_CAMPAIGN_SEEDS,
  STRATEGY_IDS,
  normalizeSimulationConfig,
} from "./simulationConfig.js";

export {
  createSimulationCacheKey,
  SimulationCache,
} from "./optimization/SimulationCache.js";
