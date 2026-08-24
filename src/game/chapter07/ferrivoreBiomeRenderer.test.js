import { describe, expect, it } from "vitest";
import { FERRIVORE_PHASE_PROFILES, getFerrivorePhaseProfile } from "./ferrivoreBiomeProfiles.js";
import { PHASES } from "../content.js";

describe("Fronteira Ferrívora", () => {
  it("define progressão visual determinística nas oito fases", () => {
    expect(Object.keys(FERRIVORE_PHASE_PROFILES)).toHaveLength(8);
    expect(getFerrivorePhaseProfile(PHASES.find((phase) => phase.id === "fase_49")).infestation).toBe(.2);
    expect(getFerrivorePhaseProfile(PHASES.find((phase) => phase.id === "fase_56")).colonyHeart).toBe(true);
  });
  it("preserva as linhas de escolta e transporte", () => {
    for (const phase of PHASES.filter((entry) => entry.chapterId === "chapter_07")) {
      expect(phase.battlefieldTheme.material).toBe("ferrivore");
      expect(phase.rules.combatRows).toEqual([0, 1, 3, 4]);
      expect(phase.convoy.row).toBe(2); expect(phase.convoy.escortRows).toEqual([1, 3]);
    }
  });
});
