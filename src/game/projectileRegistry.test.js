import { describe, expect, it } from "vitest";
import { getProjectileHandler, hasProjectileHandler, registerProjectileHandler } from "./projectileRegistry.js";

describe("projectile registry", () => {
  it("dispatches a registered kind to exactly the registered handler", () => {
    const handler = () => "handled";
    registerProjectileHandler("testProjectileRegistry", handler);
    expect(hasProjectileHandler("testProjectileRegistry")).toBe(true);
    expect(getProjectileHandler("testProjectileRegistry")).toBe(handler);
    expect(getProjectileHandler("unregisteredProjectileRegistry")).toBeNull();
  });
});
