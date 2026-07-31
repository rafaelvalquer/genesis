import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  CHAPTER_LOADOUT_LIMITS,
  ENEMIES,
  PHASES,
  getChapter,
  getPhase,
} from "./content.js";

describe("Capítulo 5 — Núcleo do Eclipse", () => {
  it("expande a campanha para cinco capítulos e quarenta fases", () => {
    expect(CHAPTERS).toHaveLength(5);
    expect(PHASES).toHaveLength(40);

    const chapter = getChapter("chapter_05");
    expect(chapter).toMatchObject({
      number: 5,
      name: "Núcleo do Eclipse",
      coverArenaId: "fase_32",
    });
    expect(chapter.phaseIds).toEqual([
      "fase_33", "fase_34", "fase_35", "fase_36",
      "fase_37", "fase_38", "fase_39", "fase_40",
    ]);
  });

  it("configura as oito fases finais", () => {
    for (let number = 33; number <= 40; number += 1) {
      const phase = getPhase(
        `fase_${String(number).padStart(2, "0")}`,
      );

      expect(phase).toBeTruthy();
      expect(phase.chapterId).toBe("chapter_05");
      expect(phase.chapterIndex).toBe(number - 33);
      expect(phase.loadoutLimit).toBe(8);
      expect(phase.supplyLimit).toBe(40);
      expect(phase.waves.length).toBeGreaterThanOrEqual(6);
      expect(phase.arenaId).toBeTruthy();
    }

    expect(CHAPTER_LOADOUT_LIMITS[5]).toBe(8);
  });

  it("usa somente inimigos existentes", () => {
    const chapter = getChapter("chapter_05");

    chapter.phaseIds.forEach((phaseId) => {
      getPhase(phaseId).waves
        .flatMap((wave) => wave.enemies)
        .forEach((enemy) => {
          expect(
            ENEMIES[enemy.type],
            `${phaseId}: ${enemy.type}`,
          ).toBeTruthy();
        });
    });
  });

  it("marca a fase final como batalha de chefe", () => {
    expect(getPhase("fase_40")).toMatchObject({
      boss: true,
      name: "Trono do Eclipse",
    });
  });
});
