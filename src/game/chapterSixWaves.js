const unit = (type, count) => ({ type, count });

export const CHAPTER_SIX_ENEMY_POOL = Object.freeze([
  "cuspidorBrasa", "vermeIncubador", "predadorCaldeira", "devoradorCaldeira",
  "rasgaCeusCinereo", "salamandraCinerea",
]);

// Mirrors ENEMIES[type].threat without importing content.js, which imports the
// Chapter Six phase generator. The contract test keeps this in sync.
export const CHAPTER_SIX_UNIT_THREATS = Object.freeze({
  cuspidorBrasa: 24, vermeIncubador: 28, predadorCaldeira: 25,
  devoradorCaldeira: 26, rasgaCeusCinereo: 18, salamandraCinerea: 10,
});
export const CHAPTER_SIX_AIR_UNIT_TYPES = Object.freeze(new Set(["rasgaCeusCinereo"]));

export const CHAPTER_SIX_PACKET_COUNTS = Object.freeze([
  [6, 6, 7, 7, 8, 9], [6, 7, 7, 8, 9, 9], [7, 7, 8, 9, 9, 10],
  [7, 8, 9, 9, 10, 11], [8, 8, 9, 10, 11, 11], [8, 9, 10, 10, 11, 12],
  [9, 10, 10, 11, 12, 13], [10, 10, 11, 12, 13, 14],
]);

export const CHAPTER_SIX_PACKET_GAPS = Object.freeze([
  [7500, 7000, 6500, 6000, 5500, 5000], [7000, 6500, 6000, 5500, 5000, 4800],
  [6500, 6000, 5500, 5000, 4700, 4400], [6000, 5600, 5200, 4800, 4400, 4200],
  [5600, 5200, 4800, 4500, 4200, 3900], [5200, 4800, 4500, 4200, 3900, 3600],
  [4800, 4500, 4200, 3900, 3600, 3400], [4500, 4200, 3900, 3600, 3400, 3200],
]);

export const CHAPTER_SIX_MAXIMUM_LIVING = Object.freeze([48, 52, 56, 60, 64, 68, 72, 76]);

export const CHAPTER_SIX_PACKETS = Object.freeze({
  "C6-01": { id: "embers", label: "Brasas", tier: 1, threat: 48, units: [unit("cuspidorBrasa", 2)] },
  "C6-02": { id: "fire-line", label: "Linha de Fogo", tier: 1, threat: 72, units: [unit("cuspidorBrasa", 3)] },
  "C6-03": { id: "incubation", label: "Incubação", tier: 1, threat: 52, units: [unit("vermeIncubador", 1), unit("cuspidorBrasa", 1)] },
  "C6-04": { id: "ember-nest", label: "Ninho de Brasa", tier: 2, threat: 130, units: [unit("vermeIncubador", 1), unit("cuspidorBrasa", 2)] },
  "C6-05": { id: "hunt", label: "Caçada", tier: 2, threat: 100, units: [unit("predadorCaldeira", 2)] },
  "C6-06": { id: "incandescent-hunt", label: "Caçada Incandescente", tier: 2, threat: 120, units: [unit("predadorCaldeira", 1), unit("cuspidorBrasa", 2)] },
  "C6-07": { id: "caldera-colony", label: "Colônia da Caldeira", tier: 3, threat: 102, units: [unit("vermeIncubador", 1), unit("predadorCaldeira", 1), unit("cuspidorBrasa", 1)] },
  "C6-08": { id: "devourer-guard", label: "Guarda do Devorador", tier: 3, threat: 74, units: [unit("devoradorCaldeira", 1), unit("cuspidorBrasa", 2)] },
  "C6-09": { id: "caldera-pack", label: "Matilha da Caldeira", tier: 3, threat: 76, units: [unit("devoradorCaldeira", 1), unit("predadorCaldeira", 2)] },
  "C6-10": { id: "ashen-attack", label: "Ataque Cinéreo", tier: 4, threat: 86, units: [unit("rasgaCeusCinereo", 2), unit("predadorCaldeira", 1)] },
  "C6-11": { id: "ashen-siege", label: "Cerco Cinéreo", tier: 4, threat: 112, units: [unit("rasgaCeusCinereo", 1), unit("vermeIncubador", 1), unit("cuspidorBrasa", 1), unit("predadorCaldeira", 1)] },
  "C6-12": { id: "salamander-wrath", label: "Ira da Salamandra", tier: 4, threat: 112, units: [unit("salamandraCinerea", 1), unit("devoradorCaldeira", 1), unit("cuspidorBrasa", 1)] },
});

export const CHAPTER_SIX_TIER_PROFILES = Object.freeze([
  [100], [65, 35], [45, 55], [30, 55, 15], [25, 40, 35], [20, 35, 30, 15], [15, 30, 30, 25], [10, 25, 35, 30],
]);
export const CHAPTER_SIX_INTRODUCTIONS = Object.freeze([null, "vermeIncubador", "predadorCaldeira", null, "devoradorCaldeira", "rasgaCeusCinereo", "salamandraCinerea", null]);

/** Tactical intent assigned to each reusable packet. */
export const CHAPTER_SIX_PACKET_ROLES = Object.freeze({
  "C6-01": ["pressure", "artillery"], "C6-02": ["artillery"],
  "C6-03": ["disruption"], "C6-04": ["disruption", "artillery"],
  "C6-05": ["assault"], "C6-06": ["assault", "artillery"],
  "C6-07": ["mixed", "disruption", "assault"],
  "C6-08": ["anchor", "artillery"], "C6-09": ["anchor", "assault"],
  "C6-10": ["air", "assault"], "C6-11": ["air", "disruption", "mixed"],
  "C6-12": ["finisher", "anchor", "assault"],
});

const phasePackets = [
  ["C6-01", "C6-02"], ["C6-01", "C6-02", "C6-03", "C6-04"],
  ["C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06"],
  ["C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06", "C6-07"],
  ["C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06", "C6-07", "C6-08", "C6-09"],
  ["C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06", "C6-07", "C6-08", "C6-09", "C6-10", "C6-11"],
  ["C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06", "C6-07", "C6-08", "C6-09", "C6-10", "C6-11", "C6-12"],
  Object.keys(CHAPTER_SIX_PACKETS),
];
export const CHAPTER_SIX_PHASE_POLICIES = Object.freeze(phasePackets.map((allowedPackets, phase) => Object.freeze({
  allowedPackets, maxConsecutiveSame: 2, maxDisruptionConsecutive: 1,
  maxAirThreatRatio: phase < 5 ? 0 : phase === 5 ? .20 : phase === 6 ? .25 : .35,
  roleWeights: { pressure: 18, anchor: 20, artillery: 20, disruption: 18, assault: 25, air: 17, finisher: 22, mixed: 12 },
})));

// The six recurring tactical beats. Later phases resolve unavailable roles to their nearest available role.
export const CHAPTER_SIX_WAVE_BLUEPRINTS = Object.freeze([
  ["pressure", "artillery", "pressure"],
  ["pressure", "anchor", "artillery", "assault"],
  ["artillery", "disruption", "assault"],
  ["anchor", "artillery", "disruption", "assault"],
  ["anchor", "artillery", "air", "disruption", "assault"],
  ["anchor", "artillery", "disruption", "assault", "air", "finisher"],
]);
// Tactical complexity replaces timing as the progression source for equal-size waves.
export const CHAPTER_SIX_WAVE_INTENT_PRESSURE = Object.freeze([0, 0, 0, 300, 474, 650]);

export const hasRole = (key, role) => (CHAPTER_SIX_PACKET_ROLES[key] || []).includes(role);
export const packetsForRole = (role, allowedPackets = Object.keys(CHAPTER_SIX_PACKETS)) => allowedPackets.filter((key) => hasRole(key, role));

export function getChapterSixUnitMetrics(entries) {
  const totals = entries.reduce((metrics, { type, count }) => {
    const threat = (CHAPTER_SIX_UNIT_THREATS[type] || 0) * count;
    metrics.totalUnitCount += count;
    metrics.totalThreat += threat;
    if (CHAPTER_SIX_AIR_UNIT_TYPES.has(type)) {
      metrics.airUnitCount += count;
      metrics.airThreat += threat;
    }
    return metrics;
  }, { totalUnitCount: 0, airUnitCount: 0, totalThreat: 0, airThreat: 0 });
  return {
    ...totals,
    airUnitRatio: totals.airUnitCount / Math.max(1, totals.totalUnitCount),
    airThreatRatio: totals.airThreat / Math.max(1, totals.totalThreat),
  };
}

export function getChapterSixPacketMetrics(keys) {
  return getChapterSixUnitMetrics(keys.flatMap((key) => CHAPTER_SIX_PACKETS[key]?.units || []));
}

export function calculateChapterSixDifficulty({ packetThreat, packetCount, roleCounts, routeCounts, roleWeights, waveIndex = 0 }) {
  const volume = packetCount * 10;
  const rolePressure = Object.entries(roleWeights).reduce((total, [role, weight]) => total + (roleCounts[role] || 0) * weight, 0);
  const routeLoad = Object.values(routeCounts);
  const routeConcentration = (Math.max(...routeLoad) - Math.min(...routeLoad)) * 12;
  const intentPressure = CHAPTER_SIX_WAVE_INTENT_PRESSURE[waveIndex] || 0;
  const difficulty = Math.round(packetThreat + volume + rolePressure + routeConcentration + intentPressure);
  return {
    difficulty,
    difficultyBreakdown: { packetThreat, volume, rolePressure, routeConcentration, intentPressure, total: difficulty },
  };
}

const routeRows = (rows, units, distribute = false) => units.flatMap((entry, index) => {
  if (!distribute) return [{ ...entry, rows: [rows[index % rows.length]], countPerRow: entry.count }];
  const baseCount = Math.floor(entry.count / rows.length);
  const remainder = entry.count % rows.length;
  return rows.flatMap((row, rowIndex) => {
    const distributionIndex = (rowIndex - index + rows.length) % rows.length;
    const countPerRow = baseCount + (distributionIndex < remainder ? 1 : 0);
    return countPerRow > 0 ? [{ ...entry, rows: [row], countPerRow }] : [];
  });
});

export function instantiateChapterSixPacket(key, index, spawnAtMs, block = "main", rows = [2], options = {}) {
  const source = CHAPTER_SIX_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  return {
    id: `${source.id}_${index + 1}`, key, label: source.label, block, spawnAtMs,
    routeStrategy: options.routeStrategy, fixedRows: options.fixedRows || null, dynamicRoutes: options.dynamicRoutes === true,
    units: routeRows(rows, source.units, options.distribute === true),
  };
}

function aggregateEnemies(packets) {
  const totals = new Map();
  packets.flatMap((packet) => packet.units).forEach((entry) => {
    const count = entry.rows.length * (entry.countPerRow || 1);
    totals.set(entry.type, (totals.get(entry.type) || 0) + count);
  });
  return [...totals].map(([type, count]) => ({ type, count }));
}

export function buildChapterSixSpawnPattern({ phaseIndex, waveIndex, packetCount, packetKeys = [] }) {
  const gap = CHAPTER_SIX_PACKET_GAPS[phaseIndex][waveIndex];
  if (waveIndex < 3) return Array.from({ length: packetCount }, (_, index) => index * gap);
  const burstGap = phaseIndex <= 2 ? 1400 : phaseIndex <= 4 ? 1200 : 1000;
  const burstPause = phaseIndex <= 2 ? 4000 : phaseIndex <= 4 ? 3500 : 3000;
  const offsets = [0];
  let packetsInBurst = 1;
  for (let index = 1; index < packetCount; index += 1) {
    const finisherBoundary = packetKeys[index] === "C6-12" || packetKeys[index - 1] === "C6-12";
    const startsBurst = finisherBoundary || packetsInBurst >= 3;
    offsets.push(offsets[index - 1] + (startsBurst ? burstPause : burstGap));
    packetsInBurst = startsBurst ? 1 : packetsInBurst + 1;
  }
  return offsets;
}

export function analyzeChapterSixSpawnPattern(pattern) {
  const intervals = pattern.slice(1).map((offset, index) => offset - pattern[index]);
  const burstIntervals = intervals.filter((interval) => interval <= 1500);
  const pauses = intervals.filter((interval) => interval >= 3000);
  let longestBurst = pattern.length ? 1 : 0;
  let currentBurst = pattern.length ? 1 : 0;
  intervals.forEach((interval) => {
    currentBurst = interval <= 1500 ? currentBurst + 1 : 1;
    longestBurst = Math.max(longestBurst, currentBurst);
  });
  return { intervals, burstCount: pauses.length + (pattern.length ? 1 : 0), longestBurst, minBurstInterval: burstIntervals.length ? Math.min(...burstIntervals) : null, maxPause: pauses.length ? Math.max(...pauses) : null };
}

function wave(sequence, phaseIndex, waveIndex, rows = [0, 1, 2, 3, 4]) {
  const spawnPattern = buildChapterSixSpawnPattern({ phaseIndex, waveIndex, packetCount: sequence.length, packetKeys: sequence.map((entry) => entry.key) });
  const packets = sequence.map((entry, index) => instantiateChapterSixPacket(entry.key, index, spawnPattern[index], "main", entry.previewRows || rows, { distribute: entry.distribute === true, routeStrategy: entry.routeStrategy, dynamicRoutes: true }));
  const packetThreat = packets.reduce((total, packet) => total + CHAPTER_SIX_PACKETS[packet.key].threat, 0);
  const roleCounts = Object.fromEntries(["pressure", "anchor", "artillery", "disruption", "assault", "air", "finisher", "mixed"].map((role) => [role, packets.filter((packet) => hasRole(packet.key, role)).length]));
  const routeCounts = Object.fromEntries([0, 1, 2, 3, 4].map((row) => [row, packets.reduce(
    (total, packet) => total + packet.units.reduce(
      (packetTotal, unit) => packetTotal + (unit.rows.includes(row) ? unit.countPerRow || 1 : 0),
      0,
    ),
    0,
  )]));
  const { difficulty, difficultyBreakdown } = calculateChapterSixDifficulty({
    packetThreat, packetCount: packets.length, roleCounts, routeCounts, waveIndex,
    roleWeights: CHAPTER_SIX_PHASE_POLICIES[phaseIndex].roleWeights,
  });
  const unitMetrics = getChapterSixUnitMetrics(aggregateEnemies(packets));
  return {
    enemies: aggregateEnemies(packets), spawnBlocks: [{ id: "main", packets }], spawnWindowMs: spawnPattern.at(-1) || 0,
    maximumLivingEnemies: CHAPTER_SIX_MAXIMUM_LIVING[phaseIndex], coordinated: true, chapterSix: true,
    chapterSixPacketKeys: packets.map((packet) => packet.key), chapterSixWaveIndex: waveIndex,
    packetCount: packets.length, packetThreat,
    difficulty, difficultyBreakdown,
    chapterSixRoleCounts: roleCounts, chapterSixRouteCounts: routeCounts, chapterSixSpawnPattern: spawnPattern,
    ...unitMetrics,
  };
}

const p = (key, routeStrategy, previewRows) => ({ key, routeStrategy, distribute: routeStrategy !== "focused", previewRows });
const fallbacks = ["assault", "artillery", "pressure", "anchor", "disruption"];
const routeFor = (key, index, phaseIndex, waveIndex) => {
  const roles = CHAPTER_SIX_PACKET_ROLES[key];
  const hotLane = (phaseIndex * 2 + waveIndex + 2) % 5;
  if (roles.includes("anchor") || roles.includes("finisher")) return p(key, "focused", [hotLane]);
  if (roles.includes("mixed")) return p(key, "split", [(hotLane + 2) % 5, (hotLane + 3) % 5]);
  if (roles.includes("artillery") && !roles.includes("air")) return p(key, "split", [(hotLane + 4) % 5, (hotLane + 1) % 5]);
  if (roles.includes("air") || index % 4 === 3) return p(key, "spread", [0, 2, 4]);
  return p(key, "split", [index % 5, (index + 2) % 5]);
};

export function violatesConsecutiveLimit(keys, candidate, policy) {
  let consecutive = 0;
  for (let index = keys.length - 1; index >= 0 && keys[index] === candidate; index -= 1) consecutive += 1;
  return consecutive >= policy.maxConsecutiveSame;
}

export function violatesRoleLimit(keys, candidate, policy) {
  if (!hasRole(candidate, "disruption")) return false;
  let consecutive = 0;
  for (let index = keys.length - 1; index >= 0 && hasRole(keys[index], "disruption"); index -= 1) consecutive += 1;
  return consecutive >= policy.maxDisruptionConsecutive;
}

export function violatesAirThreatLimit(keys, candidate, policy) {
  return getChapterSixPacketMetrics([...keys, candidate]).airThreatRatio > (policy.maxAirThreatRatio || 0);
}

export function scoreCandidateByPolicy(key, policy, keys) {
  const roleScore = (CHAPTER_SIX_PACKET_ROLES[key] || []).reduce((total, role) => total + (policy.roleWeights[role] || 0), 0);
  const recentUses = keys.filter((entry) => entry === key).length;
  return CHAPTER_SIX_PACKETS[key].threat + roleScore - recentUses * 10;
}

function pickPacket(role, policy, keys, index) {
  let candidates = packetsForRole(role, policy.allowedPackets);
  if (!candidates.length) candidates = fallbacks.flatMap((fallback) => packetsForRole(fallback, policy.allowedPackets)).filter((key, i, all) => all.indexOf(key) === i);
  const airLimited = candidates.filter((key) => !violatesAirThreatLimit(keys, key, policy));
  // An early air beat can be deferred when its percentage cap cannot yet be met.
  candidates = airLimited.length ? airLimited : policy.allowedPackets.filter((key) => !hasRole(key, "air"));
  candidates = candidates.filter((key) => !violatesConsecutiveLimit(keys, key, policy) && !violatesRoleLimit(keys, key, policy));
  if (!candidates.length) {
    candidates = policy.allowedPackets.filter((key) => (
      !violatesAirThreatLimit(keys, key, policy)
      && !violatesConsecutiveLimit(keys, key, policy)
      && !violatesRoleLimit(keys, key, policy)
    ));
  }
  return candidates.sort((left, right) => scoreCandidateByPolicy(right, policy, keys) - scoreCandidateByPolicy(left, policy, keys) || left.localeCompare(right))[0];
}

function enforcePolicyLimits(keys, blueprint, policy) {
  for (let index = 1; index < keys.length; index += 1) {
    if (violatesConsecutiveLimit(keys.slice(0, index), keys[index], policy) || violatesRoleLimit(keys.slice(0, index), keys[index], policy)) {
      keys[index] = pickPacket(blueprint[index % blueprint.length], policy, keys.slice(0, index), index);
    }
  }
}

export function composeChapterSixWave({ phaseIndex, waveIndex, packetCount }) {
  const policy = CHAPTER_SIX_PHASE_POLICIES[phaseIndex];
  const blueprint = CHAPTER_SIX_WAVE_BLUEPRINTS[waveIndex];
  const keys = [];
  for (let index = 0; index < packetCount; index += 1) keys.push(pickPacket(blueprint[index % blueprint.length], policy, keys, index));
  const introductionKey = [null, "C6-03", "C6-05", null, "C6-08", "C6-10", "C6-12", null][phaseIndex];
  if (introductionKey && waveIndex === 0) keys[0] = introductionKey;
  if (phaseIndex === 0 && waveIndex === 0) keys.fill("C6-01");
  // Salamandra executes after the formation has already demanded attention.
  if (phaseIndex >= 6 && waveIndex >= 4) keys[0] = "C6-08";
  if (!(phaseIndex === 0 && waveIndex === 0)) enforcePolicyLimits(keys, blueprint, policy);
  return keys.map((key, index) => routeFor(key, index, phaseIndex, waveIndex));
}

export function createChapterSixWaves(phaseIndex) {
  const index = Math.max(0, Math.min(7, phaseIndex));
  return CHAPTER_SIX_PACKET_COUNTS[index].map((packetCount, waveIndex) => wave(
    composeChapterSixWave({ phaseIndex: index, waveIndex, packetCount }), index, waveIndex,
  ));
}

export function getChapterSixPhaseMetrics(phaseIndex) {
  const difficulties = createChapterSixWaves(phaseIndex).map((wave) => wave.difficulty);
  return {
    phaseOpeningDifficulty: difficulties[0],
    phaseAverageDifficulty: difficulties.reduce((total, value) => total + value, 0) / difficulties.length,
    phasePeakDifficulty: Math.max(...difficulties),
  };
}
