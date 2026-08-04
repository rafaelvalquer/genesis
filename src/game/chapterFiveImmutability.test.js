import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASE_BLUEPRINTS, CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";

describe("imutabilidade profunda do Capítulo 5", () => {
  it("congela contratos, paletas, temas, maré e células internas", () => {
    const blueprint = CHAPTER_FIVE_PHASE_BLUEPRINTS[7];
    const phase = CHAPTER_FIVE_PHASES[7];
    expect(Object.isFrozen(CHAPTER_FIVE_PHASE_BLUEPRINTS)).toBe(true);
    expect(Object.isFrozen(blueprint)).toBe(true);
    expect(Object.isFrozen(blueprint.palette)).toBe(true);
    expect(Object.isFrozen(blueprint.battlefieldTheme)).toBe(true);
    expect(Object.isFrozen(blueprint.tide)).toBe(true);
    expect(Object.isFrozen(blueprint.tide.intertidalBands)).toBe(true);
    expect(Object.isFrozen(blueprint.tide.intertidalBands[0].cells)).toBe(true);
    expect(Object.isFrozen(CHAPTER_FIVE_PHASES)).toBe(true);
    expect(Object.isFrozen(phase)).toBe(true);
    expect(Object.isFrozen(phase.palette)).toBe(true);
    expect(() => { phase.palette.primary = "#000"; }).toThrow(TypeError);
  });
});
