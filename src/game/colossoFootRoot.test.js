import { describe, expect, it } from "vitest";
import { getCuratedRootPlacement } from "./colossoFootRoot.js";

describe("root curado dos pés do Colosso", () => {
  it("não desloca os pés ou o tronco quando apenas um braço amplia o bounding box", () => {
    const targetRoot = { x: 384, y: 660.48 };
    const root = { x: 200, y: 420 };
    const idle = getCuratedRootPlacement({ bounds: { minX: 80, maxX: 320, minY: 40, maxY: 420 }, sourceRoot: root, targetRoot, preferredScale: 1 });
    const extendedArm = getCuratedRootPlacement({ bounds: { minX: 80, maxX: 510, minY: 40, maxY: 420 }, sourceRoot: root, targetRoot, preferredScale: 1 });
    expect(idle.project(root)).toEqual(targetRoot);
    expect(extendedArm.project(root)).toEqual(targetRoot);
    expect(idle.project({ x: 200, y: 210 })).toEqual(extendedArm.project({ x: 200, y: 210 }));
  });
});
