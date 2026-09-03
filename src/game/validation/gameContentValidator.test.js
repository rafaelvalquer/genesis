import { describe, expect, it } from "vitest";
import { validateGameContent } from "./gameContentValidator.js";

function manifest(states = { idle: [0, 1, 2], attack: [0, 1, 2] }) {
  return { troops: { unit: states }, enemies: {} };
}

function validTroop(overrides = {}) {
  return {
    spriteKey: "unit",
    assetStates: ["idle", "attack"],
    canTargetAir: true,
    canTargetGround: true,
    attackEveryMs: 1000,
    attackVisual: {
      state: "attack",
      durationMs: 600,
      timeline: [
        { atMs: 0, frame: 0 },
        { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 },
      ],
      shots: [{ atMs: 200, frame: 1, muzzle: { x: .7, y: .4 } }],
      frameMuzzles: { 1: { x: .7, y: .4 } },
    },
    ...overrides,
  };
}

describe("validateGameContent", () => {
  it("aceita um contrato consistente sem mutá-lo", () => {
    const troop = validTroop();
    const before = JSON.stringify(troop);
    const result = validateGameContent({ troops: { sample: troop }, assetManifest: manifest() });

    expect(result.errors).toEqual([]);
    expect(JSON.stringify(troop)).toBe(before);
  });

  it("detecta estado direcional ausente e buraco de frame", () => {
    const troop = validTroop({ assetDirectionalStates: ["attackUp"] });
    const result = validateGameContent({
      troops: { sample: troop },
      assetManifest: manifest({ idle: [0, 1, 2], attack: [0, 2] }),
    });

    expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "ASSET_DIRECTIONAL_STATE_MISSING",
      "ASSET_FRAME_GAP",
    ]));
  });

  it("detecta shot fora da duração e frame inexistente", () => {
    const troop = validTroop({
      attackVisual: {
        state: "attack",
        durationMs: 300,
        timeline: [{ atMs: 0, frame: 0 }],
        shots: [{ atMs: 450, frame: 8, muzzle: { x: .5, y: .5 } }],
      },
    });
    const result = validateGameContent({ troops: { sample: troop }, assetManifest: manifest() });
    expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "VISUAL_SHOT_OUTSIDE_DURATION",
      "VISUAL_SHOT_FRAME_OUT_OF_RANGE",
    ]));
  });

  it("detecta timeline fora de ordem e fallback circular", () => {
    const troop = validTroop({
      assetStateFallbacks: { idle: "attack", attack: "idle" },
      attackVisual: {
        state: "attack",
        durationMs: 500,
        timeline: [{ atMs: 300, frame: 1 }, { atMs: 100, frame: 0 }],
      },
    });
    const result = validateGameContent({ troops: { sample: troop }, assetManifest: manifest() });
    expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "VISUAL_TIMELINE_UNSORTED",
      "ASSET_FALLBACK_CYCLE",
    ]));
  });

  it("mantém contradições de targeting e sobreposição como warnings", () => {
    const troop = validTroop({
      role: "Interceptador antiaéreo",
      canTargetAir: false,
      attackEveryMs: 100,
      attackVisual: {
        state: "attack",
        durationMs: 500,
        shots: [{ atMs: 200, frame: 1 }],
      },
    });
    const result = validateGameContent({ troops: { sample: troop }, assetManifest: manifest() });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "TARGETING_AIR_CONTRADICTION",
      "ATTACK_SEQUENCE_EXCEEDS_INTERVAL",
    ]));
  });
});
