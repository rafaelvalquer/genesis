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
  [48,60],[50,62],[52,66],[54,68],[56,72],[58,76],[60,80],[62,84],
];
const REINFORCEMENT_RATIOS = [0.5,0.5,0.5,0.6,0.6,0.6,0.7,0.7];
const REINFORCEMENT_POOLS = [
  ["P1"],
  ["P1","P3"],
  ["P1","P3","P4"],
  ["P1","P2","P3"],
  ["P1","P3","P4"],
  ["P1","P3","P8"],
  ["P1","P3","P4","P8"],
  ["P1","P3","P4","P8"],
];
const BLOCKS = ["opening", "main", "main", "elite", "counter", "climax", "climax", "final"];

const CHAPTER_FOUR_WAVE_OVERRIDES = Object.freeze({
  "6:0": Object.freeze({
    sequence: Object.freeze(["P1", "P3", "P1", "P4", "P3", "P5", "P1", "P8"]),
    spawnWindowMs: 66000,
    densify: false,
  }),
  // Reduz a pressão inicial da fase final sem alterar as ondas seguintes.
  "7:0": Object.freeze({
    sequence: Object.freeze(["P1", "P3", "P2", "P4", "P5"]),
  }),
});

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

function densifySequence(sequence, phaseIndex, waveIndex) {
  const ratio = REINFORCEMENT_RATIOS[phaseIndex] ?? 0.5;
  const pool = REINFORCEMENT_POOLS[phaseIndex] || ["P1"];
  let reinforcementProgress = 0;
  let reinforcementIndex = waveIndex;
  const entries = [];

  sequence.forEach((key, sourcePacketIndex) => {
    entries.push({ key, sourcePacketIndex, reinforcement: false });
    reinforcementProgress += ratio;
    if (reinforcementProgress < 1) return;
    reinforcementProgress -= 1;
    const reinforcementKey = pool[reinforcementIndex % pool.length];
    reinforcementIndex += 1;
    entries.push({ key: reinforcementKey, sourcePacketIndex: -1, reinforcement: true });
  });

  return entries;
}

export function createChapterFourWaves(phaseIndex) {
  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];
  const [windowStart, windowEnd] = PHASE_SPAWN_WINDOWS[phaseIndex] || [56, 72];
  return sequences.map((sequence, waveIndex) => {
    const waveProgress = sequences.length <= 1 ? 1 : waveIndex / (sequences.length - 1);
    const override = CHAPTER_FOUR_WAVE_OVERRIDES[`${phaseIndex}:${waveIndex}`];
    const sourceSequence = override?.sequence || sequence;
    const defaultSpawnWindowMs = Math.round((windowStart + (windowEnd - windowStart) * waveProgress) * 1000);
    const spawnWindowMs = override?.spawnWindowMs ?? defaultSpawnWindowMs;
    const denseSequence = override?.densify === false
      ? sourceSequence.map((key, sourcePacketIndex) => ({ key, sourcePacketIndex, reinforcement: false }))
      : densifySequence(sourceSequence, phaseIndex, waveIndex);
    const packets = denseSequence.map((entry, packetIndex) => {
      const at = denseSequence.length <= 1 ? 0 : Math.round(packetIndex * spawnWindowMs / (denseSequence.length - 1));
      return instantiateChapterFourPacket(
        entry.key,
        packetIndex,
        at,
        BLOCKS[Math.min(packetIndex, BLOCKS.length - 1)],
        entry.reinforcement ? null : alphaFor(phaseIndex, waveIndex, entry.sourcePacketIndex, entry.key),
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

export { CHAPTER_FOUR_WAVE_OVERRIDES, PHASE_PACKET_SEQUENCES, PHASE_SPAWN_WINDOWS };
