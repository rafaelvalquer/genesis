import { describe, expect, it } from "vitest";
import {
  enqueueSpawnEntries,
  getNextSpawnAt,
  sortSpawnQueue,
  syncSessionNextSpawnAt,
} from "./spawnQueueSystem.js";

describe("sistema de fila de spawn", () => {
  it("ordena por tempo, pacote e índice de origem", () => {
    const queue = [
      { spawnAtMs: 1000, packetId: "B", sourceIndex: 0 },
      { spawnAtMs: 500, packetId: "Z", sourceIndex: 2 },
      { spawnAtMs: 1000, packetId: "A", sourceIndex: 3 },
      { spawnAtMs: 1000, packetId: "A", sourceIndex: 1 },
    ];
    sortSpawnQueue(queue);
    expect(queue.map((entry) => `${entry.spawnAtMs}:${entry.packetId}:${entry.sourceIndex}`))
      .toEqual(["500:Z:2", "1000:A:1", "1000:A:3", "1000:B:0"]);
  });

  it("enfileira entradas e sincroniza o próximo spawn da sessão", () => {
    const session = { queue: [], waveStartedAt: 2000, nextSpawnAt: Infinity };
    enqueueSpawnEntries(session.queue, [
      { spawnAtMs: 600, packetId: "B" },
      { spawnAtMs: 100, packetId: "A" },
    ]);
    expect(getNextSpawnAt(session.queue, session.waveStartedAt)).toBe(2100);
    expect(syncSessionNextSpawnAt(session)).toBe(2100);
  });
});
