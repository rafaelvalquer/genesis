import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { buildSpawnQueue } from "./domain.js";
import { CHAPTER_FOUR_PACKETS } from "./chapterFourPackets.js";
import { createChapterFourWaves, PHASE_PACKET_SEQUENCES } from "./chapterFourWaves.js";

describe("pacotes e ondas do Capítulo 4", () => {
  it("mantém as nove composições e posições táticas", () => {
    expect(Object.keys(CHAPTER_FOUR_PACKETS)).toEqual([
      "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9",
    ]);
    expect(CHAPTER_FOUR_PACKETS.P3.units[0]).toMatchObject({
      type: "gorjal", count: 1, xOffsetTiles: -0.85,
    });
    expect(CHAPTER_FOUR_PACKETS.P6.units.at(-1)).toMatchObject({
      type: "raizFulgor", count: 1, xOffsetTiles: 0.35, spawnDelayMs: 300,
    });
    expect(CHAPTER_FOUR_PACKETS.P1.units[0].spawnIntervalMs).toBe(260);
  });

  it("alivia somente a primeira onda da fase 31", () => {
    const firstWave = createChapterFourWaves(6)[0];
    const packets = firstWave.spawnBlocks.flatMap((block) => block.packets)
      .sort((left, right) => left.spawnAtMs - right.spawnAtMs);

    expect(packets.map((packet) => packet.key)).toEqual([
      "P1", "P3", "P1", "P4", "P3", "P5", "P1", "P8",
    ]);
    expect(packets).toHaveLength(8);
    expect(firstWave.spawnWindowMs).toBe(66000);
    expect(packets[0].spawnAtMs).toBe(0);
    expect(packets.at(-1).spawnAtMs).toBe(66000);
    expect(packets.some((packet) => packet.key === "P6")).toBe(false);
    expect(packets.filter((packet) => packet.key === "P8")).toHaveLength(1);
  });

  it("mantém a densificação na segunda onda da fase 31 e nas outras fases", () => {
    const secondWave = createChapterFourWaves(6)[1];
    const secondWavePackets = secondWave.spawnBlocks.flatMap((block) => block.packets);
    expect(secondWavePackets.length).toBeGreaterThan(PHASE_PACKET_SEQUENCES[6][1].length);

    const otherPhaseWave = createChapterFourWaves(7)[0];
    const otherPhasePackets = otherPhaseWave.spawnBlocks.flatMap((block) => block.packets);
    expect(otherPhasePackets.length).toBeGreaterThan(PHASE_PACKET_SEQUENCES[7][0].length);
  });

  it("escalona Voltrizes e preserva atrasos de um pacote misto", () => {
    const phase = {
      waves: [{ spawnBlocks: [{ id: "main", packets: [{
        id: "mixed_packet", spawnAtMs: 100,
        units: [
          { type: "voltriz", count: 4, spawnDelayMs: 20, spawnIntervalMs: 260 },
          { type: "nimbarca", count: 1, spawnDelayMs: 300 },
        ],
      }] }] }],
    };
    const queue = buildSpawnQueue(phase, 0, 991);
    const voltriz = queue.filter((entry) => entry.type === "voltriz");
    expect(voltriz.map((entry) => entry.spawnAtMs)).toEqual([120, 380, 640, 900]);
    expect(voltriz.every((entry) => entry.formationOffsetPx === 0)).toBe(true);
    expect(new Set(voltriz.map((entry) => entry.packetId))).toEqual(new Set(["mixed_packet"]));
    expect(queue.find((entry) => entry.type === "nimbarca")).toMatchObject({ spawnAtMs: 400, packetId: "mixed_packet" });
    expect(queue.map((entry) => entry.spawnAtMs)).toEqual([120, 380, 400, 640, 900]);
  });

  it("preserva packetId, rota comum e suporte atrás ao construir a fila", () => {
    const queue = buildSpawnQueue(PHASES[28], 2, 991);
    const byPacket = Map.groupBy(queue, (entry) => entry.packetId);
    expect(byPacket.size).toBeGreaterThan(1);
    byPacket.forEach((entries) => {
      expect(new Set(entries.map((entry) => entry.row)).size).toBe(1);
    });
    const supported = [...byPacket.values()].find((entries) => (
      entries.some((entry) => entry.type === "nimbarca")
    ));
    const nimbarca = supported.find((entry) => entry.type === "nimbarca");
    const voltriz = supported.find((entry) => entry.type === "voltriz");
    expect(nimbarca.xOffsetTiles).toBeGreaterThan(voltriz.xOffsetTiles);
  });

  it("aplica apenas os Alfas permitidos na fase 32", () => {
    const waves = createChapterFourWaves(7);
    const alphas = waves.flatMap((wave) => wave.spawnBlocks)
      .flatMap((block) => block.packets)
      .flatMap((packet) => packet.units)
      .filter((unit) => unit.variant === "alpha")
      .map((unit) => unit.type);
    expect(new Set(alphas)).toEqual(new Set(["voltriz", "nimbarca", "gorjal"]));
    expect(alphas).not.toContain("raizFulgor");
  });

  it("reduz controle e espaça a segunda onda da fase 32", () => {
    const secondWave = createChapterFourWaves(7)[1];
    const packets = secondWave.spawnBlocks.flatMap((block) => block.packets)
      .sort((left, right) => left.spawnAtMs - right.spawnAtMs);
    const firstRootPacket = packets.find((packet) => (
      packet.units.some((unit) => unit.type === "raizFulgor")
    ));

    expect(secondWave.spawnWindowMs).toBe(76000);
    expect(packets.some((packet) => packet.key === "P7")).toBe(false);
    expect(firstRootPacket.spawnAtMs).toBeGreaterThanOrEqual(30000);
  });

  it("suaviza o pico final da fase 32 sem remover seus Alfas finais", () => {
    const finalWave = createChapterFourWaves(7).at(-1);
    const packets = finalWave.spawnBlocks.flatMap((block) => block.packets);
    const alphas = packets.flatMap((packet) => packet.units)
      .filter((unit) => unit.variant === "alpha")
      .map((unit) => unit.type);

    expect(finalWave.spawnWindowMs).toBe(92000);
    expect(packets.filter((packet) => packet.key === "P6")).toHaveLength(1);
    expect(alphas).toEqual(expect.arrayContaining(["nimbarca", "gorjal"]));
  });
});
