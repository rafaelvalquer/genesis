import { describe, expect, it } from "vitest";
import { createBattleTelemetry, recordRoutePressure, recordThreatDamage, recordTroopDamage } from "./battleTelemetry.js";
import { buildTacticalReport } from "./tacticalReport.js";

describe("TacticalReport", () => {
  it("seleciona a rota com maior pressão integrada e produz insight aéreo disponível", () => {
    const telemetry = createBattleTelemetry();
    recordTroopDamage(telemetry, "marine", 70);
    recordThreatDamage(telemetry, 45, { enemyType: "voltriz", airborne: true });
    recordThreatDamage(telemetry, 55, { enemyType: "rastejanteMata", airborne: false });
    recordRoutePressure(telemetry, [{ row: 3, pressure: 80, activeCount: 3, state: "critical" }], 500);
    const report = buildTacticalReport({ telemetry }, { integrity: 80, durationMs: 1000, targetDurationMs: 2000, availableTroops: ["interceptadorIcaro"], loadout: [] });
    expect(report.summary.mostPressuredRoute).toBe(3);
    expect(report.insights[0]).toMatchObject({ id: "high-air-threat", recommendedTroopId: "interceptadorIcaro" });
  });

  it("não recomenda Ícaro se ele não está disponível", () => {
    const telemetry = createBattleTelemetry();
    recordThreatDamage(telemetry, 50, { enemyType: "voltriz", airborne: true });
    recordThreatDamage(telemetry, 50, { enemyType: "rastejanteMata" });
    const report = buildTacticalReport({ telemetry }, { integrity: 100, availableTroops: [], loadout: [] });
    expect(report.insights.find((insight) => insight.id === "high-air-threat")).not.toHaveProperty("recommendedTroopId");
  });
});
