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

export function buildSpawnQueue(phase, waveIndex, seed = 1, countMultiplier = 1) {
  const waveEntry = phase.waves[waveIndex];
  if (!waveEntry) return [];
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
  return queue;
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
    budgets.forEach((budget, waveIndex) => {
      if (waveIndex > 0 && budget < budgets[waveIndex - 1]) {
        problems.push(`${phase.id}: onda ${waveIndex + 1} reduz ameaça`);
      }
    });
    if (phaseIndex > 0) {
      const previous = phases[phaseIndex - 1];
      if (phaseBudget(phase) < phaseBudget(previous) * 1.1) problems.push(`${phase.id}: orçamento total abaixo de +10%`);
      if (budgets.at(-1) < waveBudget(previous.waves.at(-1)) * 1.1) problems.push(`${phase.id}: onda final abaixo de +10%`);
    }
  });
  return problems;
}
