import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGenesisStarField, updateGenesisStarField } from "./createGenesisStarfield.js";

describe("campo estelar Genesis", () => {
  it("uses deterministic placement and selective twinkle", () => {
    const first = createGenesisStarField(THREE, { count: 120, minRadius: 5, spread: 8, size: .02, opacity: .7, seed: 1337 });
    const second = createGenesisStarField(THREE, { count: 120, minRadius: 5, spread: 8, size: .02, opacity: .7, seed: 1337 });
    expect([...first.geometry.getAttribute("position").array]).toEqual([...second.geometry.getAttribute("position").array]);
    const twinkle = first.geometry.getAttribute("twinkle").array;
    expect([...twinkle].filter((value) => value > 0)).toHaveLength(10);
    updateGenesisStarField(first, 8);
    expect(first.material.uniforms.uTime.value).toBe(8);
  });
});
