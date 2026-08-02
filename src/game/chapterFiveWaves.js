import { CHAPTER_FIVE_PACKETS, instantiateChapterFivePacket } from "./chapterFivePackets.js";

const PHASE_PACKET_SEQUENCES = Object.freeze([
  [["N1","N1"],["N1","N2","N1"],["N2","N1","N2","N1"],["N3","N1","N2","N1"],["N3","N2","N1","N3"],["N3","N2","N3","N5","N1"]],
  [["N1","N2","N1","N3"],["N4","N3","N1","N2"],["N6","N1","N2","N1"],["N4","N3","N2","N5","N1"],["N6","N3","N2","N5","N1"],["N7","N4","N5","N2","N1","N3"]],
  [["N3","N1","N2","N1"],["N4","N3","N1","N2","N1"],["N6","N3","N2","N1","N1"],["N7","N4","N2","N3","N1"],["N8","N3","N5","N1","N2"],["N7","N6","N5","N3","N2"]],
  [["N2","N1","N3","N2"],["N4","N2","N3","N5"],["N5","N2","N6","N1"],["N7","N3","N5","N2"],["N8","N4","N6","N2"],["N7","N8","N5","N3","N2"]],
  [["N3","N2","N1","N2","N1"],["N5","N3","N2","N4","N1"],["N7","N3","N5","N2","N1"],["N8","N4","N5","N3","N2"],["N7","N6","N5","N3","N2"],["N8","N7","N5","N6","N2"]],
  [["N6","N1","N2","N1"],["N4","N6","N3","N1"],["N7","N6","N2","N1"],["N8","N6","N3","N2"],["N7","N8","N6","N5"],["N9","N7","N6","N5","N3"]],
  [["N3","N5","N2","N1","N3"],["N7","N4","N5","N2","N1"],["N8","N6","N3","N5"],["N9","N4","N7","N5"],["N9","N8","N6","N5","N3"],["N9","N7","N8","N6","N5","N3"]],
  [["N3","N2","N1","N4","N5"],["N7","N5","N4","N6"],["N8","N6","N5","N3","N2"],["N9","N7","N5","N4","N2"],["N9","N8","N7","N6","N5"],["N2","N3"]],
]);
const PHASE_SPAWN_WINDOWS = Object.freeze([[48,68],[50,72],[52,76],[54,80],[56,84],[58,88],[60,92],[62,96]]);
const BLOCKS = ["opening", "main", "elite", "counter", "climax", "final"];
const BOSS_ENCOUNTER = Object.freeze({ type: "leviathanNereida", spawnAtMs: 20000, reinforcements: [{ hpFactor: 0.70, packet: "N4" }, { hpFactor: 0.35, packet: "N8" }], maximumLivingByType: { medusaVeuSalino: 2, carapacaNereida: 4, enguiaRasgamar: 4, mordelume: 12 } });

function aggregateEnemies(packets) { const totals = new Map(); for (const unit of packets.flatMap((packet) => packet.units)) { const current = totals.get(unit.type) || { type: unit.type, count: 0 }; current.count += unit.count; totals.set(unit.type, current); } return [...totals.values()]; }

export function createChapterFiveWaves(phaseIndex) {
  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];
  const [start, end] = PHASE_SPAWN_WINDOWS[phaseIndex] || [56, 72];
  return sequences.map((sequence, waveIndex) => {
    const window = Math.round((start + (end - start) * (sequences.length <= 1 ? 1 : waveIndex / (sequences.length - 1))) * 1000);
    const packets = sequence.map((key, index) => instantiateChapterFivePacket(key, index, sequence.length <= 1 ? 0 : Math.round(index * window / (sequence.length - 1)), BLOCKS[Math.min(index, BLOCKS.length - 1)]));
    return { enemies: aggregateEnemies(packets), spawnBlocks: [...new Set(BLOCKS)].map((id) => ({ id, packets: packets.filter((packet) => packet.block === id) })).filter((block) => block.packets.length), spawnWindowMs: window, coordinated: true, chapterFive: true, packetThreat: packets.reduce((sum, packet) => sum + CHAPTER_FIVE_PACKETS[packet.key].threat, 0), ...(phaseIndex === 7 && waveIndex === 5 ? { bossEncounter: BOSS_ENCOUNTER } : {}) };
  });
}

export { PHASE_PACKET_SEQUENCES, PHASE_SPAWN_WINDOWS };
