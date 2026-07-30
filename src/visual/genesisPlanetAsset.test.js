import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CHAPTERS } from "../game/content.js";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { configureGenesisRenderer } from "./configureGenesisRenderer.js";
import { createGenesisPlanetLights } from "./createGenesisPlanetLights.js";
import { createRocketOrbitNodes, updateRocketOrbit } from "./createRocketOrbit.js";
import { disposeThreeObject } from "./disposeThreeObject.js";
import {
  applyGenesisPlanetChapterState,
  prepareGenesisPlanetModel,
  setGenesisPlanetOpacity,
} from "./genesisPlanetMaterials.js";
import { cloneGltfScene } from "./loadGltfModel.js";

function coloredGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0, 0, 1, 0,
  ], 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute([
    1, 0, 0, 0, 1, 0, 0, 0, 1,
  ], 3));
  return geometry;
}

function planetFixture() {
  const root = new THREE.Group();
  [
    "GenesisWorld_MainPlanet",
    "GenesisWorld_Atmosphere",
    "GenesisWorld_Clouds",
    "GenesisWorld_CrystalSpires",
    "Beacon_Colony",
    "Beacon_Glass",
    "Beacon_Chitin",
    "Beacon_Storm",
  ].forEach((name) => {
    const mesh = new THREE.Mesh(coloredGeometry(), new THREE.MeshBasicMaterial());
    mesh.name = name;
    root.add(mesh);
  });
  return root;
}

describe("asset compartilhado do planeta Genesis", () => {
  it("preserva vertex colors, calcula normals e não tinge a superfície", () => {
    const model = planetFixture();
    const parts = prepareGenesisPlanetModel(THREE, model);
    expect(parts.mainPlanet.geometry.getAttribute("color")).toBeTruthy();
    expect(parts.mainPlanet.geometry.getAttribute("normal")).toBeTruthy();
    expect(parts.mainPlanet.material.vertexColors).toBe(true);
    expect(parts.mainPlanet.material.color.getHex()).toBe(0xffffff);
    expect(parts.mainPlanet.material.emissive).toBeUndefined();
    disposeThreeObject(model);
  });

  it("troca somente o estado visual e mantém as mesmas instâncias de material", () => {
    const model = planetFixture();
    const parts = prepareGenesisPlanetModel(THREE, model);
    const mainMaterial = parts.mainPlanet.material;
    const beaconMaterials = Object.values(parts.beacons).map((mesh) => mesh.material);
    applyGenesisPlanetChapterState({
      THREE, parts, chapter: CHAPTERS[1], biome: getCampaignBiome(CHAPTERS[1].id),
    });
    expect(parts.mainPlanet.material).toBe(mainMaterial);
    expect(Object.values(parts.beacons).map((mesh) => mesh.material)).toEqual(beaconMaterials);
    expect(parts.beacons.chapter_02.material.emissiveIntensity).toBe(1.1);
    expect(parts.beacons.chapter_01.material.emissiveIntensity).toBe(.12);
    disposeThreeObject(model);
  });

  it("mantém opacidades relativas de atmosfera e nuvens no crossfade", () => {
    const model = planetFixture();
    const parts = prepareGenesisPlanetModel(THREE, model);
    setGenesisPlanetOpacity(parts, .5);
    expect(parts.atmosphere.material.opacity).toBeCloseTo(.08);
    expect(parts.clouds.material.opacity).toBeCloseTo(.21);
    disposeThreeObject(model);
  });

  it("clona texturas como propriedade da instância e não descarta a textura do cache", () => {
    const sourceTexture = new THREE.Texture();
    sourceTexture.dispose = vi.fn();
    const sourceMaterial = new THREE.MeshBasicMaterial({ map: sourceTexture });
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(coloredGeometry(), sourceMaterial));
    const clone = cloneGltfScene({ scene }, { cloneTextures: true });
    const clonedTexture = clone.children[0].material.map;
    clonedTexture.dispose = vi.fn();
    expect(clonedTexture).not.toBe(sourceTexture);
    expect(clonedTexture.userData.instanceOwned).toBe(true);
    disposeThreeObject(clone);
    expect(clonedTexture.dispose).toHaveBeenCalledOnce();
    expect(sourceTexture.dispose).not.toHaveBeenCalled();
    disposeThreeObject(scene);
  });
});

describe("renderer, iluminação e órbita compartilhados", () => {
  it("aplica a configuração visual comum", () => {
    const renderer = { setPixelRatio: vi.fn() };
    configureGenesisRenderer(THREE, renderer, { pixelRatio: 1 });
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.3);
    expect(renderer.setPixelRatio).toHaveBeenCalled();
  });

  it("cria as três luzes compartilhadas", () => {
    const scene = new THREE.Scene();
    const lights = createGenesisPlanetLights(THREE, scene, getCampaignBiome("chapter_01"));
    expect(scene.children).toEqual(expect.arrayContaining([lights.keyLight, lights.fillLight, lights.rimLight]));
    disposeThreeObject(scene);
  });

  it("separa movimento e orientação e herda a rotação do planeta", () => {
    const referenceFrame = new THREE.Group();
    const model = new THREE.Group();
    const rocket = createRocketOrbitNodes({
      THREE, parent: referenceFrame, model,
      quality: { quality: "high" }, biome: getCampaignBiome("chapter_01"),
    });
    updateRocketOrbit(THREE, rocket, 2, false);
    const localBefore = rocket.motionNode.position.clone();
    const worldBefore = rocket.motionNode.getWorldPosition(new THREE.Vector3());
    referenceFrame.rotation.y = Math.PI / 2;
    referenceFrame.updateMatrixWorld(true);
    const worldAfter = rocket.motionNode.getWorldPosition(new THREE.Vector3());
    expect(rocket.orbitRoot.parent).toBe(referenceFrame);
    expect(rocket.motionNode.children[0]).toBe(rocket.orientationNode);
    expect(rocket.motionNode.position).toEqual(localBefore);
    expect(worldAfter.distanceTo(worldBefore)).toBeGreaterThan(.5);
    disposeThreeObject(referenceFrame);
  });

  it("congela a posição orbital com redução de movimento", () => {
    const referenceFrame = new THREE.Group();
    const rocket = createRocketOrbitNodes({
      THREE, parent: referenceFrame, model: new THREE.Group(),
      quality: { quality: "low" }, biome: getCampaignBiome("chapter_01"),
    });
    updateRocketOrbit(THREE, rocket, 2, true);
    const first = rocket.motionNode.position.clone();
    updateRocketOrbit(THREE, rocket, 20, true);
    expect(rocket.motionNode.position).toEqual(first);
    disposeThreeObject(referenceFrame);
  });
});
