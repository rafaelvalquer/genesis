import { describe, expect, it } from "vitest";
import { ENEMIES } from "../content.js";

describe("Larva de Raiz-Ferro", () => {
  it("registra o contrato de enxame e os estados de animação", () => {
    expect(ENEMIES.larvaRaizFerro).toMatchObject({
      hp: 14, speed: 50, damage: 3, attackEveryMs: 720,
      baseDamage: 5, threat: 6, scale: .58, canAttackConvoy: false,
      countsAsConvoyThreatOnPresence: false,
      attackVisual: { durationMs: 420, impactMs: 210 },
      emergeVisual: { durationMs: 720 },
    });
    expect(ENEMIES.larvaRaizFerro.assetStates).toEqual(["idle", "walking", "attack", "emerge", "death"]);
  });

  it("ships exactly 34 runtime frames and eight brood burst frames", () => {
    const frames = import.meta.glob("../assets/enemy/larvaRaizFerro/*/frame*.png");
    const burst = import.meta.glob("../assets/effects/treeBroodBurst/frame*.png");
    expect(Object.keys(frames)).toHaveLength(34);
    expect(Object.keys(burst)).toHaveLength(8);
    expect(Object.keys(import.meta.glob("../assets/enemy/concepts/larvaRaizFerro.webp"))).toHaveLength(1);
  });

});
