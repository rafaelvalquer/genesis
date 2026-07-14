import { ENEMIES, PHASES } from "./content.js";

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

export function waveBudget(wave) {
  return wave.enemies.reduce((total, entry) => total + enemyThreat(entry) * entry.count, 0);
}

export function phaseBudget(phase) {
  return phase.waves.reduce((total, waveEntry) => total + waveBudget(waveEntry), 0);
}

export function buildSpawnQueue(phase, waveIndex, seed = 1) {
  const waveEntry = phase.waves[waveIndex];
  if (!waveEntry) return [];
  const queue = waveEntry.enemies.flatMap((entry) =>
    Array.from({ length: entry.count }, (_, index) => ({
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

export function calculateStars({ outcome, integrity, durationMs, targetDurationMs }) {
  if (outcome !== "victory") return 0;
  let stars = 1;
  if (integrity >= 70) stars += 1;
  if (integrity >= 40 && durationMs <= targetDurationMs) stars += 1;
  return stars;
}

export function applyDecisionState(state, option) {
  const supplyCost = Math.max(0, Number(option.cost?.supply || 0));
  if (state.supply < supplyCost) return state;
  const effect = option.effect || {};
  return {
    ...state,
    energy: state.energy + Number(effect.energy || 0),
    supply: Math.min(state.supplyMax, state.supply - supplyCost + Number(effect.supply || 0)),
    integrity: Math.min(100, state.integrity + Number(effect.integrity || 0)),
    modifiers: {
      ...state.modifiers,
      enemySpeed: state.modifiers.enemySpeed * Number(effect.enemySpeed || 1),
      troopDamage: state.modifiers.troopDamage * Number(effect.troopDamage || 1),
      slowDuration: state.modifiers.slowDuration * Number(effect.slowDuration || 1),
    },
  };
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

