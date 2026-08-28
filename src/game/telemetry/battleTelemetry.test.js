import { describe, expect, it } from "vitest";
import { createBattleTelemetry, grantEnergy, recordDamageTaken, recordRoutePressure, recordTroopDamage, spendEnergy } from "./battleTelemetry.js";

describe("BattleTelemetry", () => {
  it("registra dano efetivo sem inflar o overkill", () => {
    const telemetry = createBattleTelemetry();
    recordTroopDamage(telemetry, "marine", 7);
    expect(telemetry.combat.totalDamageDealt).toBe(7);
    expect(telemetry.troops.marine.damageDealt).toBe(7);
  });

  it("separa energia gerada, desperdiçada, gasta e reembolsada", () => {
    const session = { energy: 98, energyMax: 100, telemetry: createBattleTelemetry() };
    expect(grantEnergy(session, 5, { kind: "reactor", troopType: "reator" })).toMatchObject({ gained: 2, wasted: 3 });
    expect(spendEnergy(session, 30)).toBe(30);
    expect(session.telemetry.energy).toMatchObject({ generated: 2, wasted: 3, spent: 30, fromReactors: 2 });
  });

  it("acumula dano recebido, mitigação e pressão por rota", () => {
    const telemetry = createBattleTelemetry();
    recordDamageTaken(telemetry, "colono", 60, 20);
    recordRoutePressure(telemetry, [{ row: 3, pressure: 80, activeCount: 4, state: "critical" }], 500);
    expect(telemetry.troops.colono).toMatchObject({ damageTaken: 60, damagePrevented: 20 });
    expect(telemetry.routes[3]).toMatchObject({ pressureSum: 80, peakPressure: 80, criticalMs: 500, maxEnemies: 4 });
  });
});
