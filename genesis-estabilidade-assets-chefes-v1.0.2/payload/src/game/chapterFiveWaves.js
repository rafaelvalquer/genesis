import { CHAPTER_FIVE_PACKETS, instantiateChapterFivePacket } from "./chapterFivePackets.js";
import { PHASE_40_SCENARIO, isPhase40Scenario } from "./chapter05/phase40Scenario.js";

const STANDARD_PHASE_PACKET_SEQUENCES = Object.freeze([
  [["N1","N2","N1","N2"],["N1","N5","N1","N2"],["N2","N1","N5","N1"],["N3","N6","N2","N1"],["N5","N4","N6","N2","N1"],["N2","N5","N6","N10","N1","N6"]],
  [["N1","N2","N5","N1","N2"],["N5","N3","N2","N4","N1"],["N6","N1","N2","N5","N1"],["N4","N6","N3","N5","N2","N1"],["N6","N3","N2","N5","N4","N1"],["N7","N4","N5","N10","N6","N2"]],
  [["N3","N2","N1","N5","N2"],["N4","N3","N5","N1","N2"],["N6","N3","N10","N2","N1"],["N7","N4","N5","N11","N2"],["N8","N3","N10","N11","N5","N2"],["N7","N6","N10","N3","N11","N2"]],
  [["N2","N1","N3","N10","N2"],["N4","N2","N11","N3","N5"],["N5","N2","N6","N10","N1"],["N7","N3","N11","N5","N2"],["N8","N4","N6","N10","N11","N2"],["N11","N8","N5","N11","N7","N2"]],
  [["N3","N5","N10","N2","N1","N3"],["N7","N4","N11","N5","N2","N1"],["N8","N6","N10","N3","N5","N2"],["N9","N4","N7","N11","N5","N12"],["N9","N8","N6","N10","N11","N12","N3"],["N10","N11","N8","N12","N6","N10","N11","N12"]],
  [["N6","N10","N1","N11","N2","N1"],["N4","N6","N13","N3","N10","N1"],["N7","N11","N2","N13","N10","N1"],["N8","N6","N13","N10","N11","N5"],["N7","N8","N11","N13","N6","N12","N5"],["N9","N13","N10","N11","N8","N13","N12","N5"]],
  [["N3","N5","N10","N2","N11","N3","N13"],["N7","N4","N12","N11","N5","N13","N1"],["N8","N6","N13","N10","N11","N3","N5"],["N9","N4","N7","N12","N13","N11","N5"],["N10","N13","N8","N12","N11","N14","N9","N13"],["N10","N13","N8","N12","N11","N14","N9","N13","N14"]],
]);

export const PHASE_40_BALANCED_PACKET_SEQUENCES = PHASE_40_SCENARIO.packetSequences;
export const PHASE_40_PACKET_GAPS = PHASE_40_SCENARIO.packetGaps;
export const PHASE_40_MAXIMUM_LIVING = PHASE_40_SCENARIO.maximumLivingEnemies;

export const PHASE_PACKET_SEQUENCES = Object.freeze([
  ...STANDARD_PHASE_PACKET_SEQUENCES,
  PHASE_40_SCENARIO.packetSequences,
]);

const STANDARD_PHASE_PACKET_GAPS = Object.freeze([
  [14000, 13000, 12000, 11500, 10500, 10000],
  [12000, 11500, 10500, 10000, 9500, 9000],
  [11000, 10500, 9500, 9000, 8500, 8000],
  [10000, 9500, 9000, 8500, 8000, 7500],
  [9000, 8500, 8000, 7500, 7000, 7000],
  [8000, 7500, 7000, 6500, 6000, 6000],
  [7000, 6500, 6200, 6000, 5700, 5500],
]);

export const PHASE_PACKET_GAPS = Object.freeze([
  ...STANDARD_PHASE_PACKET_GAPS,
  PHASE_40_SCENARIO.packetGaps,
]);

const PHASE_MAXIMUM_LIVING = Object.freeze([
  20,
  24,
  28,
  32,
  36,
  40,
  44,
  PHASE_40_SCENARIO.maximumLivingEnemies,
]);

const BLOCKS = ["opening", "main", "elite", "counter", "climax", "final"];

function unitCount(unit) {
  return unit.rows?.length
    ? unit.rows.length * (unit.countPerRow || 1)
    : unit.count;
}

function aggregateEnemies(packets) {
  const totals = new Map();
  for (const unit of packets.flatMap((packet) => packet.units)) {
    const current = totals.get(unit.type) || { type: unit.type, count: 0 };
    current.count += unitCount(unit);
    totals.set(unit.type, current);
  }
  return [...totals.values()];
}

function normalizeWaveOptions(input) {
  const raw = Number.isInteger(input) ? { phaseIndex: input } : input || {};
  const phaseIndex = Number(raw.phaseIndex);
  if (!Number.isInteger(phaseIndex)
    || phaseIndex < 0
    || phaseIndex >= PHASE_PACKET_SEQUENCES.length) {
    throw new RangeError(
      `createChapterFiveWaves requer phaseIndex entre 0 e ${PHASE_PACKET_SEQUENCES.length - 1}.`,
    );
  }

  const expectedPhaseId = `fase_${String(33 + phaseIndex).padStart(2, "0")}`;
  const phaseId = raw.phaseId || expectedPhaseId;
  if (phaseId !== expectedPhaseId) {
    throw new Error(
      `Configuração inconsistente: phaseIndex ${phaseIndex} corresponde a ${expectedPhaseId}, não a ${phaseId}.`,
    );
  }

  const finalMission = isPhase40Scenario({
    phaseIndex,
    phaseId,
    finalMission: raw.finalMission,
  });
  return { phaseIndex, phaseId, finalMission };
}

export function createChapterFiveWaves(input) {
  const { phaseIndex, finalMission } = normalizeWaveOptions(input);
  const sequences = finalMission
    ? PHASE_40_SCENARIO.packetSequences
    : PHASE_PACKET_SEQUENCES[phaseIndex] || [];

  return sequences.map((sequence, waveIndex) => {
    const gap = finalMission
      ? PHASE_40_SCENARIO.packetGaps[waveIndex]
      : PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;

    const packets = sequence.map((key, index) => instantiateChapterFivePacket(
      key,
      index,
      index * gap,
      BLOCKS[Math.min(index, BLOCKS.length - 1)],
    ));
    const spawnWindowMs = packets.at(-1)?.spawnAtMs || 0;
    const bossEncounter = finalMission
      && waveIndex === PHASE_40_SCENARIO.finalWaveIndex
      ? { bossEncounter: PHASE_40_SCENARIO.bossEncounter }
      : {};

    return {
      enemies: aggregateEnemies(packets),
      spawnBlocks: [...new Set(BLOCKS)]
        .map((id) => ({
          id,
          packets: packets.filter((packet) => packet.block === id),
        }))
        .filter((block) => block.packets.length),
      spawnWindowMs,
      packetGapMs: gap,
      maximumLivingEnemies: finalMission
        ? PHASE_40_SCENARIO.maximumLivingEnemies
        : PHASE_MAXIMUM_LIVING[phaseIndex],
      coordinated: true,
      chapterFive: true,
      packetThreat: packets.reduce(
        (sum, packet) => sum + CHAPTER_FIVE_PACKETS[packet.key].threat,
        0,
      ),
      ...bossEncounter,
    };
  });
}
