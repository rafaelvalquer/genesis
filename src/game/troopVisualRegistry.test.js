import { describe, expect, it } from "vitest";
import { getTroopVisualResolver, hasTroopVisualResolver } from "./troopVisualRegistry.js";
import { resolveIcaroVisual } from "./troops/interceptadorIcaro/visual.js";
import "./visualGeometry.js";

describe("troop visual registry", () => {
  it("registers the Ícaro resolver without affecting unknown troop types", () => {
    expect(hasTroopVisualResolver("interceptadorIcaro")).toBe(true);
    expect(getTroopVisualResolver("interceptadorIcaro")).toBe(resolveIcaroVisual);
    expect(getTroopVisualResolver("troopTypeNotRegistered")).toBeNull();
  });
});
