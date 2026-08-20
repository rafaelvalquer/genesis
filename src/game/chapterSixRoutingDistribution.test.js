import { describe, expect, it } from "vitest";
import { buildSpawnQueue } from "./domain.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";

describe("distribuição estatística das rotas do Capítulo 6", () => {
  it("não favorece uma lane em 1000 seeds e mantém muitas assinaturas", () => {
    const phase = CHAPTER_SIX_PHASES.find((entry) => entry.id === "fase_48");
    const laneCounts = Array(5).fill(0);
    const signatures = new Set();
    for (let seed = 1; seed <= 1000; seed += 1) {
      const queue = buildSpawnQueue(phase, 5, seed);
      queue.forEach((entry) => { laneCounts[entry.row] += 1; });
      signatures.add(queue.map((entry) => `${entry.packetId}:${entry.row}`).join("|"));
    }
    const total = laneCounts.reduce((sum, count) => sum + count, 0);
    const shares = laneCounts.map((count) => count / total);
    expect(shares.every((share) => share >= .15 && share <= .25)).toBe(true);
    expect(Math.max(...laneCounts) / Math.min(...laneCounts)).toBeLessThan(1.35);
    expect(signatures.size).toBeGreaterThan(100);
  });
});
