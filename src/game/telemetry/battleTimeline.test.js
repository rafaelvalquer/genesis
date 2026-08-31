import { describe, expect, it } from "vitest";
import { createBattleTelemetry } from "./battleTelemetry.js";
import { createBattleTimeline, recordTimelineEvent, sampleBattleTimeline } from "./battleTimeline.js";

describe("BattleTimeline", () => {
  it("amostra no intervalo e conta somente tropas ativas", () => {
    const session = { elapsed: 0, waveIndex: 0, energy: 90, energyMax: 100, supply: 20, supplyMax: 20, troops: [{ type: "marine", dead: false }, { type: "colono", dead: true }, { type: "marine", dead: false }], telemetry: createBattleTelemetry() };
    session.telemetry.timeline = createBattleTimeline();
    expect(sampleBattleTimeline(session)).toBe(true);
    session.elapsed = 500; expect(sampleBattleTimeline(session)).toBe(false);
    session.elapsed = 1000; expect(sampleBattleTimeline(session)).toBe(true);
    expect(session.telemetry.timeline.samples).toHaveLength(2);
    expect(session.telemetry.timeline.samples[0]).toMatchObject({ activeTroops: 2, activeTroopsByType: { marine: 2 } });
  });

  it("registra eventos estratégicos compactos", () => {
    const session = { elapsed: 83000, telemetry: createBattleTelemetry() }; session.telemetry.timeline = createBattleTimeline();
    recordTimelineEvent(session, "troop_deployed", { troopType: "marine", row: 3 });
    expect(session.telemetry.timeline.events).toEqual([{ timeMs: 83000, type: "troop_deployed", troopType: "marine", row: 3 }]);
  });
});
