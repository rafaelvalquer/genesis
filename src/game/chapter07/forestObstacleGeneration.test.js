import { describe, expect, it } from "vitest";
import { CHAPTER_SEVEN_PHASES } from "../chapterSevenPhases.js";
import { generateForestObstacles } from "./forestObstacleGeneration.js";

describe("forest obstacle generation", () => {
  it("keeps phase 49 empty and generates phase 50+", () => {
    expect(generateForestObstacles(CHAPTER_SEVEN_PHASES[0], 1)).toEqual([]);
    expect(generateForestObstacles(CHAPTER_SEVEN_PHASES[1], 1).length).toBeGreaterThan(0);
  });
  it("is reproducible and never uses the convoy row or duplicate cells", () => {
    const first = generateForestObstacles(CHAPTER_SEVEN_PHASES[7], 42);
    expect(first).toEqual(generateForestObstacles(CHAPTER_SEVEN_PHASES[7], 42));
    expect(first.every((tree) => tree.row !== 2)).toBe(true);
    expect(new Set(first.map((tree) => `${tree.row}:${tree.col}`)).size).toBe(first.length);
  });
  it("respects row and spore limits", () => {
    const trees = generateForestObstacles(CHAPTER_SEVEN_PHASES[7], 9);
    expect(trees.every((tree) => tree.row !== 2 && tree.col >= 3 && tree.col <= 8)).toBe(true);
    expect(trees.filter((tree) => tree.type === "spores").length).toBeLessThanOrEqual(2);
    expect(trees.every((tree) => trees.filter((other) => other.row === tree.row).length <= 2)).toBe(true);
  });
});
