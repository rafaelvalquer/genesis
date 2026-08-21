import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { createBattleSession } from "./battleModel.js";

describe("isolamento do ciclo térmico", () => {
  it("cria o ciclo somente para fases do Capítulo 6", () => {
    const chapterSixPhase = PHASES.find((phase) => phase.chapterId === "chapter_06");
    const chapterSevenPhase = PHASES.find((phase) => phase.chapterId === "chapter_07");
    const chapterOnePhase = PHASES.find((phase) => phase.chapterId === "chapter_01");

    expect(createBattleSession(chapterSixPhase, ["colono"]).thermalCycle).not.toBeNull();
    expect(createBattleSession(chapterSevenPhase, ["colono"]).thermalCycle).toBeNull();
    expect(createBattleSession(chapterOnePhase, ["colono"]).thermalCycle).toBeNull();
  });
});
