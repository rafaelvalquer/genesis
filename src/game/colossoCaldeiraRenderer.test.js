import { describe, expect, it } from "vitest";
import { getColossoCollapseTimeline, getColossoTelegraphVisual } from "./colossoCaldeiraRenderer.js";

describe("telegraphs e interface do Colosso", () => {
  it("atribui uma linguagem visual exclusiva a cada telegraph", () => {
    expect(getColossoTelegraphVisual({ colossoState: "riftTelegraph", colossoQueuedAttack: "rift", colossoRiftTarget: { row: 1, col: 4 } })).toMatchObject({ kind: "riftRing", cells: [{ row: 1, col: 4 }] });
    expect(getColossoTelegraphVisual({ colossoState: "slamTelegraph", colossoQueuedAttack: "slam", colossoTargetCells: [{ row: 2, col: 3 }] })).toMatchObject({ kind: "slamArea" });
    expect(getColossoTelegraphVisual({ colossoState: "fractureAttack", colossoQueuedAttack: "fracture", colossoTargetCells: [{ row: 0, col: 2 }] })).toMatchObject({ kind: "fractureCracks" });
    expect(getColossoTelegraphVisual({ colossoState: "seismicTelegraph", colossoQueuedAttack: "seismic", colossoTargetRows: [0, 2, 4] })).toMatchObject({ kind: "seismicChevrons", rows: [0, 2, 4] });
  });

  it("mostra somente a rota iminente e as próximas do Colapso Final", () => {
    const enemy = { colossoState: "finalCollapse", colossoCollapseRows: [0, 4, 2], colossoCollapseIndex: 0 };
    expect(getColossoCollapseTimeline(enemy)).toEqual([
      { row: 0, order: 1, imminent: true }, { row: 4, order: 2, imminent: false }, { row: 2, order: 3, imminent: false },
    ]);
    enemy.colossoCollapseIndex = 1;
    expect(getColossoCollapseTimeline(enemy)).toEqual([
      { row: 4, order: 1, imminent: true }, { row: 2, order: 2, imminent: false },
    ]);
    enemy.colossoState = "coreExposed";
    expect(getColossoCollapseTimeline(enemy)).toEqual([]);
  });
});
