import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  COMMAND_GLOBE_PLANET_VERTEX_SHADER,
  createMarkerMesh,
  createStarLayers,
} from "./CommandGlobeScene.js";

describe("efeitos de profundidade do globo de Comando", () => {
  it("mantém a normal procedural no mesmo world space da direção de visão", () => {
    expect(COMMAND_GLOBE_PLANET_VERTEX_SHADER).toContain("varying vec3 vWorldNormal");
    expect(COMMAND_GLOBE_PLANET_VERTEX_SHADER).toContain("mat3(modelMatrix) * normal");
    expect(COMMAND_GLOBE_PLANET_VERTEX_SHADER).not.toContain("normalMatrix * normal");
  });

  it("cria três camadas de estrelas com paralaxe em velocidades distintas", () => {
    const layers = createStarLayers(THREE, { orbitalParticles: 32 });

    expect(layers).toHaveLength(3);
    expect(layers.map((layer) => layer.userData.parallaxSpeed)).toEqual([.003, -.006, .01]);
    expect(layers.every((layer) => layer.isPoints)).toBe(true);
  });

  it("destaca a fase atual com anel pulsante e halo de superfície", () => {
    const marker = createMarkerMesh(
      THREE,
      { id: "phase_01" },
      { current: true, accessible: true, completed: false, boss: false, locked: false, key: "current" },
      { palette: { accent: "#22d3ee" } },
    );

    expect(marker.userData.pulseRing?.isMesh).toBe(true);
    expect(marker.userData.surfaceGlow?.isMesh).toBe(true);
    expect(marker.userData.terrainHalo?.isMesh).toBe(true);
    expect(marker.userData.surfaceGlow.material.blending).toBe(THREE.AdditiveBlending);
    expect(marker.userData.terrainHalo.material.blending).toBe(THREE.AdditiveBlending);
  });
});
