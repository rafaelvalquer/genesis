import {
  describe,
  expect,
  it,
} from "vitest";
import {
  CAMPAIGN_CHAPTER_VISUAL_PROFILES,
  getCampaignRouteMaterials,
  setCampaignActiveChapter,
} from "./campaignChapterVisuals.js";

function materialStub(chapterId) {
  return {
    opacity: 0,
    color: {
      copy() {
        return this;
      },
    },
    userData: {
      campaignChapterId: chapterId,
      campaignRouteReached: true,
      campaignBaseColor: {
        clone() {
          return this;
        },
      },
      campaignDarkColor: {},
      campaignTargetColor: {
        copy() {
          return this;
        },
        lerp() {
          return this;
        },
      },
    },
  };
}

function groupStub(material) {
  return {
    userData: {},
    traverse(callback) {
      callback({ material });
    },
  };
}

describe("visuais persistentes dos capítulos", () => {
  it("mantém perfil inativo acima de zero", () => {
    expect(
      CAMPAIGN_CHAPTER_VISUAL_PROFILES
        .inactive
        .effectOpacity,
    ).toBeGreaterThan(0);

    expect(
      CAMPAIGN_CHAPTER_VISUAL_PROFILES
        .inactive
        .reachedOpacity,
    ).toBeGreaterThan(0);
  });

  it("diferencia capítulo ativo, inativo e bloqueado", () => {
    const activeMaterial = materialStub(
      "chapter_01",
    );

    const inactiveMaterial = materialStub(
      "chapter_02",
    );

    const lockedMaterial = materialStub(
      "chapter_03",
    );

    const setChapter = (
      globalThis.vi?.fn?.()
      || (() => {})
    );

    const runtime = {
      campaignChapters: [
        {
          id: "chapter_01",
          phaseIds: ["fase_01"],
        },
        {
          id: "chapter_02",
          phaseIds: ["fase_09"],
        },
        {
          id: "chapter_03",
          phaseIds: ["fase_17"],
        },
      ],
      chapterRouteGroups: new Map([
        [
          "chapter_01",
          groupStub(activeMaterial),
        ],
        [
          "chapter_02",
          groupStub(inactiveMaterial),
        ],
        [
          "chapter_03",
          groupStub(lockedMaterial),
        ],
      ]),
      chapterEffects: {
        setChapter,
      },
    };

    setCampaignActiveChapter(
      runtime,
      "chapter_01",
      10,
      { immediate: true },
    );

    expect(activeMaterial.opacity)
      .toBe(
        CAMPAIGN_CHAPTER_VISUAL_PROFILES
          .active
          .reachedOpacity,
      );

    expect(inactiveMaterial.opacity)
      .toBe(
        CAMPAIGN_CHAPTER_VISUAL_PROFILES
          .inactive
          .reachedOpacity,
      );

    expect(lockedMaterial.opacity)
      .toBe(
        CAMPAIGN_CHAPTER_VISUAL_PROFILES
          .locked
          .reachedOpacity,
      );
  });

  it("expõe os materiais para a transição de rota", () => {
    const first = {};
    const second = {};

    expect(getCampaignRouteMaterials({
      campaignRouteMaterials: [
        first,
        second,
      ],
    })).toEqual([
      first,
      second,
    ]);
  });
});
