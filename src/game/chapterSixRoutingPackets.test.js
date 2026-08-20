import { describe, expect, it } from "vitest";
import { buildSpawnQueue } from "./domain.js";
import { CHAPTER_SIX_PACKETS, instantiateChapterSixPacket } from "./chapterSixWaves.js";

function createPacketTestWave(packetKey, routeStrategy) {
  const packet = instantiateChapterSixPacket(packetKey, 0, 0, "main", [2], {
    dynamicRoutes: true,
    routeStrategy,
  });
  return { waves: [{ spawnBlocks: [{ id: "test", packets: [packet] }] }] };
}

const countByType = (entries) => entries.reduce((counts, entry) => {
  counts[entry.type] = (counts[entry.type] || 0) + 1;
  return counts;
}, {});

describe("pacotes reais do Capítulo 6", () => {
  it.each([
    ["C6-12", "focused", 1], ["C6-01", "split", 2], ["C6-10", "spread", 3],
    ["C6-07", "spread", 3], ["C6-11", "split", 2],
  ])("preserva quantidade, composição e rotas de %s (%s)", (packetKey, strategy, expectedRows) => {
    const queue = buildSpawnQueue(createPacketTestWave(packetKey, strategy), 0, 101);
    const source = CHAPTER_SIX_PACKETS[packetKey];
    expect(queue).toHaveLength(source.units.reduce((sum, unit) => sum + unit.count, 0));
    expect(countByType(queue)).toEqual(countByType(source.units.flatMap((unit) => Array.from({ length: unit.count }, () => ({ type: unit.type })))));
    expect(new Set(queue.map((entry) => entry.row)).size).toBe(expectedRows);
    expect(new Set(queue.map((entry) => entry.sourceIndex)).size).toBe(queue.length);
  });

  it("mantém determinismo por seed e permite mudar a assinatura de rotas", () => {
    const wave = createPacketTestWave("C6-10", "spread");
    const first = buildSpawnQueue(wave, 0, 101);
    const repeat = buildSpawnQueue(wave, 0, 101);
    const other = buildSpawnQueue(wave, 0, 102);
    expect(first).toEqual(repeat);
    expect(other.map((entry) => entry.row)).not.toEqual(first.map((entry) => entry.row));
  });
});
