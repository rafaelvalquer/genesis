import { CHAPTER_FOUR_PACKETS, instantiateChapterFourPacket } from "./chapterFourPackets.js";

const PHASE_PACKET_SEQUENCES = Object.freeze([
  [["P1","P1","P3","P1"],["P3","P1","P3","P1"],["P1","P3","P1","P3","P3"],["P3","P1","P3","P3","P1","P3"],["P1","P3","P3","P1","P3","P3","P1"]],
  [["P1","P4","P1","P3"],["P3","P1","P4","P1","P4"],["P1","P4","P3","P4","P3"],["P3","P4","P1","P4","P3","P4","P1"],["P1","P3","P4","P4","P3","P4","P3"]],
  [["P1","P3","P5","P1"],["P4","P1","P5","P4","P3"],["P3","P5","P1","P4","P5"],["P1","P3","P5","P4","P5","P3"],["P3","P5","P4","P1","P5","P5","P4"]],
  [["P1","P2","P3","P1"],["P3","P2","P4","P5","P1"],["P1","P2","P4","P5","P2"],["P3","P2","P4","P5","P1","P6"],["P1","P3","P2","P4","P5","P6"]],
  [["P1","P3","P4","P2","P5"],["P3","P2","P4","P5","P1","P4"],["P1","P5","P2","P4","P6","P3"],["P3","P4","P2","P5","P7","P1"],["P2","P4","P5","P3","P6","P7"],["P1","P3","P5","P4","P6","P7","P2"]],
  [["P1","P4","P2","P5","P8"],["P3","P8","P4","P5","P2","P1"],["P2","P4","P5","P8","P6","P3"],["P3","P7","P2","P4","P8","P5"],["P1","P5","P8","P4","P6","P7"],["P3","P2","P4","P5","P8","P7","P6"]],
  [["P1","P3","P5","P8","P4","P6"],["P2","P4","P5","P7","P8","P3","P1"],["P3","P5","P2","P4","P6","P7","P8"],["P1","P8","P5","P7","P2","P6","P4","P3"],["P3","P2","P7","P5","P8","P6","P9"],["P1","P4","P5","P2","P7","P8","P6","P9"]],
  [["P1","P3","P2","P4","P5","P8"],["P3","P5","P4","P2","P7","P6"],["P1","P4","P5","P8","P7","P6"],["P3","P2","P4","P5","P8","P9"],["P1","P5","P7","P2","P6","P8","P9"],["P3","P4","P5","P8","P7","P6","P9"],["P2","P4","P5","P6","P7","P8","P9","P3","P6"]],
]);

const PHASE_SPAWN_WINDOWS = [
  [80,100],[82,104],[85,108],[88,112],[90,118],[92,122],[95,128],[98,138],
];
const BLOCKS = ["opening", "main", "main", "elite", "counter", "climax", "climax", "final"];

function aggregateEnemies(packets) {
  const totals = new Map();
  for (const unit of packets.flatMap((packet) => packet.units)) {
    const key = `${unit.type}:${unit.variant || ""}`;
    const current = totals.get(key) || { type: unit.type, count: 0 };
    current.count += unit.count;
    if (unit.variant) current.variant = unit.variant;
    totals.set(key, current);
  }
  return [...totals.values()];
}

function alphaFor(phaseIndex, waveIndex, packetIndex, packetKey) {
  if (phaseIndex !== 7) return null;
  if (waveIndex === 2 && packetIndex === 0 && packetKey === "P1") return { type: "voltriz" };
  if (waveIndex === 3 && packetKey === "P2") return { type: "nimbarca" };
  if (waveIndex === 5 && packetIndex === 0 && packetKey === "P3") return { type: "gorjal" };
  if (waveIndex === 6 && packetKey === "P6") return { type: "nimbarca" };
  if (waveIndex === 6 && packetKey === "P9") return { type: "gorjal" };
  return null;
}

export function createChapterFourWaves(phaseIndex) {
  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];
  const [windowStart, windowEnd] = PHASE_SPAWN_WINDOWS[phaseIndex] || [90, 120];
  return sequences.map((sequence, waveIndex) => {
    const waveProgress = sequences.length <= 1 ? 1 : waveIndex / (sequences.length - 1);
    const spawnWindowMs = Math.round((windowStart + (windowEnd - windowStart) * waveProgress) * 1000);
    const packets = sequence.map((key, packetIndex) => {
      const at = sequence.length <= 1 ? 0 : Math.round(packetIndex * spawnWindowMs / (sequence.length - 1));
      return instantiateChapterFourPacket(
        key,
        packetIndex,
        at,
        BLOCKS[Math.min(packetIndex, BLOCKS.length - 1)],
        alphaFor(phaseIndex, waveIndex, packetIndex, key),
      );
    });
    const spawnBlocks = [...new Set(BLOCKS)].map((block) => ({
      id: block,
      packets: packets.filter((packet) => packet.block === block),
    })).filter((block) => block.packets.length);
    return {
      enemies: aggregateEnemies(packets),
      spawnBlocks,
      spawnWindowMs,
      coordinated: true,
      chapterFour: true,
      packetThreat: packets.reduce((sum, packet) => sum + CHAPTER_FOUR_PACKETS[packet.key].threat, 0),
    };
  });
}

export { PHASE_PACKET_SEQUENCES, PHASE_SPAWN_WINDOWS };
