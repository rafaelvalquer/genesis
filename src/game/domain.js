import { DECISIONS, ENEMIES, PHASES, TROOPS } from "./content.js";

export function createRng(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function enemyThreat(entry) {
  const base = ENEMIES[entry.type]?.threat || 1;
  return entry.variant === "alpha" ? base * 8 : base;
}

export function isGroundTrapEligible(enemy) {
  return ENEMIES[enemy?.type]?.airborne !== true;
}

export function waveBudget(wave) {
  return wave.enemies.reduce((total, entry) => total + enemyThreat(entry) * entry.count, 0);
}

export function phaseBudget(phase) {
  return phase.waves.reduce((total, waveEntry) => total + waveBudget(waveEntry), 0);
}

function scaledCoordinatedPackets(spawnBlocks, countMultiplier) {
  const packets = spawnBlocks.flatMap((block) => block.packets.map((packet) => ({
    ...packet,
    block: block.id,
    units: packet.units.map((unit) => ({ ...unit })),
  })));
  if (countMultiplier === 1) return packets;

  const occurrences = new Map();
  packets.forEach((packet) => packet.units.forEach((unit) => {
    const key = `${unit.type}:${unit.variant || ""}`;
    if (!occurrences.has(key)) occurrences.set(key, []);
    occurrences.get(key).push(unit);
  }));
  occurrences.forEach((units) => {
    const current = units.reduce((sum, unit) => sum + unit.count, 0);
    let remaining = Math.max(0, Math.ceil(current * countMultiplier) - current);
    let cursor = 0;
    while (remaining > 0) {
      const unit = units[cursor % units.length];
      const cap = unit.type === "silicaDigger" ? 8 : Infinity;
      if (unit.count < cap) {
        unit.count += 1;
        remaining -= 1;
      }
      cursor += 1;
      if (cursor > units.length * 16 && units.every((entry) => entry.count >= (entry.type === "silicaDigger" ? 8 : Infinity))) break;
    }
  });
  return packets;
}

function coordinatedSpawnQueue(phase, waveEntry, seed, countMultiplier) {
  const rng = createRng(seed);
  const packets = scaledCoordinatedPackets(waveEntry.spawnBlocks, countMultiplier)
    .sort((left, right) => left.spawnAtMs - right.spawnAtMs);
  const recentRows = [];
  const queue = packets.flatMap((packet, packetIndex) => {
    const blockedRow = recentRows.length >= 2 && recentRows.at(-1) === recentRows.at(-2)
      ? recentRows.at(-1)
      : null;
    const candidates = [0, 1, 2, 3, 4].filter((row) => row !== blockedRow);
    const row = candidates[(Math.floor(rng() * candidates.length) + packetIndex) % candidates.length];
    recentRows.push(row);
    if (recentRows.length > 2) recentRows.shift();
    return packet.units.flatMap((unit) => Array.from({ length: unit.count }, (_, index) => ({
      type: unit.type,
      variant: unit.variant || null,
      sourceIndex: index,
      row,
      packetId: packet.id,
      block: packet.block,
      spawnAtMs: packet.spawnAtMs + (unit.spawnDelayMs || 0),
      xOffsetTiles: unit.xOffsetTiles || 0,
      formationOffsetPx: (index - (unit.count - 1) / 2) * 10,
    })));
  });
  return queue.sort((left, right) => left.spawnAtMs - right.spawnAtMs);
}

export function buildSpawnQueue(phase, waveIndex, seed = 1, countMultiplier = 1) {
  const waveEntry = phase.waves[waveIndex];
  if (!waveEntry) return [];
  if (waveEntry.spawnBlocks?.length) {
    return coordinatedSpawnQueue(phase, waveEntry, seed, countMultiplier);
  }
  const queue = waveEntry.enemies.flatMap((entry) =>
    Array.from({ length: Math.ceil(entry.count * countMultiplier) }, (_, index) => ({
      type: entry.type,
      variant: entry.variant || null,
      sourceIndex: index,
    })),
  );
  const rng = createRng(seed);
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }
  return queue.map((entry, index) => ({ ...entry, spawnAtMs: index * phase.cadenceMs }));
}

export function waveSpawnCount(phase, waveIndex, countMultiplier = 1) {
  return buildSpawnQueue(phase, waveIndex, 1, countMultiplier).length;
}

export function waveSpawnWindowMs(phase, waveIndex) {
  return phase.waves[waveIndex]?.spawnWindowMs
    ?? Math.max(0, (waveSpawnCount(phase, waveIndex) - 1) * phase.cadenceMs);
}

export function wavePressure(phase, waveIndex) {
  const windowSeconds = Math.max(1, waveSpawnWindowMs(phase, waveIndex) / 1000);
  const waveEntry = phase.waves[waveIndex];
  const threat = waveEntry.coordinated
    ? waveEntry.enemies.reduce((sum, entry) => {
      const bossEvolutionFactor = entry.type === "scarabEmperor" ? 3 : 1;
      return sum + enemyThreat(entry) * entry.count * bossEvolutionFactor;
    }, 0)
    : waveBudget(waveEntry);
  const coordinationFactor = waveEntry.coordinated ? 1.03 ** (phase.chapterIndex || 0) : 1;
  return threat * coordinationFactor / windowSeconds;
}

export function calculateStars({ outcome, integrity, integrityMax = 100, durationMs, targetDurationMs }) {
  if (outcome !== "victory") return 0;
  const integrityPercent = integrityMax > 0 ? integrity / integrityMax * 100 : 0;
  let stars = 1;
  if (integrityPercent >= 70) stars += 1;
  if (integrityPercent >= 40 && durationMs <= targetDurationMs) stars += 1;
  return stars;
}

const SPECIALIZATION_LOADOUTS = {
  ballistic_specialization: ["marine", "sniper", "caçador"],
  explosive_specialization: ["bombardeiro", "demolidora", "artilheiraMorteiro"],
  energy_specialization: ["ranger", "krio", "guarda"],
  concussive_impact: ["bombardeiro", "demolidora", "artilheiraMorteiro"],
  frontline_doctrine: ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"],
  support_doctrine: ["medicaNanites", "reator", "krio", "lumiUrsa7", "colossoImpacto"],
  precision_doctrine: ["sniper", "ranger", "artilheiraMorteiro"],
  human_swarm_doctrine: ["colono", "marine", "caçador", "krio", "muralhaReforcada"],
  territorial_control: ["demolidora", "krio", "lumiUrsa7", "colossoImpacto"],
};

const RANGED_LOADOUT = ["marine", "medicaNanites", "caçador", "sniper", "incinerador", "krio", "ranger", "bombardeiro", "artilheiraMorteiro", "guarda"];
const CATEGORY_CAPS = { attack: 2, defense: 2, economy: 2, specialization: 1 };
const GLOBAL_LIMITS = { damage: 20, attackSpeed: 15, range: 15, energyCost: 20, deployCooldown: 20, damageReduction: 25 };

export function getDecisionStage(completedWave, totalWaves) {
  if (completedWave === 1) return "preparation";
  if (totalWaves === 6) {
    if (completedWave === 2) return "direction";
    if (completedWave === 3) return "specialization";
    if (completedWave === 4) return "adaptation";
    return "finalTemporary";
  }
  if (completedWave === 2) return "direction";
  if (completedWave === totalWaves - 1) return "final";
  return "adaptation";
}

function decisionAllowedAtStage(decisionEntry, stage, totalWaves) {
  if (!decisionEntry.stages.includes(stage)) return false;
  if (stage === "direction" && totalWaves === 6 && decisionEntry.category === "specialization") return false;
  return true;
}

function livingTroops(troops = []) {
  return troops.filter((troop) => !troop.dead);
}

export function decisionIsEligible({
  id, integrity, integrityMax = 100, supply = 0, supplyMax = 0,
  loadout = [], troops = [], completedWave = 1, totalWaves = 5,
}) {
  const deployed = livingTroops(troops);
  if (id === "repair_core" && integrity >= integrityMax) return false;
  if (id === "field_maintenance" && !deployed.some((troop) => troop.hp < troop.maxHp)) return false;
  if (["recycling", "route_fortification", "organized_retreat"].includes(id) && deployed.length === 0) return false;
  if (id === "supply_reserve" && supply >= supplyMax) return false;
  if (id === "targeting_systems" && !RANGED_LOADOUT.some((troopId) => loadout.includes(troopId))) return false;
  if (id === "overcharged_reactor" && (!loadout.includes("reator") || totalWaves - completedWave < 2)) return false;
  const requiredTroops = SPECIALIZATION_LOADOUTS[id];
  return !requiredTroops || requiredTroops.some((troopId) => loadout.includes(troopId));
}

function selectedCategoryCounts(decisions) {
  return decisions.reduce((counts, entry) => {
    const selected = DECISIONS[typeof entry === "string" ? entry : entry.id];
    if (selected?.scope === "phase") counts[selected.category] = (counts[selected.category] || 0) + 1;
    return counts;
  }, {});
}

function staysWithinGlobalLimits(candidate, decisions) {
  const totals = {};
  [...decisions.map((entry) => DECISIONS[typeof entry === "string" ? entry : entry.id]), candidate]
    .filter(Boolean)
    .forEach((entry) => Object.entries(entry.limit || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    }));
  return Object.entries(totals).every(([key, value]) => value <= (GLOBAL_LIMITS[key] ?? Infinity));
}

function contextualWeight(option, context) {
  let weight = 1;
  const deployed = livingTroops(context.troops);
  if (context.integrity < context.integrityMax * 0.6
    && (option.category === "defense" || ["repair_core", "emergency_shield"].includes(option.id))) weight *= 2;
  if (deployed.filter((troop) => troop.hp / troop.maxHp < 0.6).length >= 3
    && ["field_maintenance", "reactive_barrier"].includes(option.id)) weight *= 2;
  if (context.energy < context.energyMax * 0.25
    && ["emergency_energy", "strategic_reserve"].includes(option.id)) weight *= 2;
  if (context.supply < context.supplyMax * 0.25
    && ["supply_expansion", "supply_reserve"].includes(option.id)) weight *= 2;
  const offensive = context.loadout.filter((troopId) => {
    const attack = TROOPS[troopId]?.attack;
    return attack && !["none", "energy", "naniteBullet"].includes(attack);
  }).length > context.loadout.length / 2;
  if (offensive) {
    if (option.category === "specialization" || option.category === "defense" || option.positional) weight *= 1.5;
    if (option.limit?.damage) weight *= 0.6;
  }
  return weight;
}

function weightedPick(options, rng, context) {
  const total = options.reduce((sum, option) => sum + contextualWeight(option, context), 0);
  let cursor = rng() * total;
  for (const option of options) {
    cursor -= contextualWeight(option, context);
    if (cursor <= 0) return option;
  }
  return options.at(-1);
}

export function getDecisionOptions({
  completedWave = 1, totalWaves = 5,
  integrity, integrityMax = 100, energy = 0, energyMax = 1,
  supply = 0, supplyMax = 1, loadout = [], troops = [], modifiers = {},
  decisions = [], seed = 1,
}) {
  const chosen = new Set(decisions.map((entry) => typeof entry === "string" ? entry : entry.id));
  const stage = getDecisionStage(completedWave, totalWaves);
  const categoryCounts = selectedCategoryCounts(decisions);
  const context = {
    completedWave, totalWaves, integrity, integrityMax, energy, energyMax,
    supply, supplyMax, loadout, troops, modifiers,
  };
  let options = Object.values(DECISIONS)
    .filter((option) => !chosen.has(option.id))
    .filter((option) => decisionAllowedAtStage(option, stage, totalWaves))
    .filter((option) => decisionIsEligible({ ...context, id: option.id }))
    .filter((option) => option.scope === "nextWave"
      || (categoryCounts[option.category] || 0) < CATEGORY_CAPS[option.category])
    .filter((option) => option.scope === "nextWave" || staysWithinGlobalLimits(option, decisions));
  const rng = createRng((Number(seed) + Number(completedWave) * 0x9e3779b9) >>> 0);
  const eligibleSpecializations = options.filter((option) => option.category === "specialization");
  const guaranteeSpecialization = completedWave === 3 && eligibleSpecializations.length > 0;
  const specializationChance = [2, 4].includes(completedWave) && rng() < 0.3;
  if (!guaranteeSpecialization && !specializationChance) {
    options = options.filter((option) => option.category !== "specialization");
  }
  if (options.length < 2) return options;
  const firstPool = (guaranteeSpecialization || specializationChance) && eligibleSpecializations.length
    ? eligibleSpecializations.filter((option) => options.includes(option))
    : options;
  const first = weightedPick(firstPool.length ? firstPool : options, rng, context);
  const remaining = options.filter((option) => option.id !== first.id);
  let secondPool = remaining.filter((option) => option.category !== first.category && Math.abs(option.power - first.power) <= 1);
  if (!secondPool.length) secondPool = remaining.filter((option) => Math.abs(option.power - first.power) <= 1);
  if (!secondPool.length) secondPool = remaining;
  return [first, weightedPick(secondPool, rng, context)].filter(Boolean);
}

export function validateCampaignBalance(phases = PHASES) {
  const problems = [];
  phases.forEach((phase, phaseIndex) => {
    const budgets = phase.waves.map(waveBudget);
    const coordinated = phase.waves.every((waveEntry) => waveEntry.coordinated);
    budgets.forEach((budget, waveIndex) => {
      const currentCount = phase.waves[waveIndex].enemies.reduce((sum, entry) => sum + entry.count, 0);
      const previousCount = waveIndex > 0
        ? phase.waves[waveIndex - 1].enemies.reduce((sum, entry) => sum + entry.count, 0)
        : 0;
      if (waveIndex > 0 && (coordinated ? currentCount < previousCount : budget < budgets[waveIndex - 1])) {
        problems.push(`${phase.id}: onda ${waveIndex + 1} reduz ameaça`);
      }
    });
    if (phaseIndex > 0) {
      const previous = phases[phaseIndex - 1];
      if (phase.chapterId !== previous.chapterId) return;
      if (coordinated) {
        const pressure = phase.waves.reduce((sum, entry, waveIndex) => sum + wavePressure(phase, waveIndex), 0);
        const previousPressure = previous.waves.reduce((sum, entry, waveIndex) => sum + wavePressure(previous, waveIndex), 0);
        const tunedFinale = phase.chapterIndex >= 6;
        const totalFloor = tunedFinale ? (phase.chapterIndex === 6 ? 0.99 : 1.01) : 1.08;
        const finalFloor = tunedFinale ? (phase.chapterIndex === 6 ? 0.88 : 1.04) : 1.08;
        if (pressure < previousPressure * totalFloor) problems.push(`${phase.id}: pressão total abaixo do piso planejado`);
        if (wavePressure(phase, phase.waves.length - 1) < wavePressure(previous, previous.waves.length - 1) * finalFloor) {
          problems.push(`${phase.id}: pressão final abaixo do piso planejado`);
        }
      } else {
        if (phaseBudget(phase) < phaseBudget(previous) * 1.1) problems.push(`${phase.id}: orçamento total abaixo de +10%`);
        if (budgets.at(-1) < waveBudget(previous.waves.at(-1)) * 1.1) problems.push(`${phase.id}: onda final abaixo de +10%`);
      }
    }
  });
  return problems;
}
