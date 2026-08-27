import { describe, expect, it } from "vitest";
import { CHAPTER_SEVEN_ENEMIES } from "../chapterSevenEnemies.js";
import {
  CHAPTER_SEVEN_COMBO_IDS,
  CHAPTER_SEVEN_COMBO_POOLS,
  CHAPTER_SEVEN_COMBOS,
  CHAPTER_SEVEN_OPENING_COMBOS,
  getChapterSevenComboThreat,
} from "./chapterSevenCombos.js";

describe("Chapter 7 combo catalog", () => {
  it("declares exactly 16 unique official combos", () => {
    expect(CHAPTER_SEVEN_COMBO_IDS).toHaveLength(16);
    expect(new Set(CHAPTER_SEVEN_COMBO_IDS).size).toBe(16);
    expect(CHAPTER_SEVEN_COMBO_IDS.every((id) => /^C7-\d{2}$/.test(id))).toBe(true);
  });

  it("uses existing enemies and valid unit metadata", () => {
    for (const combo of Object.values(CHAPTER_SEVEN_COMBOS)) {
      expect(combo.cooldownMs).toBeGreaterThan(0);
      expect(combo.intents.length).toBeGreaterThan(0);
      expect(combo.routeProfile).toBeTruthy();
      for (const entry of combo.units) {
        expect(CHAPTER_SEVEN_ENEMIES[entry.type]).toBeTruthy();
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.delayMs).toBeGreaterThanOrEqual(0);
        expect(entry.intervalMs).toBeGreaterThan(0);
      }
    }
  });

  it("derives threat from the enemy catalog", () => {
    const expectedThreats = [42, 42, 50, 56, 74, 90, 98, 81, 109, 86, 112, 94, 94, 72, 126, 171];
    expect(CHAPTER_SEVEN_COMBO_IDS.map((id) => getChapterSevenComboThreat(CHAPTER_SEVEN_COMBOS[id]))).toEqual(expectedThreats);
  });

  it("keeps pools and opening combos valid", () => {
    for (const [phaseId, pool] of Object.entries(CHAPTER_SEVEN_COMBO_POOLS)) {
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every((id) => CHAPTER_SEVEN_COMBOS[id])).toBe(true);
      expect(CHAPTER_SEVEN_COMBOS[CHAPTER_SEVEN_OPENING_COMBOS[phaseId]]).toBeTruthy();
    }
    expect(CHAPTER_SEVEN_COMBO_POOLS.fase_55).not.toContain("C7-16");
    expect(CHAPTER_SEVEN_COMBO_POOLS.fase_56).toContain("C7-16");
  });

  it("restricts Dardífago combos to external-compatible profiles", () => {
    const externalProfiles = new Set(["outerArtillery", "siege", "crossfire", "finalSiege"]);
    for (const combo of Object.values(CHAPTER_SEVEN_COMBOS)) {
      if (combo.units.some((entry) => entry.type === "dardifago")) {
        expect(externalProfiles.has(combo.routeProfile)).toBe(true);
        expect(CHAPTER_SEVEN_ENEMIES.dardifago.allowedRows).toEqual([0, 4]);
      }
    }
  });
});
