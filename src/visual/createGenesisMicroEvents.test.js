import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGenesisMicroEvents } from "./createGenesisMicroEvents.js";

describe("microeventos ambientais do planeta Genesis", () => {
  it.each([
    ["chapter_01", "HiveEnergySignals"],
    ["chapter_02", "GlassAurora"],
    ["chapter_03", "ChitinDustStorm"],
    ["chapter_04", "StormLightning"],
    ["chapter_05", "OceanSurveySatellite"],
  ])("cria o evento ambiental de %s", (chapterId, name) => {
    const event = createGenesisMicroEvents({
      THREE, chapterId, profile: { particles: 72 },
    });

    expect(event.name).toBe(name);
    expect(event.userData.microEvent).toBe(true);
    expect(event.userData.update).toEqual(expect.any(Function));
  });
});
