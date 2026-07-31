import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CHAPTERS, getPhase } from "../game/content.js";
import { createChapterPhaseVectors } from "./campaignPlanetCoordinates.js";
import { createChapterRoutes } from "./campaignPlanetRoutes.js";
import { getCampaignPhaseState } from "./campaignPhaseState.js";
import { disposeThreeObject } from "./disposeThreeObject.js";
import { normalizeModelToRadius } from "./normalizeGltfModel.js";

const chapter = CHAPTERS[0];
const phases = chapter.phaseIds.map(getPhase);
const campaign = {
  currentPhaseId: "fase_03",
  unlockedPhaseIndex: 3,
  phaseStats: {
    fase_01: { victories: 1, bestStars: 3 },
    fase_02: { victories: 1, bestStars: 2 },
  },
};

describe("visual compartilhado da campanha", () => {
  it("deriva os estados concluído, atual, disponível e bloqueado", () => {
    expect(getCampaignPhaseState(phases[0], campaign)).toMatchObject({ completed: true, key: "completed", stars: 3 });
    expect(getCampaignPhaseState(phases[2], campaign)).toMatchObject({ current: true, key: "current" });
    expect(getCampaignPhaseState(phases[3], campaign)).toMatchObject({ accessible: true, key: "available" });
    expect(getCampaignPhaseState(phases[4], campaign)).toMatchObject({ locked: true, key: "locked" });
  });

  it("cria oito coordenadas e sete segmentos com estado real", () => {
    const vectors = createChapterPhaseVectors(THREE, chapter);
    const routes = createChapterRoutes(THREE, chapter, phases, campaign, vectors);
    expect(vectors).toHaveLength(8);
    expect(routes.userData.segments).toHaveLength(7);
    expect(routes.userData.segments.map((line) => line.userData.state)).toEqual([
      "completed", "current", "available", "locked", "locked", "locked", "locked",
    ]);
    disposeThreeObject(routes);
  });

  it("normaliza a esfera nomeada para o raio solicitado e centraliza o modelo", () => {
    const model = new THREE.Group();
    const reference = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshBasicMaterial());
    reference.name = "GenesisWorld_MainPlanet";
    reference.position.set(4, -2, 1);
    model.add(reference);
    normalizeModelToRadius(THREE, model, 1, reference.name);
    const sphere = new THREE.Box3().setFromObject(reference).getBoundingSphere(new THREE.Sphere());
    expect(sphere.radius).toBeCloseTo(1, 2);
    expect(sphere.center.length()).toBeLessThan(.001);
    disposeThreeObject(model);
  });

  it("descarta geometria, material e textura", () => {
    const texture = new THREE.Texture();
    texture.userData.instanceOwned = true;
    texture.dispose = vi.fn();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    material.dispose = vi.fn();
    const geometry = new THREE.BoxGeometry();
    geometry.dispose = vi.fn();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material));
    disposeThreeObject(root);
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(texture.dispose).toHaveBeenCalledOnce();
  });
});
