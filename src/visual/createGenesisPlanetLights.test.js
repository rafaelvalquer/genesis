import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import {
  applyGenesisLightState,
  createGenesisPlanetLights,
  updateGenesisLightTransition,
} from "./createGenesisPlanetLights.js";

describe("iluminação temática do planeta", () => {
  it("cria o capítulo 3 sem banho amarelo global", () => {
    const scene = new THREE.Scene();
    const theme = getCampaignBiome("chapter_03");
    const renderer = { toneMappingExposure: 1.05 };
    const lights = createGenesisPlanetLights(
      THREE,
      scene,
      theme,
      renderer,
    );

    expect(lights.keyLight.color.getHexString()).toBe("fff4e8");
    expect(lights.fillLight.color.getHexString()).toBe("bfe7f5");
    expect(lights.rimLight.color.getHexString()).toBe("f97316");
    expect(renderer.toneMappingExposure).toBeCloseTo(.98);
    expect(lights.fillLight.intensity).toBeLessThan(theme.lighting.fillIntensity);
    expect(lights.ambientLight.intensity).toBeLessThan(theme.lighting.ambientIntensity);
    expect(lights.keyLight.intensity).toBeGreaterThan(theme.lighting.keyIntensity);
  });

  it("interpola entre temas sem troca abrupta", () => {
    const scene = new THREE.Scene();
    const renderer = { toneMappingExposure: 1.05 };
    const lights = createGenesisPlanetLights(
      THREE,
      scene,
      getCampaignBiome("chapter_01"),
      renderer,
    );

    applyGenesisLightState(
      lights,
      getCampaignBiome("chapter_04"),
      { renderer },
    );

    const before = lights.keyLight.color.clone();
    updateGenesisLightTransition(lights, .1, renderer);

    expect(lights.keyLight.color.equals(before)).toBe(false);

    for (let index = 0; index < 180; index += 1) {
      updateGenesisLightTransition(lights, 1 / 60, renderer);
    }

    expect(
      lights.keyLight.color.getHexString(),
    ).toBe("eef8ff");
    expect(renderer.toneMappingExposure).toBeCloseTo(.96, 2);
  });
});
