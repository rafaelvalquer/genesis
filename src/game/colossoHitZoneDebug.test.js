import { describe, expect, it } from "vitest";
import { getColossoHitZoneLabels, getColossoHitZoneOverlayEntries } from "./colossoHitZoneDebug.js";
import { isColossoAnchorDebugEnabled } from "./colossoCaldeiraRenderer.js";

describe("debug de hit zones do Colosso", () => {
  it("mantém a ordem e a associação visual das cinco rotas", () => {
    expect(getColossoHitZoneLabels()).toEqual([
      { row: 0, part: "LEFT ARM", label: "ROW 0 · LEFT ARM" },
      { row: 1, part: "HEAD", label: "ROW 1 · HEAD" },
      { row: 2, part: "CORE", label: "ROW 2 · CORE" },
      { row: 3, part: "CORE", label: "ROW 3 · CORE" },
      { row: 4, part: "RIGHT ARM", label: "ROW 4 · RIGHT ARM" },
    ]);
  });

  it("ativa o overlay de batalha apenas no debug de âncora", () => {
    expect(isColossoAnchorDebugEnabled("?debugColossoAnchor", true)).toBe(true);
    expect(isColossoAnchorDebugEnabled("?debugColossoAnchor=0", true)).toBe(true);
    expect(isColossoAnchorDebugEnabled("?debugOther", true)).toBe(false);
    expect(isColossoAnchorDebugEnabled("?debugColossoAnchor", false)).toBe(false);
  });

  it("reposiciona as labels a cada âncora e escala de frame", () => {
    const firstFrame = getColossoHitZoneOverlayEntries(480, 120);
    const nextFrame = getColossoHitZoneOverlayEntries(520, 90);
    expect(firstFrame.map(({ y }) => y)).toEqual([240, 360, 480, 600, 720]);
    expect(nextFrame.map(({ y }) => y)).toEqual([340, 430, 520, 610, 700]);
  });
});
