import { describe, expect, it, vi } from "vitest";
import {
  BOSS_ENCOUNTER_PACKET_ID,
  createBossEncounterState,
  enqueueBossReinforcement,
  initializeBossEncounterForWave,
  markBossEncounterSpawned,
  shouldDeferBossAwareSpawn,
  updateBossEncounter,
} from "./bossEncounterSystem.js";

describe("sistema genérico de encontro com chefe", () => {
  it("agenda e marca a entrada do chefe no tempo configurado", () => {
    const session = { queue: [], bossEncounter: null };
    const wave = { bossEncounter: { type: "boss", spawnAtMs: 18000 } };
    initializeBossEncounterForWave(session, wave, session.queue, { row: 2 });
    expect(session.queue).toContainEqual(expect.objectContaining({
      type: "boss", row: 2, packetId: BOSS_ENCOUNTER_PACKET_ID,
      spawnAtMs: 18000,
    }));
    expect(markBossEncounterSpawned(session, session.queue[0])).toBe(true);
    expect(session.bossEncounter.spawned).toBe(true);
  });

  it("reserva uma vaga até a entrada do chefe", () => {
    const session = {
      elapsed: 17000,
      waveStartedAt: 0,
      bossEncounter: {
        ...createBossEncounterState({
          bossEncounter: { type: "boss", spawnAtMs: 18000 },
        }),
      },
    };
    expect(shouldDeferBossAwareSpawn(
      session, { packetId: "normal" }, 48, 47,
    )).toBe(true);
    expect(shouldDeferBossAwareSpawn(
      session, { packetId: BOSS_ENCOUNTER_PACKET_ID }, 48, 48,
    )).toBe(false);
  });

  it("aciona cada limiar uma única vez", () => {
    const enqueueReinforcement = vi.fn((packet) => {
      session.bossEncounter.reinforcementPackets.add(packet);
    });
    const session = {
      bossEncounter: {
        type: "boss",
        spawned: true,
        reinforcements: [
          { hpFactor: 0.85, packet: "A" },
          { hpFactor: 0.70, packet: "B" },
          { hpFactor: 0.55, packet: "C" },
        ],
        reinforcementPackets: new Set(),
      },
      enemies: [{ type: "boss", hp: 60, maxHp: 100, dead: false }],
    };
    expect(updateBossEncounter(session, { enqueueReinforcement }))
      .toEqual(["A", "B"]);
    expect(updateBossEncounter(session, { enqueueReinforcement })).toEqual([]);
    expect(enqueueReinforcement).toHaveBeenCalledTimes(2);
  });

  it("respeita o limite vivo por tipo nos reforços", () => {
    const session = {
      bossEncounter: {
        maximumLivingByType: { mordelume: 16 },
        reinforcementPackets: new Set(),
      },
      enemies: Array.from({ length: 15 }, (_, index) => ({
        id: `m_${index}`, type: "mordelume", dead: false,
      })),
      queue: [],
      rng: () => 0.4,
      elapsed: 20000,
      waveStartedAt: 0,
      nextSpawnAt: Infinity,
    };
    const packets = {
      N: {
        id: "N",
        units: [{ type: "mordelume", count: 8, spawnIntervalMs: 100 }],
      },
    };
    const first = enqueueBossReinforcement(
      session, "N", { packets, fieldRows: 5 },
    );
    const second = enqueueBossReinforcement(
      session, "N", { packets, fieldRows: 5 },
    );
    expect(first).toHaveLength(1);
    expect(first[0].type).toBe("mordelume");
    expect(second).toEqual([]);
  });
});
