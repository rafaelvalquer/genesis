import { describe, expect, it } from "vitest";
import {
  CELL,
  FIELD,
  createBattleSession,
  createWindCurrentState,
  getSnapshot,
} from "./battleModel.js";

describe("battleModel import smoke test", () => {
  it("carrega todas as dependências locais e cria uma sessão", () => {
    expect(FIELD.rows).toBe(5);
    expect(CELL.width).toBeGreaterThan(0);
    expect(createWindCurrentState).toBeTypeOf("function");

    const phase = {
      id: "hotfix_smoke",
      energy: 20,
      baseIntegrity: 100,
      supplyLimit: 20,
      waves: [{ enemies: [] }],
      targetDurationMs: 60000,
      loadoutLimit: 8,
      environmentHazard: null,
    };
    const session = createBattleSession(phase, ["colono"], 101);
    const snapshot = getSnapshot(session);

    expect(snapshot.integrity).toBe(100);
    expect(snapshot.supply).toBe(20);
    expect(session.windCurrent).toBeDefined();
    expect(session.tideCycle).toBeDefined();
  });
});
