import { CELL, FIELD } from "./visualGeometry.js";

export const TIDE_CYCLE_STATES = Object.freeze([
  "stable",
  "warningAdvance",
  "rising",
  "warningRetreat",
  "receding",
  "drying",
]);

export const TIDE_CELL_TYPES = Object.freeze({
  FIRM_GROUND: "firmGround",
  INTERTIDAL: "intertidal",
  DEEP_WATER: "deepWater",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
};
const cellKey = (row, col) => `${row}:${col}`;
const copyCells = (cells = []) => cells.map(([row, col]) => [row, col]);
const copyBands = (bands = []) => bands.map((band) => ({
  level: Number(band.level) || 0,
  cells: copyCells(band.cells),
}));
const livingTroops = (session) => session.troops.filter((troop) => !troop.dead);
const TERRITORY_CACHE = new WeakMap();

function validCell([row, col]) {
  return Number.isInteger(row)
    && row >= 0
    && row < FIELD.rows
    && Number.isInteger(col)
    && col >= FIELD.firstTroopCol
    && col <= FIELD.lastTroopCol;
}

function isEnemyEntryWaterCell(row, col) {
  return Number.isInteger(row)
    && row >= 0
    && row < FIELD.rows
    && Number.isInteger(col)
    && col === FIELD.enemyEntryCol;
}

function uniqueCells(cells = []) {
  const seen = new Set();
  return cells.filter(validCell).filter(([row, col]) => {
    const key = cellKey(row, col);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function columnCells(fromCol, toCol = fromCol) {
  const start = clamp(Math.min(fromCol, toCol), FIELD.firstTroopCol, FIELD.lastTroopCol);
  const end = clamp(Math.max(fromCol, toCol), FIELD.firstTroopCol, FIELD.lastTroopCol);
  const cells = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = start; col <= end; col += 1) cells.push([row, col]);
  }
  return cells;
}

function normalizeBands(bands = []) {
  return bands
    .map((band, index) => ({
      level: Number.isInteger(band.level) ? band.level : index + 1,
      cells: uniqueCells(band.cells),
    }))
    .filter((band) => band.level > 0 && band.cells.length)
    .sort((left, right) => left.level - right.level);
}

export function createTideCycleHazard(chapterIndex = 0, overrides = {}) {
  const legacyFloodedFromCol = Number.isFinite(overrides.floodedFromCol)
    ? Math.round(overrides.floodedFromCol)
    : Math.max(5, 8 - Math.floor(chapterIndex / 2));
  const permanentWaterCells = uniqueCells(
    overrides.permanentWaterCells || columnCells(FIELD.lastTroopCol),
  );
  const suppliedBands = overrides.intertidalBands || [{
    level: 1,
    cells: columnCells(legacyFloodedFromCol, FIELD.lastTroopCol - 1),
  }];
  const intertidalBands = normalizeBands(suppliedBands);
  const maximumLevel = Math.max(
    0,
    Number.isInteger(overrides.maximumLevel)
      ? overrides.maximumLevel
      : intertidalBands.reduce((highest, band) => Math.max(highest, band.level), 0),
  );
  const initialLevel = clamp(Number(overrides.initialLevel) || 0, 0, maximumLevel);

  return {
    id: "tide_cycle",
    mode: "territorial_progressive",
    minTroops: 5,
    permanentWaterCells,
    intertidalBands,
    initialLevel,
    maximumLevel,
    minimumLevelByWave: [0, 0, 0, 0, 0, 0],
    minimumSafeCells: 15,

    firstEvaluationDelayMs: 18000,
    evaluationIntervalMs: chapterIndex === 7 ? 10000 : 12000,
    minimumStableMs: 9000,
    warningAdvanceMs: 3000,
    warningRetreatMs: 1800,
    risingMs: 1800,
    recedingMs: 1800,
    dryingMs: 800,

    baseAdvanceChance: 0.12 + chapterIndex * 0.012,
    maximumAdvanceChance: Math.min(0.75, 0.45 + chapterIndex * 0.04),
    maximumDensityBonus: 0.24 + chapterIndex * 0.008,
    advanceChancePerWave: 0.012 + chapterIndex * 0.001,
    lossAdvanceSuppression: 0.42,
    stabilityStepMs: 20000,
    stabilityBonusPerStep: 0.02,
    maximumStabilityBonus: 0.08,

    baseRetreatChance: 0.08,
    maximumRetreatChance: Math.max(0.28, 0.55 - chapterIndex * 0.035),
    maximumLossRetreatBonus: 0.38,
    lowPopulationBonus: 0.15,
    lowPopulationThreshold: 5,
    prolongedFloodReliefAfterMs: 30000,
    maximumProlongedFloodRelief: 0.08,
    retreatPenaltyPerWave: 0.008 + chapterIndex * 0.001,

    densityStartTroops: 7,
    densityMaximumTroops: 18,
    recentLossWindowMs: 18000,
    criticalLossRatio: 0.30,
    emergencyRetreatChance: 0.65,
    lossPressureStartRatio: 0.10,
    lossPressureMaximumRatio: 0.35,
    intermissionRetreatLossRatio: 0.25,

    enemySpeedFactor: 1.15 + Math.min(0.15, chapterIndex * 0.02),
    enemySlowResistance: chapterIndex < 2 ? 0 : chapterIndex < 4 ? 0.10 : chapterIndex < 6 ? 0.20 : 0.30,
    submergedAttackSpeedFactor: Math.max(0.70, 0.95 - chapterIndex * 0.035),
    pressureGraceMs: 2000,
    pressureDurationMs: 5000,
    pressureMaximumHpRatio: [0, 0.08, 0.10, 0.12, 0.15, 0.18, 0.22, 0.28][chapterIndex] || 0,
    disableMinesWhenFlooded: chapterIndex >= 3,
    pauseReactorsWhenFlooded: chapterIndex >= 4,

    blockDeploymentInFloodedCells: true,
    keepExistingTroops: true,
    manualRemovalCountsAsLoss: false,

    // Legacy aliases kept so older UI/tests do not break while the installer patches the game.
    firstCheckDelayMs: 18000,
    checkEveryMs: chapterIndex === 7 ? 10000 : 12000,
    warningMs: 3000,
    highDurationMs: 0,
    repeatLossToleranceRatio: 0,
    floodedFromCol: legacyFloodedFromCol,

    ...overrides,
    permanentWaterCells,
    intertidalBands,
    initialLevel,
    maximumLevel,
  };
}

export function createTideCycleState() {
  return {
    initialized: false,
    state: "stable",
    currentLevel: 0,
    targetLevel: 0,
    warningStartedAt: -Infinity,
    warningEndsAt: Infinity,
    transitionStartedAt: -Infinity,
    transitionEndsAt: Infinity,
    dryingStartedAt: -Infinity,
    dryingEndsAt: Infinity,
    nextEvaluationAt: Infinity,
    lastEvaluationAt: -Infinity,
    lastTransitionAt: -Infinity,
    levelReachedAt: 0,
    transitionSequence: 0,
    levelFloodEpochs: {},
    advancesThisWave: 0,
    retreatsThisWave: 0,
    recentTroopLosses: [],
    waveStartedPopulation: 0,
    wavePeakPopulation: 0,
    waveLossPopulation: 0,
    troopPopulation: 0,
    recentLossPopulation: 0,
    recentLossRatio: 0,
    densityRatio: 0,
    lossPressure: 0,
    pressureScore: 0,
    advanceChance: 0,
    retreatChance: 0,
    minimumLevel: 0,
    maximumLevel: 0,
    warningCells: [],
    dryingCells: [],
    submergedTroopIds: [],
    eliminatedTroopIds: [],
    floodedFromCol: FIELD.enemyEntryCol,
    tidesThisWave: 0,
    troopCountAtStart: 0,
    troopCountAtEnd: 0,
    troopLossCount: 0,
    troopLossRatio: 0,
    repeatLossToleranceRatio: 0,
    repeatEligible: true,
  };
}

function tideConfig(session, explicitConfig = null) {
  const config = explicitConfig || session?.phase?.environmentHazard;
  return config?.id === "tide_cycle" ? config : null;
}

function levelMinimumForWave(session, config) {
  const levels = Array.isArray(config.minimumLevelByWave) ? config.minimumLevelByWave : [];
  const configured = Number(levels[session.waveIndex] ?? levels.at(-1) ?? 0);
  return clamp(Number.isFinite(configured) ? configured : 0, 0, config.maximumLevel || 0);
}

export function getTideTroopPopulation(session) {
  return livingTroops(session).reduce((total, troop) => (
    total + (troop.type === "droneSentinela" ? Math.max(1, Number(troop.droneCount) || 1) : 1)
  ), 0);
}

function troopPopulationValue(troop) {
  return troop?.type === "droneSentinela"
    ? Math.max(1, Number(troop.droneCount) || 1)
    : 1;
}

function bandForLevel(config, level) {
  return config.intertidalBands?.find((band) => Number(band.level) === Number(level)) || null;
}

function territoryCache(config) {
  let cached = TERRITORY_CACHE.get(config);
  if (cached) return cached;
  const deepWaterKeys = new Set((config.permanentWaterCells || []).map(([row, col]) => cellKey(row, col)));
  const levelByCell = new Map();
  const bandByLevel = new Map();
  for (const band of config.intertidalBands || []) {
    bandByLevel.set(Number(band.level), band);
    for (const [row, col] of band.cells || []) levelByCell.set(cellKey(row, col), Number(band.level));
  }
  cached = { deepWaterKeys, levelByCell, bandByLevel };
  TERRITORY_CACHE.set(config, cached);
  return cached;
}

function deepWaterSet(config) {
  return territoryCache(config).deepWaterKeys;
}

function bandLevelForCell(config, row, col) {
  return territoryCache(config).levelByCell.get(cellKey(row, col)) ?? null;
}

function cellsAtOrBelowLevel(config, level) {
  return uniqueCells((config.intertidalBands || [])
    .filter((band) => band.level <= level)
    .flatMap((band) => band.cells));
}

function floodedCellsForLevel(config, level) {
  return uniqueCells([
    ...(config.permanentWaterCells || []),
    ...cellsAtOrBelowLevel(config, level),
  ]);
}

function deployableCellCountAtLevel(config, level) {
  const total = FIELD.rows * (FIELD.lastTroopCol - FIELD.firstTroopCol + 1);
  return total - floodedCellsForLevel(config, level).length;
}

export function getTideCellState(session, row, col) {
  const config = tideConfig(session);
  const tide = session?.tideCycle;
  if (config && tide && isEnemyEntryWaterCell(row, col)) {
    return {
      type: TIDE_CELL_TYPES.DEEP_WATER,
      status: "deep",
      flooded: true,
      deployable: false,
      level: 0,
    };
  }

  if (!config || !tide || !validCell([row, col])) {
    return {
      type: TIDE_CELL_TYPES.FIRM_GROUND,
      status: "firm",
      flooded: false,
      deployable: true,
      level: null,
    };
  }

  const key = cellKey(row, col);
  if (deepWaterSet(config).has(key)) {
    return {
      type: TIDE_CELL_TYPES.DEEP_WATER,
      status: "deep",
      flooded: true,
      deployable: false,
      level: 0,
    };
  }

  const level = bandLevelForCell(config, row, col);
  if (level == null) {
    return {
      type: TIDE_CELL_TYPES.FIRM_GROUND,
      status: "firm",
      flooded: false,
      deployable: true,
      level: null,
    };
  }

  const warning = tide.warningCells.some(([candidateRow, candidateCol]) => (
    candidateRow === row && candidateCol === col
  ));
  const drying = tide.dryingCells.some(([candidateRow, candidateCol]) => (
    candidateRow === row && candidateCol === col
  ));
  const advancingBand = tide.state === "rising" && level === tide.targetLevel;
  const flooded = level <= tide.currentLevel || advancingBand;
  const status = drying
    ? "drying"
    : warning && tide.state === "warningAdvance"
      ? "warningAdvance"
      : warning && tide.state === "warningRetreat"
        ? "warningRetreat"
        : flooded
          ? "flooded"
          : "dry";

  return {
    type: TIDE_CELL_TYPES.INTERTIDAL,
    status,
    flooded,
    deployable: !flooded && !drying,
    level,
  };
}

export function isTideCellFlooded(session, row, col) {
  return getTideCellState(session, row, col).flooded;
}

export function getTidePlacementBlockReason(session, row, col) {
  const config = tideConfig(session);
  if (!config?.blockDeploymentInFloodedCells) return null;
  const cell = getTideCellState(session, row, col);
  if (cell.type === TIDE_CELL_TYPES.DEEP_WATER) {
    return "Água profunda: implantação impossível nesta célula.";
  }
  if (cell.status === "drying") {
    return "Zona intermaré ainda encharcada. Aguarde o solo estabilizar.";
  }
  if (cell.flooded) {
    return "Zona intermaré alagada: aguarde o recuo da maré.";
  }
  return null;
}

function purgeOldLosses(session, config) {
  const tide = session.tideCycle;
  const cutoff = session.elapsed - config.recentLossWindowMs;
  tide.recentTroopLosses = tide.recentTroopLosses.filter((loss) => loss.at >= cutoff);
}

export function recordTideTroopElimination(session, troop, reason = "enemy") {
  const config = tideConfig(session);
  const tide = session?.tideCycle;
  if (!config || !tide || !troop?.id) return false;
  const manual = ["remove", "manualRemoval"].includes(reason);
  if (manual && !config.manualRemovalCountsAsLoss) return false;
  if (reason === "sandbox") return false;
  if (tide.eliminatedTroopIds.includes(troop.id)) return false;
  const population = troopPopulationValue(troop);
  tide.eliminatedTroopIds.push(troop.id);
  tide.recentTroopLosses.push({
    troopId: troop.id,
    at: session.elapsed,
    reason,
    population,
  });
  tide.waveLossPopulation += population;
  tide.troopLossCount = tide.eliminatedTroopIds.length;
  return true;
}

function pressureMetrics(session, config) {
  const tide = session.tideCycle;
  purgeOldLosses(session, config);
  const troopPopulation = getTideTroopPopulation(session);
  const recentLossPopulation = tide.recentTroopLosses
    .reduce((sum, loss) => sum + Number(loss.population || 1), 0);
  const recentLossRatio = recentLossPopulation
    / Math.max(1, troopPopulation + recentLossPopulation);
  const densityRange = Math.max(1, config.densityMaximumTroops - config.densityStartTroops);
  const densityRatio = clamp(
    (troopPopulation - config.densityStartTroops) / densityRange,
    0,
    1,
  );
  const lossPressure = smoothstep(
    config.lossPressureStartRatio,
    config.lossPressureMaximumRatio,
    recentLossRatio,
  );
  const stableSince = Number.isFinite(tide.lastTransitionAt)
    ? tide.lastTransitionAt
    : session.waveStartedAt;
  const stableTime = Math.max(0, session.elapsed - stableSince);
  const stabilitySteps = Math.floor(stableTime / Math.max(1, config.stabilityStepMs));
  const stabilityBonus = Math.min(
    config.maximumStabilityBonus,
    stabilitySteps * config.stabilityBonusPerStep,
  );
  const prolongedProgress = config.prolongedFloodReliefAfterMs > 0
    ? clamp((session.elapsed - tide.levelReachedAt - config.prolongedFloodReliefAfterMs)
      / config.prolongedFloodReliefAfterMs, 0, 1)
    : 0;
  const prolongedFloodRelief = tide.currentLevel > tide.minimumLevel
    ? prolongedProgress * config.maximumProlongedFloodRelief
    : 0;
  const lowPopulationRelief = troopPopulation <= config.lowPopulationThreshold
    ? config.lowPopulationBonus
    : 0;

  let advanceChance = config.baseAdvanceChance
    + densityRatio * config.maximumDensityBonus
    + session.waveIndex * config.advanceChancePerWave
    + stabilityBonus
    - lossPressure * config.lossAdvanceSuppression;
  let retreatChance = config.baseRetreatChance
    + lossPressure * config.maximumLossRetreatBonus
    + lowPopulationRelief
    + prolongedFloodRelief
    - session.waveIndex * config.retreatPenaltyPerWave;

  if (troopPopulation < config.minTroops) advanceChance = 0;
  const criticalLoss = recentLossRatio >= config.criticalLossRatio;
  if (criticalLoss) advanceChance = 0;

  advanceChance = clamp(advanceChance, 0, config.maximumAdvanceChance);
  retreatChance = clamp(retreatChance, 0, config.maximumRetreatChance);
  if (criticalLoss) {
    retreatChance = Math.max(retreatChance, clamp(config.emergencyRetreatChance, 0, 1));
  }

  tide.troopPopulation = troopPopulation;
  tide.wavePeakPopulation = Math.max(Number(tide.wavePeakPopulation || 0), troopPopulation);
  tide.recentLossPopulation = recentLossPopulation;
  tide.recentLossRatio = recentLossRatio;
  tide.densityRatio = densityRatio;
  tide.lossPressure = lossPressure;
  tide.pressureScore = clamp(densityRatio * (1 - lossPressure * 0.7), 0, 1);
  tide.advanceChance = advanceChance;
  tide.retreatChance = retreatChance;

  return {
    troopPopulation,
    recentLossPopulation,
    recentLossRatio,
    densityRatio,
    lossPressure,
    advanceChance,
    retreatChance,
  };
}

export function calculateTidePressure(session) {
  const config = tideConfig(session);
  if (!config || !session?.tideCycle) return null;
  return pressureMetrics(session, config);
}

export function calculateAdvanceChance(session) {
  return calculateTidePressure(session)?.advanceChance || 0;
}

export function calculateRetreatChance(session) {
  return calculateTidePressure(session)?.retreatChance || 0;
}

function canAdvance(session, config) {
  const tide = session.tideCycle;
  const targetLevel = tide.currentLevel + 1;
  return tide.state === "stable"
    && targetLevel <= config.maximumLevel
    && deployableCellCountAtLevel(config, targetLevel) >= config.minimumSafeCells
    && session.elapsed - tide.lastTransitionAt >= config.minimumStableMs;
}

function canRetreat(session, config) {
  const tide = session.tideCycle;
  return tide.state === "stable"
    && tide.currentLevel > tide.minimumLevel
    && session.elapsed - tide.lastTransitionAt >= config.minimumStableMs;
}

function startAdvanceWarning(session, config, events, forced = false) {
  const tide = session.tideCycle;
  const targetLevel = tide.currentLevel + 1;
  const cells = copyCells(bandForLevel(config, targetLevel)?.cells || []);
  if (!cells.length) return false;
  tide.state = "warningAdvance";
  tide.targetLevel = targetLevel;
  tide.warningStartedAt = session.elapsed;
  tide.warningEndsAt = session.elapsed + config.warningAdvanceMs;
  tide.warningCells = cells;
  tide.dryingCells = [];
  events.push({
    type: "tideAdvanceWarning",
    startsAt: tide.warningEndsAt,
    currentLevel: tide.currentLevel,
    targetLevel,
    cells: copyCells(cells),
    forced,
  });
  events.push({
    type: "tideWarning",
    startsAt: tide.warningEndsAt,
    floodedFromCol: Math.min(...cells.map(([, col]) => col)),
  });
  return true;
}

function startRetreatWarning(session, config, events, forced = false) {
  const tide = session.tideCycle;
  const targetLevel = tide.currentLevel - 1;
  const cells = copyCells(bandForLevel(config, tide.currentLevel)?.cells || []);
  if (!cells.length) return false;
  tide.state = "warningRetreat";
  tide.targetLevel = targetLevel;
  tide.warningStartedAt = session.elapsed;
  tide.warningEndsAt = session.elapsed + config.warningRetreatMs;
  tide.warningCells = cells;
  tide.dryingCells = [];
  events.push({
    type: "tideRetreatWarning",
    startsAt: tide.warningEndsAt,
    currentLevel: tide.currentLevel,
    targetLevel,
    cells: copyCells(cells),
    forced,
  });
  return true;
}

function startRising(session, config, events) {
  const tide = session.tideCycle;
  tide.state = "rising";
  tide.transitionStartedAt = session.elapsed;
  tide.transitionEndsAt = session.elapsed + config.risingMs;
  tide.transitionSequence += 1;
  tide.levelFloodEpochs[tide.targetLevel] = Number(tide.levelFloodEpochs[tide.targetLevel] || 0) + 1;
  events.push({
    type: "tideRisingStarted",
    currentLevel: tide.currentLevel,
    targetLevel: tide.targetLevel,
    highStartsAt: tide.transitionEndsAt,
    cells: copyCells(tide.warningCells),
  });
}

function completeAdvance(session, config, events) {
  const tide = session.tideCycle;
  tide.currentLevel = tide.targetLevel;
  tide.state = "stable";
  tide.warningCells = [];
  tide.transitionStartedAt = -Infinity;
  tide.transitionEndsAt = Infinity;
  tide.lastTransitionAt = session.elapsed;
  tide.levelReachedAt = session.elapsed;
  tide.advancesThisWave += 1;
  tide.tidesThisWave += 1;
  tide.troopCountAtStart = livingTroops(session).length;
  tide.floodedFromCol = getFloodedFromColumn(session);
  tide.nextEvaluationAt = session.elapsed + config.evaluationIntervalMs;
  events.push({
    type: "tideAdvanced",
    currentLevel: tide.currentLevel,
    maximumLevel: config.maximumLevel,
    enemySpeedFactor: config.enemySpeedFactor,
  });
  events.push({
    type: "tideHighStarted",
    tideNumber: tide.tidesThisWave,
    endsAt: Infinity,
    floodedFromCol: tide.floodedFromCol,
    enemySpeedFactor: config.enemySpeedFactor,
  });
}

function startReceding(session, config, events) {
  const tide = session.tideCycle;
  tide.state = "receding";
  tide.transitionStartedAt = session.elapsed;
  tide.transitionEndsAt = session.elapsed + config.recedingMs;
  tide.transitionSequence += 1;
  events.push({
    type: "tideRecedingStarted",
    currentLevel: tide.currentLevel,
    targetLevel: tide.targetLevel,
    recedingEndsAt: tide.transitionEndsAt,
    cells: copyCells(tide.warningCells),
  });
}

function completeRecede(session, config, events) {
  const tide = session.tideCycle;
  const driedCells = copyCells(tide.warningCells);
  tide.currentLevel = tide.targetLevel;
  tide.state = config.dryingMs > 0 ? "drying" : "stable";
  tide.warningCells = [];
  tide.dryingCells = driedCells;
  tide.transitionStartedAt = -Infinity;
  tide.transitionEndsAt = Infinity;
  tide.dryingStartedAt = session.elapsed;
  tide.dryingEndsAt = config.dryingMs > 0 ? session.elapsed + config.dryingMs : Infinity;
  tide.lastTransitionAt = session.elapsed;
  tide.levelReachedAt = session.elapsed;
  tide.retreatsThisWave += 1;
  tide.floodedFromCol = getFloodedFromColumn(session);
  tide.nextEvaluationAt = session.elapsed + config.evaluationIntervalMs;
  events.push({
    type: "tideReceded",
    currentLevel: tide.currentLevel,
    minimumLevel: tide.minimumLevel,
    dryingEndsAt: tide.dryingEndsAt,
    cells: copyCells(driedCells),
  });
  events.push({
    type: "tideLowStarted",
    forced: false,
    previousState: "receding",
    tideNumber: tide.tidesThisWave,
    repeatEligible: true,
  });
}

function completeDrying(session, events) {
  const tide = session.tideCycle;
  const cells = copyCells(tide.dryingCells);
  tide.state = "stable";
  tide.dryingCells = [];
  tide.dryingStartedAt = -Infinity;
  tide.dryingEndsAt = Infinity;
  events.push({
    type: "tideDryingComplete",
    currentLevel: tide.currentLevel,
    cells,
  });
}

function syncSubmergedTroops(session, config, events, hooks = {}) {
  const tide = session.tideCycle;
  const submergedIds = [];
  for (const troop of session.troops) {
    if (troop.dead) continue;
    const flooded = isTideCellFlooded(session, troop.row, troop.col);
    if (!flooded) {
      if (troop.submerged) {
        troop.submerged = false;
        troop.submergedStartedAt = -Infinity;
        troop.tidePressureDamageApplied = 0;
        troop.tidePressureInundationId = null;
        troop.tidePressureLastEventAt = -Infinity;
        events.push({
          type: "troopSurfaced",
          troopId: troop.id,
          row: troop.row,
          col: troop.col,
          x: troop.x,
          y: troop.y,
        });
      }
      continue;
    }

    submergedIds.push(troop.id);
    const cellState = getTideCellState(session, troop.row, troop.col);
    const inundationId = cellState.type === TIDE_CELL_TYPES.DEEP_WATER
      ? "deepWater"
      : `${cellState.level}:${Number(tide.levelFloodEpochs[cellState.level] || 1)}`;
    if (!troop.submerged || troop.tidePressureInundationId !== inundationId) {
      troop.submerged = true;
      troop.submergedStartedAt = session.elapsed;
      troop.tidePressureDamageApplied = 0;
      troop.tidePressureInundationId = inundationId;
      troop.tidePressureLastEventAt = -Infinity;
      events.push({
        type: "troopSubmerged",
        troopId: troop.id,
        row: troop.row,
        col: troop.col,
        x: troop.x,
        y: troop.y,
        pressureMaximumHpRatio: config.pressureMaximumHpRatio,
      });
    }

    const pressureStart = troop.submergedStartedAt + config.pressureGraceMs;
    const pressureProgress = clamp(
      (session.elapsed - pressureStart) / Math.max(1, config.pressureDurationMs),
      0,
      1,
    );
    const targetDamage = troop.maxHp * config.pressureMaximumHpRatio * pressureProgress;
    const delta = Math.max(0, targetDamage - Number(troop.tidePressureDamageApplied || 0));
    if (delta <= 0) continue;
    troop.tidePressureDamageApplied = targetDamage;
    troop.hp -= delta;
    if (session.elapsed - Number(troop.tidePressureLastEventAt || -Infinity) >= 500) {
      troop.tidePressureLastEventAt = session.elapsed;
      events.push({
        type: "tidePressureHit",
        troopId: troop.id,
        row: troop.row,
        col: troop.col,
        x: troop.x,
        y: troop.y,
        amount: delta,
        progress: pressureProgress,
      });
    }
    if (troop.hp <= 0) {
      troop.hp = 0;
      if (typeof hooks.eliminateTroop === "function") {
        hooks.eliminateTroop(session, troop, events, "tide");
        events.push({
          type: "tideTroopEliminated",
          troopId: troop.id,
          row: troop.row,
          col: troop.col,
          x: troop.x,
          y: troop.y,
        });
      } else {
        troop.dead = true;
        recordTideTroopElimination(session, troop, "tide");
        events.push({
          type: "troopDeath",
          reason: "tide",
          entity: { ...troop },
          x: troop.x,
          y: troop.y,
        });
      }
    }
  }
  tide.submergedTroopIds = submergedIds.filter((troopId) => (
    session.troops.some((troop) => troop.id === troopId && !troop.dead)
  ));
}

export function resetTideCycleForWave(session, config = session.phase?.environmentHazard) {
  if (config?.id !== "tide_cycle") {
    session.tideCycle = createTideCycleState();
    return session.tideCycle;
  }
  const previous = session.tideCycle || createTideCycleState();
  const initialized = previous.initialized;
  const minimumLevel = levelMinimumForWave(session, config);
  const preservedLevel = initialized ? previous.currentLevel : config.initialLevel;
  const intermissionPopulationBase = Math.max(
    Number(previous.waveStartedPopulation || 0),
    Number(previous.wavePeakPopulation || 0),
  );
  const intermissionLossRatio = intermissionPopulationBase > 0
    ? previous.waveLossPopulation / intermissionPopulationBase
    : 0;
  const canRelieveBetweenWaves = initialized
    && intermissionLossRatio >= config.intermissionRetreatLossRatio
    && preservedLevel > minimumLevel;
  const currentLevel = clamp(
    Math.max(minimumLevel, canRelieveBetweenWaves ? preservedLevel - 1 : preservedLevel),
    0,
    config.maximumLevel,
  );

  session.tideCycle = {
    ...previous,
    initialized: true,
    state: "stable",
    currentLevel,
    targetLevel: currentLevel,
    warningStartedAt: -Infinity,
    warningEndsAt: Infinity,
    transitionStartedAt: -Infinity,
    transitionEndsAt: Infinity,
    dryingStartedAt: -Infinity,
    dryingEndsAt: Infinity,
    nextEvaluationAt: session.elapsed + config.firstEvaluationDelayMs,
    lastEvaluationAt: -Infinity,
    lastTransitionAt: Number.isFinite(previous.lastTransitionAt)
      ? previous.lastTransitionAt
      : session.elapsed,
    levelReachedAt: Number.isFinite(previous.levelReachedAt)
      ? previous.levelReachedAt
      : session.elapsed,
    levelFloodEpochs: Object.fromEntries(
      Array.from({ length: currentLevel }, (_, index) => [index + 1, Number(previous.levelFloodEpochs?.[index + 1] || 1)]),
    ),
    advancesThisWave: 0,
    retreatsThisWave: 0,
    recentTroopLosses: [],
    waveStartedPopulation: getTideTroopPopulation(session),
    wavePeakPopulation: getTideTroopPopulation(session),
    waveLossPopulation: 0,
    troopPopulation: getTideTroopPopulation(session),
    recentLossPopulation: 0,
    recentLossRatio: 0,
    densityRatio: 0,
    lossPressure: 0,
    pressureScore: 0,
    advanceChance: 0,
    retreatChance: 0,
    minimumLevel,
    maximumLevel: config.maximumLevel,
    warningCells: [],
    dryingCells: [],
    submergedTroopIds: [],
    eliminatedTroopIds: [],
    floodedFromCol: FIELD.enemyEntryCol,
    tidesThisWave: 0,
    troopCountAtStart: 0,
    troopCountAtEnd: 0,
    troopLossCount: 0,
    troopLossRatio: 0,
    repeatEligible: true,
  };
  session.tideCycle.floodedFromCol = getFloodedFromColumn(session);
  return session.tideCycle;
}

export function endTideCycle(session, events = [], forced = false) {
  const config = tideConfig(session);
  const tide = session?.tideCycle;
  if (!config || !tide) return tide;
  const previousState = tide.state;
  if (previousState === "rising") tide.currentLevel = tide.targetLevel;
  if (previousState === "receding") tide.currentLevel = tide.targetLevel;
  tide.currentLevel = clamp(tide.currentLevel, tide.minimumLevel, config.maximumLevel);
  tide.targetLevel = tide.currentLevel;
  tide.state = "stable";
  tide.warningStartedAt = -Infinity;
  tide.warningEndsAt = Infinity;
  tide.transitionStartedAt = -Infinity;
  tide.transitionEndsAt = Infinity;
  tide.dryingStartedAt = -Infinity;
  tide.dryingEndsAt = Infinity;
  tide.warningCells = [];
  tide.dryingCells = [];
  tide.nextEvaluationAt = Infinity;
  tide.troopCountAtEnd = livingTroops(session).length;
  tide.troopLossRatio = tide.waveStartedPopulation > 0
    ? tide.waveLossPopulation / tide.waveStartedPopulation
    : 0;
  tide.floodedFromCol = getFloodedFromColumn(session);
  events.push({
    type: "tideCyclePaused",
    forced,
    previousState,
    currentLevel: tide.currentLevel,
    troopLossRatio: tide.troopLossRatio,
  });
  return tide;
}

export function updateTideCycle(session, events = [], hooks = {}) {
  const config = tideConfig(session);
  const tide = session?.tideCycle;
  if (!config || !tide) return events;

  tide.minimumLevel = levelMinimumForWave(session, config);
  tide.maximumLevel = config.maximumLevel;
  if (tide.currentLevel < tide.minimumLevel && tide.state === "stable") {
    tide.currentLevel = tide.minimumLevel;
    tide.targetLevel = tide.minimumLevel;
    tide.lastTransitionAt = session.elapsed;
    tide.levelReachedAt = session.elapsed;
  }

  syncSubmergedTroops(session, config, events, hooks);
  pressureMetrics(session, config);

  if (!session.waveActive) return events;

  if (tide.state === "warningAdvance") {
    if (session.elapsed >= tide.warningEndsAt) startRising(session, config, events);
    return events;
  }
  if (tide.state === "rising") {
    if (session.elapsed >= tide.transitionEndsAt) completeAdvance(session, config, events);
    return events;
  }
  if (tide.state === "warningRetreat") {
    if (session.elapsed >= tide.warningEndsAt) startReceding(session, config, events);
    return events;
  }
  if (tide.state === "receding") {
    if (session.elapsed >= tide.transitionEndsAt) completeRecede(session, config, events);
    return events;
  }
  if (tide.state === "drying") {
    if (session.elapsed >= tide.dryingEndsAt) completeDrying(session, events);
    return events;
  }
  if (tide.state !== "stable" || session.elapsed < tide.nextEvaluationAt) return events;

  tide.lastEvaluationAt = session.elapsed;
  tide.nextEvaluationAt = session.elapsed + config.evaluationIntervalMs;
  const metrics = pressureMetrics(session, config);
  const retreatFirst = metrics.lossPressure >= 0.35
    || metrics.recentLossRatio >= config.criticalLossRatio;

  if (retreatFirst) {
    if (canRetreat(session, config) && session.rng() < metrics.retreatChance) {
      startRetreatWarning(session, config, events);
      return events;
    }
    if (canAdvance(session, config) && session.rng() < metrics.advanceChance) {
      startAdvanceWarning(session, config, events);
    }
    return events;
  }

  if (canAdvance(session, config) && session.rng() < metrics.advanceChance) {
    startAdvanceWarning(session, config, events);
    return events;
  }
  if (canRetreat(session, config) && session.rng() < metrics.retreatChance) {
    startRetreatWarning(session, config, events);
  }
  return events;
}

function enemyCell(enemy) {
  return {
    row: clamp(Number(enemy?.row) || 0, 0, FIELD.rows - 1),
    col: clamp(Math.floor(Number(enemy?.x || 0) / CELL.width), 0, FIELD.cols - 1),
  };
}

export function getTideEnemySpeedFactor(session, enemy) {
  const config = tideConfig(session);
  if (!config || !enemy || enemy.dead) return 1;
  const { row, col } = enemyCell(enemy);
  return isTideCellFlooded(session, row, col) ? config.enemySpeedFactor || 1 : 1;
}

export function getTideAdjustedEnemySlowFactor(session, enemy, slowFactor = 1) {
  const config = tideConfig(session);
  if (!config || slowFactor >= 1 || !enemy || enemy.dead) return slowFactor;
  const { row, col } = enemyCell(enemy);
  if (!isTideCellFlooded(session, row, col)) return slowFactor;
  const resistance = clamp(config.enemySlowResistance || 0, 0, 1);
  return 1 - (1 - slowFactor) * (1 - resistance);
}

export function getTideTroopAttackSpeedFactor(session, troop) {
  const config = tideConfig(session);
  if (!config || !troop || troop.dead || troop.type === "reator"
    || !isTideCellFlooded(session, troop.row, troop.col)) return 1;
  return clamp(config.submergedAttackSpeedFactor || 1, 0.1, 1);
}

export function isTideReactorPaused(session, troop) {
  const config = tideConfig(session);
  return Boolean(
    config?.pauseReactorsWhenFlooded
    && troop?.type === "reator"
    && isTideCellFlooded(session, troop.row, troop.col),
  );
}

export function isTideMineDisabled(session, mine) {
  const config = tideConfig(session);
  return Boolean(
    config?.disableMinesWhenFlooded
    && mine
    && isTideCellFlooded(session, mine.row, mine.col),
  );
}

export function getFloodedFromColumn(session) {
  const config = tideConfig(session);
  if (!config) return FIELD.enemyEntryCol;
  const flooded = floodedCellsForLevel(config, session?.tideCycle?.currentLevel || 0);
  return flooded.length
    ? Math.min(...flooded.map(([, col]) => col))
    : FIELD.enemyEntryCol;
}

export function getTideWaterlineX(session, now = session?.elapsed || 0) {
  const config = tideConfig(session);
  const tide = session?.tideCycle;
  if (!config || !tide) return FIELD.width;
  const currentX = getFloodedFromColumn(session) * CELL.width;
  if (tide.state === "rising") {
    const targetCells = bandForLevel(config, tide.targetLevel)?.cells || [];
    const targetCol = targetCells.length
      ? Math.min(...targetCells.map(([, col]) => col))
      : getFloodedFromColumn(session);
    const progress = smoothstep(
      0,
      1,
      (now - tide.transitionStartedAt) / Math.max(1, config.risingMs),
    );
    return FIELD.width + (targetCol * CELL.width - FIELD.width) * progress;
  }
  if (tide.state === "receding") {
    const targetFlooded = floodedCellsForLevel(config, tide.targetLevel);
    const targetCol = targetFlooded.length
      ? Math.min(...targetFlooded.map(([, col]) => col))
      : FIELD.enemyEntryCol;
    const progress = smoothstep(
      0,
      1,
      (now - tide.transitionStartedAt) / Math.max(1, config.recedingMs),
    );
    return currentX + (targetCol * CELL.width - currentX) * progress;
  }
  return currentX;
}

export function getTideSnapshot(session) {
  const config = tideConfig(session);
  const tide = session?.tideCycle || createTideCycleState();
  if (!config) return { ...createTideCycleState(), enabled: false };
  const now = session?.elapsed || 0;
  const remainingMs = tide.state === "warningAdvance" || tide.state === "warningRetreat"
    ? Math.max(0, tide.warningEndsAt - now)
    : tide.state === "rising" || tide.state === "receding"
      ? Math.max(0, tide.transitionEndsAt - now)
      : tide.state === "drying"
        ? Math.max(0, tide.dryingEndsAt - now)
        : 0;
  const floodedCells = floodedCellsForLevel(config, tide.currentLevel);
  if (tide.state === "rising") {
    floodedCells.push(...copyCells(bandForLevel(config, tide.targetLevel)?.cells || []));
  }
  const uniqueFlooded = uniqueCells(floodedCells);
  return {
    enabled: true,
    mode: config.mode,
    state: tide.state,
    currentLevel: tide.currentLevel,
    targetLevel: tide.targetLevel,
    minimumLevel: tide.minimumLevel,
    maximumLevel: config.maximumLevel,
    remainingMs,
    nextCheckInMs: Number.isFinite(tide.nextEvaluationAt)
      ? Math.max(0, tide.nextEvaluationAt - now)
      : 0,
    advancesThisWave: tide.advancesThisWave,
    retreatsThisWave: tide.retreatsThisWave,
    troopPopulation: tide.troopPopulation,
    wavePeakPopulation: tide.wavePeakPopulation,
    recentLossPopulation: tide.recentLossPopulation,
    recentLossRatio: tide.recentLossRatio,
    densityRatio: tide.densityRatio,
    lossPressure: tide.lossPressure,
    pressureScore: tide.pressureScore,
    advanceChance: tide.advanceChance,
    retreatChance: tide.retreatChance,
    permanentWaterCells: copyCells(config.permanentWaterCells),
    intertidalBands: copyBands(config.intertidalBands),
    floodedCells: copyCells(uniqueFlooded),
    warningCells: copyCells(tide.warningCells),
    dryingCells: copyCells(tide.dryingCells),
    submergedTroopIds: [...tide.submergedTroopIds],
    minimumSafeCells: config.minimumSafeCells,
    safeCells: deployableCellCountAtLevel(config, tide.currentLevel),
    enemySpeedFactor: config.enemySpeedFactor,
    enemySlowResistance: config.enemySlowResistance,
    submergedAttackSpeedFactor: config.submergedAttackSpeedFactor,
    pressureMaximumHpRatio: config.pressureMaximumHpRatio,
    minesDisabled: config.disableMinesWhenFlooded,
    reactorsPaused: config.pauseReactorsWhenFlooded,

    // Legacy fields kept for existing debug/UI consumers.
    floodedFromCol: getFloodedFromColumn(session),
    tidesThisWave: tide.tidesThisWave,
    troopCountAtStart: tide.troopCountAtStart,
    troopCountAtEnd: tide.troopCountAtEnd,
    troopLossCount: tide.troopLossCount,
    troopLossRatio: tide.troopLossRatio,
    repeatLossToleranceRatio: 0,
    repeatEligible: true,
    eliminatedTroopIds: [...tide.eliminatedTroopIds],
  };
}
