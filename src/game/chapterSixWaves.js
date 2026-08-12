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

const routeRows = (rows, units, spread = false) => units.map((entry, index) => {
  const selectedRows = spread ? rows : [rows[index % rows.length]];
  return { ...entry, rows: [...selectedRows], countPerRow: entry.count };
});

export function instantiateChapterSixPacket(key, index, spawnAtMs, block = "main", rows = [2], options = {}) {
  const source = CHAPTER_SIX_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  return { id: `${source.id}_${index + 1}`, key, label: source.label, block, spawnAtMs, units: routeRows(rows, source.units, options.spread === true) };
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
  const packets = sequence.map((entry, index) => instantiateChapterSixPacket(entry.key, index, index * gap, "main", entry.rows || rows, { spread: entry.spread !== false }));
  const packetThreat = packets.reduce((total, packet) => total + CHAPTER_SIX_PACKETS[packet.key].threat, 0);
  return {
    enemies: aggregateEnemies(packets), spawnBlocks: [{ id: "main", packets }], spawnWindowMs: Math.max(12000, (packets.length - 1) * gap),
    maximumLivingEnemies: CHAPTER_SIX_MAXIMUM_LIVING[phaseIndex], coordinated: true, chapterSix: true,
    chapterSixPacketKeys: packets.map((packet) => packet.key), chapterSixWaveIndex: waveIndex,
    packetCount: packets.length, packetThreat,
    difficulty: packetThreat + packets.length * 10 + packets.reduce((total, packet) => total + (packet.key === "C6-10" || packet.key === "C6-11" ? 8 : 0), 0),
  };
}

const p = (key, spread = true, rows) => ({ key, spread, ...(rows ? { rows } : {}) });
const templates = [
  ["C6-01", "C6-02"], ["C6-03", "C6-04"], ["C6-05", "C6-06"], ["C6-07", "C6-06"],
  ["C6-08", "C6-09"], ["C6-10", "C6-11"], ["C6-12", "C6-11"], ["C6-08", "C6-10", "C6-12", "C6-06", "C6-07"],
];

export function composeChapterSixWave({ phaseIndex, waveIndex, packetCount }) {
  const available = templates[phaseIndex];
  const introductionKey = [null, "C6-03", "C6-05", null, "C6-08", "C6-10", "C6-12", null][phaseIndex];
  const strongestKey = [...available].sort((left, right) => (
    CHAPTER_SIX_PACKETS[right].threat - CHAPTER_SIX_PACKETS[left].threat
  ))[0];
  const keys = [];
  for (let index = 0; index < packetCount; index += 1) keys.push(strongestKey);
  if (introductionKey && waveIndex === 0) keys[0] = introductionKey;
  if (phaseIndex === 0 && waveIndex === 0) keys.fill("C6-01");
  if (phaseIndex >= 6 && waveIndex >= 4) keys[0] = "C6-10";
  return keys.map((key, index) => p(key, true, [index % 5, (index + 2) % 5]));
}

export function createChapterSixWaves(phaseIndex) {
  const index = Math.max(0, Math.min(7, phaseIndex));
  return CHAPTER_SIX_PACKET_COUNTS[index].map((packetCount, waveIndex) => wave(
    composeChapterSixWave({ phaseIndex: index, waveIndex, packetCount }), index, waveIndex,
    CHAPTER_SIX_PACKET_GAPS[index][waveIndex],
  ));
}
