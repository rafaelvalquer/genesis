const unit = (type, count) => ({ type, count });

export const CHAPTER_SIX_ENEMY_POOL = Object.freeze([
  "cuspidorBrasa", "vermeIncubador", "predadorCaldeira", "devoradorCaldeira",
  "rasgaCeusCinereo", "salamandraCinerea",
]);

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

export const CHAPTER_SIX_INTRODUCTIONS = Object.freeze([
  null, "vermeIncubador", "predadorCaldeira", null, "devoradorCaldeira", "rasgaCeusCinereo", "salamandraCinerea", null,
]);

const routeRows = (rows, units) => units.map((entry, index) => {
  const row = rows[index % rows.length];
  return { ...entry, rows: [row], countPerRow: entry.count };
});

export function instantiateChapterSixPacket(key, index, spawnAtMs, block = "main", rows = [2]) {
  const source = CHAPTER_SIX_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  return {
    id: `${source.id}_${index + 1}`,
    key,
    label: source.label,
    block,
    spawnAtMs,
    units: routeRows(rows, source.units).map((entry) => ({ ...entry, rows: [...entry.rows] })),
  };
}

function aggregateEnemies(packets) {
  const totals = new Map();
  packets.flatMap((packet) => packet.units).forEach((entry) => {
    const count = entry.rows?.length ? entry.rows.length * (entry.countPerRow || 1) : entry.count;
    totals.set(entry.type, (totals.get(entry.type) || 0) + count);
  });
  return [...totals].map(([type, count]) => ({ type, count }));
}

function wave(sequence, phaseIndex, waveIndex, { rows = [2], spawnWindowMs = 12000, blocks = ["main"], coordinated = true } = {}) {
  const packets = sequence.map((entry, index) => instantiateChapterSixPacket(entry.key, index, entry.at ?? index * 2200, entry.block || blocks[index % blocks.length], entry.rows || rows));
  const spawnBlocks = [...new Set(packets.map((packet) => packet.block))].map((id) => ({ id, packets: packets.filter((packet) => packet.block === id) }));
  return {
    enemies: aggregateEnemies(packets), spawnBlocks, spawnWindowMs,
    maximumLivingEnemies: 18 + phaseIndex * 3, coordinated, chapterSix: true,
    chapterSixPacketKeys: sequence.map((entry) => entry.key), chapterSixWaveIndex: waveIndex,
  };
}

const p = (key, at = 0, rows) => ({ key, at, ...(rows ? { rows } : {}) });

export function createChapterSixWaves(phaseIndex) {
  const plans = [
    [wave([p("C6-01", 0, [2])], 0, 0), wave([p("C6-01", 0, [1, 3])], 0, 1, { rows: [1, 3] }), wave([p("C6-02", 0, [2])], 0, 2), wave([p("C6-02", 0, [0, 2, 4])], 0, 3, { rows: [0, 2, 4] })],
    [wave([p("C6-03", 0, [2])], 1, 0), wave([p("C6-04", 0, [1, 3])], 1, 1, { rows: [1, 3] }), wave([p("C6-03", 0, [2]), p("C6-01", 4200, [0, 4])], 1, 2, { rows: [0, 2, 4] }), wave([p("C6-04", 0, [0, 2, 4])], 1, 3, { rows: [0, 2, 4] })],
    [wave([p("C6-05", 0, [2])], 2, 0), wave([p("C6-03", 0, [1, 3])], 2, 1, { rows: [1, 3] }), wave([p("C6-06", 0, [2])], 2, 2), wave([p("C6-06", 0, [0, 2, 4])], 2, 3, { rows: [0, 2, 4] })],
    [wave([p("C6-03", 0, [2])], 3, 0), wave([p("C6-05", 0, [1, 3])], 3, 1, { rows: [1, 3] }), wave([p("C6-06", 0, [0, 2, 4]), p("C6-01", 4800, [1, 3])], 3, 2, { rows: [0, 1, 2, 3, 4] }), wave([p("C6-07", 0, [2])], 3, 3), wave([p("C6-07", 0, [0, 2, 4]), p("C6-06", 5200, [1, 3]), p("C6-04", 10400, [2])], 3, 4, { rows: [0, 1, 2, 3, 4] })],
    [wave([p("C6-08", 0, [2])], 4, 0), wave([p("C6-08", 0, [1, 3])], 4, 1, { rows: [1, 3] }), wave([p("C6-09", 0, [2])], 4, 2), wave([p("C6-08", 0, [0, 2, 4]), p("C6-09", 5000, [1, 3])], 4, 3, { rows: [0, 1, 2, 3, 4] }), wave([p("C6-08", 0, [1]), p("C6-09", 4200, [2]), p("C6-04", 8400, [3])], 4, 4, { rows: [1, 2, 3] })],
    [wave([p("C6-10", 0, [2])], 5, 0), wave([p("C6-10", 0, [1, 3])], 5, 1, { rows: [1, 3] }), wave([p("C6-10", 0, [0, 4]), p("C6-08", 4200, [2])], 5, 2, { rows: [0, 2, 4] }), wave([p("C6-11", 0, [1, 3])], 5, 3, { rows: [1, 3] }), wave([p("C6-10", 0, [0]), p("C6-08", 4200, [2]), p("C6-04", 8400, [4])], 5, 4, { rows: [0, 2, 4] })],
    [wave([p("C6-12", 0, [2])], 6, 0), wave([p("C6-12", 0, [1]), p("C6-01", 3600, [3])], 6, 1, { rows: [1, 3] }), wave([p("C6-12", 0, [2]), p("C6-05", 4200, [0, 4])], 6, 2, { rows: [0, 2, 4] }), wave([p("C6-12", 0, [0, 2, 4])], 6, 3, { rows: [0, 2, 4] }), wave([p("C6-07", 0, [1, 3]), p("C6-10", 4800, [0, 4])], 6, 4, { rows: [0, 1, 3, 4] }), wave([p("C6-12", 0, [0, 4]), p("C6-11", 5200, [1, 2, 3])], 6, 5, { rows: [0, 1, 2, 3, 4] })],
    [wave([p("C6-03", 0, [2])], 7, 0), wave([p("C6-05", 0, [1, 3])], 7, 1, { rows: [1, 3] }), wave([p("C6-06", 0, [0, 2, 4])], 7, 2, { rows: [0, 2, 4] }), wave([p("C6-08", 0, [1, 3]), p("C6-09", 5200, [0, 2, 4])], 7, 3, { rows: [0, 1, 2, 3, 4] }), wave([p("C6-10", 0, [0, 4]), p("C6-04", 4200, [1, 3]), p("C6-08", 8400, [2]), p("C6-06", 12600, [0, 4]), p("C6-10", 16800, [1, 3])], 7, 4, { rows: [0, 1, 2, 3, 4], spawnWindowMs: 22000 }), wave([p("C6-05", 0, [1, 3]), p("C6-03", 4000, [0, 2, 4]), p("C6-08", 8000, [2]), p("C6-10", 12000, [0, 4]), p("C6-12", 16000, [1, 3])], 7, 5, { rows: [0, 1, 2, 3, 4], spawnWindowMs: 22000 })],
  ];
  return plans[Math.max(0, Math.min(plans.length - 1, phaseIndex))];
}
