import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { disposeThreeObject } from "./disposeThreeObject.js";
import {
  calculateMeanSurfaceRadius,
  normalizeGenesisPlanet,
} from "./normalizeGenesisPlanet.js";
import {
  applyGenesisPlanetQuality,
  prepareGenesisPlanetModel,
} from "./genesisPlanetMaterials.js";

const SOURCE_CENTER = new THREE.Vector3(1.124, .366, 1.283);

function translatedGeometry(geometry, position) {
  geometry.translate(position.x, position.y, position.z);
  return geometry;
}

function mesh(name, geometry) {
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  object.name = name;
  return object;
}

function centerOf(object) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function genesisFixture() {
  const model = new THREE.Group();
  model.name = "GenesisPlanetModel";
  const world = new THREE.Group();
  world.name = "world";
  model.add(world);
  world.add(
    mesh(
      "GenesisWorld_MainPlanet",
      translatedGeometry(new THREE.SphereGeometry(1, 24, 16), SOURCE_CENTER),
    ),
    mesh("GenesisWorld_Atmosphere", new THREE.SphereGeometry(1.03, 16, 12)),
    mesh("GenesisWorld_Clouds", new THREE.SphereGeometry(1.014, 16, 12)),
    mesh(
      "GenesisWorld_IceSpikes",
      translatedGeometry(
        new THREE.BoxGeometry(.08, .2, .08),
        SOURCE_CENTER.clone().add(new THREE.Vector3(0, 1.05, 0)),
      ),
    ),
    mesh(
      "GenesisWorld_CrystalSpires",
      translatedGeometry(
        new THREE.BoxGeometry(.08, .22, .08),
        SOURCE_CENTER.clone().add(new THREE.Vector3(1.04, 0, 0)),
      ),
    ),
    mesh(
      "GenesisWorld_SwampPods",
      translatedGeometry(
        new THREE.BoxGeometry(.12, .12, .12),
        SOURCE_CENTER.clone().add(new THREE.Vector3(0, 0, 1.04)),
      ),
    ),
  );
  [
    ["GenesisMoon_Rocky", new THREE.Vector3(2.05, 0, 0)],
    ["GenesisMoon_Lava", new THREE.Vector3(-2.1, .2, 0)],
    ["GenesisMoon_Blue", new THREE.Vector3(0, 2.2, 0)],
    ["GenesisMoon_Red", new THREE.Vector3(0, -2.05, .1)],
    ["GenesisMoon_Ringed", new THREE.Vector3(0, 0, -2.15)],
    ["GenesisMoon_Ringed_Ring", new THREE.Vector3(0, 0, -2.15)],
  ].forEach(([name, position]) => {
    world.add(mesh(
      name,
      translatedGeometry(
        new THREE.SphereGeometry(name.endsWith("_Ring") ? .24 : .12, 8, 6),
        position,
      ),
    ));
  });
  [
    ["Beacon_Colony", new THREE.Vector3(1.01, 0, 0)],
    ["Beacon_Glass", new THREE.Vector3(-1.01, 0, 0)],
    ["Beacon_Chitin", new THREE.Vector3(0, 1.01, 0)],
    ["Beacon_Storm", new THREE.Vector3(0, -1.01, 0)],
  ].forEach(([name, position]) => {
    world.add(mesh(
      name,
      translatedGeometry(new THREE.BoxGeometry(.04, .08, .04), position),
    ));
  });
  model.updateMatrixWorld(true);
  return model;
}

describe("normalização espacial do planeta Genesis", () => {
  it("detecta o centro deslocado e corrige apenas superfície e estruturas", () => {
    const model = genesisFixture();
    const atmosphere = model.getObjectByName("GenesisWorld_Atmosphere");
    const clouds = model.getObjectByName("GenesisWorld_Clouds");
    const moon = model.getObjectByName("GenesisMoon_Rocky");
    const beacon = model.getObjectByName("Beacon_Colony");
    const atmosphereCenter = centerOf(atmosphere);
    const cloudCenter = centerOf(clouds);
    const moonCenter = centerOf(moon);
    const beaconCenter = centerOf(beacon);

    const layout = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });

    expect(layout.corrected).toBe(true);
    expect(layout.sourceCenter.distanceTo(SOURCE_CENTER)).toBeLessThan(.01);
    expect(layout.sourceRadius).toBeCloseTo(1, 2);
    expect(layout.surfaceRoot.name).toBe("GenesisPlanetSurfaceRoot");
    expect(model.position.length()).toBe(0);
    expect(centerOf(model.getObjectByName("GenesisWorld_MainPlanet")).length()).toBeLessThan(.01);
    ["GenesisWorld_IceSpikes", "GenesisWorld_CrystalSpires", "GenesisWorld_SwampPods"]
      .forEach((name) => expect(model.getObjectByName(name).parent).toBe(layout.surfaceRoot));
    expect(centerOf(atmosphere).distanceTo(atmosphereCenter)).toBeLessThan(.001);
    expect(centerOf(clouds).distanceTo(cloudCenter)).toBeLessThan(.001);
    expect(centerOf(moon).distanceTo(moonCenter)).toBeLessThan(.001);
    expect(centerOf(beacon).distanceTo(beaconCenter)).toBeLessThan(.001);
    expect(calculateMeanSurfaceRadius(
      THREE, model.getObjectByName("GenesisWorld_MainPlanet"), model,
    ) * model.scale.x).toBeCloseTo(1, 3);
    expect(model.scale.x).toBeCloseTo(model.scale.y, 8);
    expect(model.scale.y).toBeCloseTo(model.scale.z, 8);
    disposeThreeObject(model);
  });

  it("mantém atmosfera e luas fora da superfície após a escala visual", () => {
    const model = genesisFixture();
    const layout = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
    expect(centerOf(model.getObjectByName("GenesisWorld_Atmosphere")).length()).toBeLessThan(.001);
    expect(centerOf(model.getObjectByName("GenesisWorld_Clouds")).length()).toBeLessThan(.001);
    layout.moonRoot.children.forEach((moon) => {
      expect(centerOf(moon).length()).toBeGreaterThan(1.8);
    });
    ["Beacon_Colony", "Beacon_Glass", "Beacon_Chitin", "Beacon_Storm"].forEach((name) => {
      expect(centerOf(model.getObjectByName(name)).length()).toBeGreaterThan(.95);
    });
    disposeThreeObject(model);
  });

  it("não aplica a correção ou a escala duas vezes", () => {
    const model = genesisFixture();
    const first = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
    const scale = model.scale.clone();
    const surfacePosition = first.surfaceRoot.position.clone();
    const second = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
    expect(second.surfaceRoot).toBe(first.surfaceRoot);
    expect(model.scale).toEqual(scale);
    expect(second.surfaceRoot.position).toEqual(surfacePosition);
    expect(model.userData.genesisLayoutNormalized).toBe(true);
    expect(second.sourceCenter.distanceTo(first.sourceCenter)).toBeLessThan(.0001);
    disposeThreeObject(model);
  });

  it("agrupa a lua anelada e controla planeta e anel como uma unidade", () => {
    const model = genesisFixture();
    const layout = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
    const parts = prepareGenesisPlanetModel(THREE, model, layout);
    expect(parts.surfaceRoot).toBe(layout.surfaceRoot);
    expect(parts.moonRoot).toBe(layout.moonRoot);
    expect(parts.beaconRoot).toBe(layout.beaconRoot);
    expect(parts.moons).toHaveLength(5);
    expect(layout.ringedMoonRoot.children.map((child) => child.name)).toEqual(
      expect.arrayContaining(["GenesisMoon_Ringed", "GenesisMoon_Ringed_Ring"]),
    );
    applyGenesisPlanetQuality(parts, { quality: "low" });
    expect(layout.ringedMoonRoot.visible).toBe(true);
    expect(parts.moons.filter((moon) => moon.visible)).toHaveLength(1);
    expect(layout.ringedMoonRoot.children.every((child) => child.visible)).toBe(true);
    applyGenesisPlanetQuality(parts, { quality: "high" });
    expect(layout.ringedMoonRoot.visible).toBe(true);
    expect(parts.mainPlanet.renderOrder).toBe(0);
    expect(parts.clouds.renderOrder).toBe(2);
    expect(parts.atmosphere.renderOrder).toBe(3);
    expect(parts.clouds.material.depthWrite).toBe(false);
    expect(parts.atmosphere.material.depthWrite).toBe(false);
    disposeThreeObject(model);
  });

  it("não repara um asset já centralizado, mas ainda normaliza seu raio", () => {
    const model = genesisFixture();
    const main = model.getObjectByName("GenesisWorld_MainPlanet");
    main.geometry.translate(-SOURCE_CENTER.x, -SOURCE_CENTER.y, -SOURCE_CENTER.z);
    const layout = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
    expect(layout.corrected).toBe(false);
    expect(layout.surfaceRoot.position.length()).toBe(0);
    expect(layout.meanSurfaceRadius).toBe(1);
    disposeThreeObject(model);
  });
});
