import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIX_ALPHA_MODIFIERS, calculateAlphaChance, countPressureTroops,
  createAlphaPressureState, evaluateAlphaPressure, getAlphaEligibleEnemyTypes,
  hasActiveAlpha, resetAlphaPressureForWave,
} from "./chapterSixAlphaPressure.js";

const config = { enabled: true, minTroops: 5, firstCheckDelayMs: 18000, checkEveryMs: 12000, warningMs: 1800, baseChance: .10, chancePerExtraTroop: .035, maxChance: .4 };
const catalog = {
  cuspidorBrasa: { allowAlphaVariant: true }, predadorCaldeira: { allowAlphaVariant: true },
  colossoCaldeira: { boss: true, allowAlphaVariant: false },
};
const makeSession = (rng = () => .99) => ({ elapsed: 0, waveActive: true, waveIndex: 0, rng, troops: Array.from({ length: 5 }, (_, index) => ({ id: `troop_${index}`, type: "marine", dead: false })), queue: [{ type: "cuspidorBrasa" }], enemies: [], phase: { waves: [{ enemies: [{ type: "cuspidorBrasa", count: 1 }] }] }, alphaPressure: createAlphaPressureState(config) });

describe("Chapter Six alpha pressure", () => {
  it("reinicia o relógio em 18s e agenda tentativas a cada 12s", () => {
    const session = makeSession();
    resetAlphaPressureForWave(session, config);
    expect(session.alphaPressure.nextCheckAt).toBe(18000);
    expect(evaluateAlphaPressure(session, config, catalog)).toBeNull();
    session.elapsed = 18000;
    expect(evaluateAlphaPressure(session, config, catalog)).toMatchObject({ checked: true, triggered: false, nextCheckAt: 30000 });
  });

  it("exige cinco tropas e calcula chance crescente com teto", () => {
    expect(calculateAlphaChance(4, config)).toBe(0);
    expect(calculateAlphaChance(5, config)).toBe(.1);
    expect(calculateAlphaChance(14, config)).toBe(.4);
    expect(countPressureTroops({ troops: [{ type: "marine", dead: false }, { type: "thermalPlatform", dead: false }] })).toBe(1);
  });

  it("gera apenas um Alpha por sucesso, com tipo e rota reproduzíveis", () => {
    const first = makeSession(() => 0);
    const second = makeSession(() => 0);
    resetAlphaPressureForWave(first, config); resetAlphaPressureForWave(second, config);
    first.elapsed = second.elapsed = 18000;
    const left = evaluateAlphaPressure(first, config, catalog);
    const right = evaluateAlphaPressure(second, config, catalog);
    expect(left).toEqual(right);
    expect(left).toMatchObject({ triggered: true, type: "cuspidorBrasa", row: expect.any(Number) });
    expect(left.row).toBeGreaterThanOrEqual(0); expect(left.row).toBeLessThan(5);
    expect(first.alphaPressure.spawnsThisWave).toBe(0); // sobe quando o warning conclui e a entidade nasce
  });

  it("não dispara segundo Alpha enquanto o anterior está vivo", () => {
    const session = makeSession(() => 0); resetAlphaPressureForWave(session, config); session.elapsed = 18000;
    const first = evaluateAlphaPressure(session, config, catalog); expect(first.triggered).toBe(true);
    session.alphaPressure.pendingSpawns = [{ variant: "alpha" }]; session.elapsed = 30000;
    expect(evaluateAlphaPressure(session, config, catalog)).toMatchObject({ checked: true, triggered: false });
    expect(hasActiveAlpha(session)).toBe(true);
  });

  it("prefere inimigos da wave e exclui chefes do fallback", () => {
    const session = makeSession();
    expect(getAlphaEligibleEnemyTypes(session, config, catalog)).toEqual(["cuspidorBrasa"]);
    expect(getAlphaEligibleEnemyTypes({ ...session, queue: [], phase: { waves: [{ enemies: [{ type: "colossoCaldeira", count: 1 }] }] } }, { ...config, enemyPool: ["colossoCaldeira", "predadorCaldeira"] }, catalog)).toEqual(["predadorCaldeira"]);
    expect(CHAPTER_SIX_ALPHA_MODIFIERS).toMatchObject({ hpMultiplier: 1.65, damageMultiplier: 1.25, speedMultiplier: 1.1, scaleMultiplier: 1.12 });
  });
});
