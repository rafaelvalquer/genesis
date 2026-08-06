import {
  describe,
  expect,
  it,
} from "vitest";
import {
  CHAPTERS,
  getPhase,
  getPhaseIndex,
} from "../game/content.js";
import {
  createPhaseSelectionParams,
  resolveCampaignSelection,
  resolveChapterSelectionPhase,
} from "./campaignSelection.js";

describe("seleção global da campanha", () => {
  it("deriva o capítulo pela fase solicitada", () => {
    const phase = getPhase(
      CHAPTERS[2].phaseIds[1],
    );

    const selection = resolveCampaignSelection({
      searchParams: new URLSearchParams({
        capitulo: "1",
        fase: phase.id,
      }),
      unlockedPhaseIndex:
        getPhaseIndex(phase.id),
    });

    expect(selection.selectedPhase.id)
      .toBe(phase.id);

    expect(selection.activeChapter.id)
      .toBe(CHAPTERS[2].id);

    expect(selection.phases.length)
      .toBeGreaterThan(
        selection.activeChapter.phaseIds.length,
      );
  });

  it("atualiza capítulo e fase na mesma URL", () => {
    const phase = getPhase(
      CHAPTERS[1].phaseIds[2],
    );

    const params = createPhaseSelectionParams(
      new URLSearchParams({
        capitulo: "1",
        fase: CHAPTERS[0].phaseIds[0],
      }),
      phase,
    );

    expect(params.get("capitulo"))
      .toBe(String(CHAPTERS[1].number));

    expect(params.get("fase"))
      .toBe(phase.id);
  });

  it("recupera a última fase acessível do capítulo", () => {
    const chapter = CHAPTERS[1];
    const remembered = chapter.phaseIds[2];

    const phase = resolveChapterSelectionPhase({
      chapter,
      unlockedPhaseIndex:
        getPhaseIndex(remembered),
      rememberedPhaseId: remembered,
    });

    expect(phase.id).toBe(remembered);
  });

  it("não seleciona capítulo ainda bloqueado", () => {
    const chapter = CHAPTERS.at(-1);

    const phase = resolveChapterSelectionPhase({
      chapter,
      unlockedPhaseIndex: 0,
      rememberedPhaseId:
        chapter.phaseIds[0],
    });

    expect(phase).toBeNull();
  });
});
