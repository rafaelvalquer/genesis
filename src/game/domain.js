import { DECISIONS, DECISION_LEVELS, ENEMIES, PHASES } from "./content.js";

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
};

export function decisionIsEligible({ id, integrity, integrityMax = 100, loadout = [] }) {
  if (id === "repair_core" && integrity >= integrityMax * 0.9) return false;
  const requiredTroops = SPECIALIZATION_LOADOUTS[id];
  return !requiredTroops || requiredTroops.some((troopId) => loadout.includes(troopId));
}

export function getDecisionOptions({ level, integrity, integrityMax = 100, loadout = [], decisions = [], seed = 1 }) {
  const chosen = new Set(decisions.map((entry) => typeof entry === "string" ? entry : entry.id));
  const options = (DECISION_LEVELS[level] || [])
    .filter((id) => !chosen.has(id))
    .filter((id) => decisionIsEligible({ id, integrity, integrityMax, loadout }))
    .map((id) => DECISIONS[id])
    .filter(Boolean);
  const rng = createRng((Number(seed) + Number(level) * 0x9e3779b9) >>> 0);
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }
  return options.slice(0, 2);
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
        if (pressure < previousPressure * 1.08) problems.push(`${phase.id}: pressão total abaixo de +8%`);
        if (wavePressure(phase, phase.waves.length - 1) < wavePressure(previous, previous.waves.length - 1) * 1.08) {
          problems.push(`${phase.id}: pressão final abaixo de +8%`);
        }
      } else {
        if (phaseBudget(phase) < phaseBudget(previous) * 1.1) problems.push(`${phase.id}: orçamento total abaixo de +10%`);
        if (budgets.at(-1) < waveBudget(previous.waves.at(-1)) * 1.1) problems.push(`${phase.id}: onda final abaixo de +10%`);
      }
    }
  });
  return problems;
}
