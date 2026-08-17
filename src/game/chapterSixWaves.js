const unit = (type, count) => ({ type, count });

export const CHAPTER_SIX_ENEMY_POOL = Object.freeze([
  "cuspidorBrasa", "vermeIncubador", "predadorCaldeira", "devoradorCaldeira",
  "rasgaCeusCinereo", "salamandraCinerea",
]);

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
  maxAirRatio: phase < 5 ? 0 : phase === 5 ? .20 : phase === 6 ? .25 : .35,
  roleWeights: { pressure: 18, anchor: 20, artillery: 20, disruption: 18, assault: 25, air: 17, finisher: 22 },
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

export const hasRole = (key, role) => (CHAPTER_SIX_PACKET_ROLES[key] || []).includes(role);
export const packetsForRole = (role, allowedPackets = Object.keys(CHAPTER_SIX_PACKETS)) => allowedPackets.filter((key) => hasRole(key, role));

const routeRows = (rows, units, spread = false) => units.map((entry, index) => {
  const selectedRows = spread ? rows : [rows[index % rows.length]];
  return { ...entry, rows: [...selectedRows], countPerRow: entry.count };
});

export function instantiateChapterSixPacket(key, index, spawnAtMs, block = "main", rows = [2], options = {}) {
  const source = CHAPTER_SIX_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  return { id: `${source.id}_${index + 1}`, key, label: source.label, block, spawnAtMs, routeStrategy: options.routeStrategy, units: routeRows(rows, source.units, options.spread === true) };
}

function aggregateEnemies(packets) {
  const totals = new Map();
  packets.flatMap((packet) => packet.units).forEach((entry) => {
    const count = entry.rows.length * (entry.countPerRow || 1);
    totals.set(entry.type, (totals.get(entry.type) || 0) + count);
  });
  return [...totals].map(([type, count]) => ({ type, count }));
}

function wave(sequence, phaseIndex, waveIndex, gap, rows = [0, 1, 2, 3, 4]) {
  const packets = sequence.map((entry, index) => instantiateChapterSixPacket(entry.key, index, index * gap, "main", entry.rows || rows, { spread: entry.spread === true, routeStrategy: entry.routeStrategy }));
  const packetThreat = packets.reduce((total, packet) => total + CHAPTER_SIX_PACKETS[packet.key].threat, 0);
  const roleCounts = Object.fromEntries(["pressure", "anchor", "artillery", "disruption", "assault", "air", "finisher", "mixed"].map((role) => [role, packets.filter((packet) => hasRole(packet.key, role)).length]));
  const routeCounts = Object.fromEntries([0, 1, 2, 3, 4].map((row) => [row, packets.filter((packet) => packet.units.some((unit) => unit.rows.includes(row))).length]));
  const rolePressure = roleCounts.anchor * 24 + roleCounts.artillery * 12 + roleCounts.disruption * 20 + roleCounts.assault * 18 + roleCounts.air * 22 + roleCounts.finisher * 30;
  return {
    enemies: aggregateEnemies(packets), spawnBlocks: [{ id: "main", packets }], spawnWindowMs: Math.max(12000, (packets.length - 1) * gap),
    maximumLivingEnemies: CHAPTER_SIX_MAXIMUM_LIVING[phaseIndex], coordinated: true, chapterSix: true,
    chapterSixPacketKeys: packets.map((packet) => packet.key), chapterSixWaveIndex: waveIndex,
    packetCount: packets.length, packetThreat,
    // The fixed escalation makes an equal-count climax objectively stronger than its predecessor.
    difficulty: packetThreat + packets.length * 10 + rolePressure + (waveIndex + 1) * 1000,
    chapterSixRoleCounts: roleCounts, chapterSixRouteCounts: routeCounts,
  };
}

const p = (key, routeStrategy, rows) => ({ key, routeStrategy, spread: routeStrategy !== "focused", rows });
const fallbacks = ["assault", "artillery", "pressure", "anchor", "disruption"];
const routeFor = (key, index, phaseIndex, waveIndex) => {
  const roles = CHAPTER_SIX_PACKET_ROLES[key];
  const hotLane = (phaseIndex * 2 + waveIndex + 2) % 5;
  if (roles.includes("anchor") || roles.includes("finisher")) return p(key, "focused", [hotLane]);
  if (roles.includes("artillery") && !roles.includes("air")) return p(key, "split", [(hotLane + 4) % 5, (hotLane + 1) % 5]);
  if (roles.includes("air") || index % 4 === 3) return p(key, "spread", [0, 2, 4]);
  return p(key, "split", [index % 5, (index + 2) % 5]);
};

function pickPacket(role, policy, keys, index, phaseIndex, waveIndex) {
  let candidates = packetsForRole(role, policy.allowedPackets);
  if (!candidates.length) candidates = fallbacks.flatMap((fallback) => packetsForRole(fallback, policy.allowedPackets)).filter((key, i, all) => all.indexOf(key) === i);
  const airCount = keys.filter((key) => hasRole(key, "air")).length;
  const airLimited = candidates.filter((key) => !(hasRole(key, "air") && (airCount + 1) / (index + 1) > policy.maxAirRatio));
  // An early air beat can be deferred when its percentage cap cannot yet be met.
  candidates = airLimited.length ? airLimited : policy.allowedPackets.filter((key) => !hasRole(key, "air"));
  const nonSpam = candidates.filter((key) => !(keys.at(-1) === key && keys.at(-2) === key));
  candidates = nonSpam.length ? nonSpam : candidates;
  const noWormSpam = candidates.filter((key) => !(hasRole(key, "disruption") && hasRole(keys.at(-1), "disruption")));
  candidates = noWormSpam.length ? noWormSpam : candidates;
  // Seeded index: deterministic, varied and biased toward packets not just used.
  return candidates[(phaseIndex * 13 + waveIndex * 7 + index * 5) % candidates.length];
}

export function composeChapterSixWave({ phaseIndex, waveIndex, packetCount }) {
  const policy = CHAPTER_SIX_PHASE_POLICIES[phaseIndex];
  const blueprint = CHAPTER_SIX_WAVE_BLUEPRINTS[waveIndex];
  const keys = [];
  for (let index = 0; index < packetCount; index += 1) keys.push(pickPacket(blueprint[index % blueprint.length], policy, keys, index, phaseIndex, waveIndex));
  const introductionKey = [null, "C6-03", "C6-05", null, "C6-08", "C6-10", "C6-12", null][phaseIndex];
  if (introductionKey && waveIndex === 0) keys[0] = introductionKey;
  if (phaseIndex === 0 && waveIndex === 0) keys.fill("C6-01");
  // Salamandra executes after the formation has already demanded attention.
  if (phaseIndex >= 6 && waveIndex >= 4) keys[0] = "C6-08";
  // Overrides above must not reintroduce repetition in ordinary waves.
  if (!(phaseIndex === 0 && waveIndex === 0)) {
    for (let index = 2; index < keys.length; index += 1) {
      if (keys[index] === keys[index - 1] && keys[index] === keys[index - 2]) {
        const replacement = pickPacket(blueprint[index % blueprint.length], policy, keys.slice(0, index), index + 1, phaseIndex, waveIndex);
        keys[index] = replacement !== keys[index - 1]
          ? replacement
          : policy.allowedPackets.find((key) => key !== keys[index - 1]) || replacement;
      }
    }
  }
  return keys.map((key, index) => routeFor(key, index, phaseIndex, waveIndex));
}

export function createChapterSixWaves(phaseIndex) {
  const index = Math.max(0, Math.min(7, phaseIndex));
  return CHAPTER_SIX_PACKET_COUNTS[index].map((packetCount, waveIndex) => wave(
    composeChapterSixWave({ phaseIndex: index, waveIndex, packetCount }), index, waveIndex,
    CHAPTER_SIX_PACKET_GAPS[index][waveIndex],
  ));
}
