import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { buildSpawnQueue } from "./domain.js";
import { CHAPTER_FOUR_PACKETS } from "./chapterFourPackets.js";
import { createChapterFourWaves } from "./chapterFourWaves.js";

describe("pacotes e ondas do Capítulo 4", () => {
  it("mantém as nove composições e posições táticas", () => {
    expect(Object.keys(CHAPTER_FOUR_PACKETS)).toEqual([
      "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9",
    ]);
    expect(CHAPTER_FOUR_PACKETS.P3.units[0]).toMatchObject({
      type: "gorjal", count: 1, xOffsetTiles: -0.85,
    });
    expect(CHAPTER_FOUR_PACKETS.P6.units.at(-1)).toMatchObject({
      type: "raizFulgor", count: 1, xOffsetTiles: 0.9, spawnDelayMs: 550,
    });
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
});
