import { CHAPTER_FIVE_PACKETS, instantiateChapterFivePacket } from "./chapterFivePackets.js";

const PHASE_PACKET_SEQUENCES = Object.freeze([
  [["N1","N2","N1","N2"],["N1","N5","N1","N2"],["N2","N1","N5","N1"],["N3","N6","N2","N1"],["N5","N4","N6","N2","N1"],["N2","N5","N6","N10","N1","N6"]],
  [["N1","N2","N5","N1","N2"],["N5","N3","N2","N4","N1"],["N6","N1","N2","N5","N1"],["N4","N6","N3","N5","N2","N1"],["N6","N3","N2","N5","N4","N1"],["N7","N4","N5","N10","N6","N2"]],
  [["N3","N2","N1","N5","N2"],["N4","N3","N5","N1","N2"],["N6","N3","N10","N2","N1"],["N7","N4","N5","N11","N2"],["N8","N3","N10","N11","N5","N2"],["N7","N6","N10","N3","N11","N2"]],
  [["N2","N1","N3","N10","N2"],["N4","N2","N11","N3","N5"],["N5","N2","N6","N10","N1"],["N7","N3","N11","N5","N2"],["N8","N4","N6","N10","N11","N2"],["N11","N8","N5","N11","N7","N2"]],
  [["N3","N5","N10","N2","N1","N3"],["N7","N4","N11","N5","N2","N1"],["N8","N6","N10","N3","N5","N2"],["N9","N4","N7","N11","N5","N12"],["N9","N8","N6","N10","N11","N12","N3"],["N10","N11","N8","N12","N6","N10","N11","N12"]],
  [["N6","N10","N1","N11","N2","N1"],["N4","N6","N13","N3","N10","N1"],["N7","N11","N2","N13","N10","N1"],["N8","N6","N13","N10","N11","N5"],["N7","N8","N11","N13","N6","N12","N5"],["N9","N13","N10","N11","N8","N13","N12","N5"]],
  [["N3","N5","N10","N2","N11","N3","N13"],["N7","N4","N12","N11","N5","N13","N1"],["N8","N6","N13","N10","N11","N3","N5"],["N9","N4","N7","N12","N13","N11","N5"],["N10","N13","N8","N12","N11","N14","N9","N13"],["N10","N13","N8","N12","N11","N14","N9","N13","N14"]],
  [["N10","N13","N8","N12","N11","N14","N9"],["N13","N10","N14","N8","N12","N11","N13","N14"],["N10","N13","N8","N12","N11","N14","N9","N13","N14"],["N13","N10","N14","N8","N12","N11","N13","N14"],["N10","N13","N8","N12","N11","N14","N9","N13","N14"],["N10","N11","N8","N12","N13","N10","N14"]],
]);

export const PHASE_PACKET_GAPS = Object.freeze([
  [14000, 13000, 12000, 11500, 10500, 10000],
  [12000, 11500, 10500, 10000, 9500, 9000],
  [11000, 10500, 9500, 9000, 8500, 8000],
  [10000, 9500, 9000, 8500, 8000, 7500],
  [9000, 8500, 8000, 7500, 7000, 7000],
  [8000, 7500, 7000, 6500, 6000, 6000],
  [7000, 6500, 6200, 6000, 5700, 5500],
  [6500, 6200, 6000, 5700, 5400, 5000],
]);
const PHASE_MAXIMUM_LIVING = [20, 24, 28, 32, 36, 40, 44, 48];
const BLOCKS = ["opening", "main", "elite", "counter", "climax", "final"];
const BOSS_ENCOUNTER = Object.freeze({
  type: "leviathanNereida", spawnAtMs: 18000,
  reinforcements: [{ hpFactor: .85, packet: "N6" }, { hpFactor: .70, packet: "N10" }, { hpFactor: .55, packet: "N11" }, { hpFactor: .40, packet: "N12" }, { hpFactor: .25, packet: "N13" }, { hpFactor: .12, packet: "N14" }],
  maximumLivingByType: { medusaVeuSalino: 3, carapacaNereida: 4, enguiaRasgamar: 5, mordelume: 16 },
});

function unitCount(unit) { return unit.rows?.length ? unit.rows.length * (unit.countPerRow || 1) : unit.count; }
function aggregateEnemies(packets) { const totals = new Map(); for (const unit of packets.flatMap((packet) => packet.units)) { const current = totals.get(unit.type) || { type: unit.type, count: 0 }; current.count += unitCount(unit); totals.set(unit.type, current); } return [...totals.values()]; }

export function createChapterFiveWaves(phaseIndex) {
  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];
  return sequences.map((sequence, waveIndex) => {
    const gap = PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;
    const packets = sequence.map((key, index) => instantiateChapterFivePacket(key, index, index * gap, BLOCKS[Math.min(index, BLOCKS.length - 1)]));
    const spawnWindowMs = packets.at(-1)?.spawnAtMs || 0;
    return { enemies: aggregateEnemies(packets), spawnBlocks: [...new Set(BLOCKS)].map((id) => ({ id, packets: packets.filter((packet) => packet.block === id) })).filter((block) => block.packets.length), spawnWindowMs, packetGapMs: gap, maximumLivingEnemies: PHASE_MAXIMUM_LIVING[phaseIndex], coordinated: true, chapterFive: true, packetThreat: packets.reduce((sum, packet) => sum + CHAPTER_FIVE_PACKETS[packet.key].threat, 0), ...(phaseIndex === 7 && waveIndex === 5 ? { bossEncounter: BOSS_ENCOUNTER } : {}) };
  });
}

export { PHASE_PACKET_SEQUENCES };
