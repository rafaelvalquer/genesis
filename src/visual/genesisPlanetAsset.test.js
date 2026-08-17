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
  updateGenesisPlanetClouds,
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
    "GenesisWorld_IceSpikes",
    "GenesisWorld_CrystalSpires",
    "GenesisWorld_SwampPods",
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
    const legacyIceSpikes = model.getObjectByName("GenesisWorld_IceSpikes");
    const legacyMaterial = legacyIceSpikes.material;
    const parts = prepareGenesisPlanetModel(THREE, model);
    expect(parts.mainPlanet.geometry.getAttribute("color")).toBeTruthy();
    expect(parts.mainPlanet.geometry.getAttribute("normal")).toBeTruthy();
    expect(parts.mainPlanet.material.vertexColors).toBe(true);
    expect(parts.mainPlanet.material.color.getHex()).toBe(0xffffff);
    expect(parts.mainPlanet.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(parts.mainPlanet.material.emissive.getHex()).toBe(0x000000);
    expect(parts.mainPlanet.material.flatShading).toBe(false);
    expect(legacyIceSpikes.visible).toBe(false);
    expect(legacyIceSpikes.material).toBe(legacyMaterial);
    expect(parts.structures.some((mesh) => mesh.name.includes("IceSpikes"))).toBe(false);
    expect(parts.structures.find((mesh) => mesh.name.includes("CrystalSpires")).material.roughness).toBe(.34);
    expect(parts.structures.find((mesh) => mesh.name.includes("SwampPods")).material.roughness).toBe(.88);
    expect(parts.atmosphere.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(parts.atmosphere.material.userData.genesisAtmosphereFresnel).toBe(true);
    expect(parts.clouds.material).toBeInstanceOf(THREE.MeshBasicMaterial);
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
    expect(parts.beacons.chapter_02.material.emissiveIntensity).toBe(.85);
    expect(parts.beacons.chapter_01.material.emissiveIntensity).toBe(.08);
    expect(parts.mainPlanet.material.roughness).toBe(.58);
    expect(parts.mainPlanet.material.metalness).toBe(.1);
    disposeThreeObject(model);
  });

  it("modulates the main material for every chapter", () => {
    const model = planetFixture();
    const parts = prepareGenesisPlanetModel(THREE, model);
    const expected = {
      chapter_01: { roughness: .74, metalness: .04, emissiveIntensity: .006 },
      chapter_02: { roughness: .58, metalness: .1, emissiveIntensity: .004 },
      chapter_03: { roughness: .96, metalness: 0, emissiveIntensity: 0 },
      chapter_04: { roughness: .82, metalness: .03, emissiveIntensity: .003 },
      chapter_05: { roughness: .52, metalness: .08, emissiveIntensity: .004 },
      chapter_06: { roughness: .72, metalness: .015, emissiveIntensity: .008 },
    };
    CHAPTERS.forEach((chapter) => {
      applyGenesisPlanetChapterState({ THREE, parts, chapter, biome: getCampaignBiome(chapter.id) });
      expect(parts.mainPlanet.material).toMatchObject(expected[chapter.id]);
    });
    disposeThreeObject(model);
  });

  it("mantém opacidades relativas de atmosfera e nuvens no crossfade", () => {
    const model = planetFixture();
    const parts = prepareGenesisPlanetModel(THREE, model);
    setGenesisPlanetOpacity(parts, .5);
    expect(parts.atmosphere.material.opacity).toBeCloseTo(.06);
    expect(parts.clouds.material.opacity).toBeCloseTo(.125);
    disposeThreeObject(model);
  });

  it("faz nuvens derivarem na velocidade específica do capítulo", () => {
    const model = planetFixture();
    const texture = new THREE.Texture();
    model.getObjectByName("GenesisWorld_Clouds").material.map = texture;
    const parts = prepareGenesisPlanetModel(THREE, model);
    applyGenesisPlanetChapterState({ THREE, parts, chapter: CHAPTERS[3], biome: getCampaignBiome(CHAPTERS[3].id) });
    updateGenesisPlanetClouds(parts, 1, false, THREE);
    expect(parts.clouds.rotation.y).toBeGreaterThan(.08);
    expect(texture.offset.x).not.toBe(0);
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
    expect(renderer.toneMappingExposure).toBe(1.05);
    expect(renderer.setPixelRatio).toHaveBeenCalled();
  });

  it("cria as luzes cartoon compartilhadas", () => {
    const scene = new THREE.Scene();
    const lights = createGenesisPlanetLights(THREE, scene, getCampaignBiome("chapter_01"));
    expect(scene.children).toEqual(expect.arrayContaining([lights.keyLight, lights.fillLight, lights.rimLight]));
    expect(lights.ambientLight.intensity).toBeLessThan(.08);
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
