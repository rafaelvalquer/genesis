import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { compressGenesisRelief } from "./compressGenesisRelief.js";
import { configureGenesisMoons } from "./configureGenesisMoons.js";
import {
  declutterProjectedMarkers,
  getProjectedMarkerPriority,
} from "./declutterProjectedMarkers.js";
import {
  GENESIS_PLANET_PRESENTATION,
  getGenesisPresentation,
} from "./genesisPlanetPresentation.js";
import { smoothGenesisGeometry } from "./smoothGenesisGeometry.js";

describe("apresentação cartoon compartilhada", () => {
  it("suaviza normals, atualiza volumes e preserva COLOR_0", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      1, 0, 0, 0, 1, 0, 0, 0, 1,
    ], 3));
    const colors = new THREE.Float32BufferAttribute([
      1, 0, 0, 0, 1, 0, 0, 0, 1,
    ], 3);
    geometry.setAttribute("color", colors);
    smoothGenesisGeometry(geometry);
    expect(geometry.getAttribute("normal")).toBeTruthy();
    expect(geometry.getAttribute("color")).toBe(colors);
    expect(geometry.boundingBox).toBeTruthy();
    expect(geometry.boundingSphere).toBeTruthy();
    const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("normal"), 0);
    expect(normal.length()).toBeCloseTo(1, 5);
    expect(geometry.userData.genesisSmoothed).toBe(true);
    geometry.dispose();
  });

  it("comprime somente o excesso radial e restaura a base ao trocar o fator", () => {
    const planetRoot = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      1, 0, 0,
      2, 0, 0,
      0, 1.2, .2,
    ], 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute([
      1, 1, 1, 1, 1, 1, 1, 1, 1,
    ], 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    planetRoot.add(mesh);
    compressGenesisRelief({ THREE, mesh, planetRoot, baseRadius: 1, factor: .5 });
    expect(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), 0).length()).toBeCloseTo(1);
    expect(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), 1).length()).toBeCloseTo(1.5);
    compressGenesisRelief({ THREE, mesh, planetRoot, baseRadius: 1, factor: .4 });
    expect(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), 1).length()).toBeCloseTo(1.4);
    expect(geometry.getAttribute("color")).toBeTruthy();
    planetRoot.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
  });

  it("limita luas por perfil e restaura posição e escala antes de reaplicar", () => {
    const names = [
      "GenesisMoon_RingedRoot",
      "GenesisMoon_BlueRoot",
      "GenesisMoon_LavaRoot",
      "GenesisMoon_RockyRoot",
      "GenesisMoon_RedRoot",
    ];
    const parts = {
      moons: names.map((name, index) => {
        const moon = new THREE.Group();
        moon.name = name;
        moon.position.set(index + 2, 0, 0);
        if (name === "GenesisMoon_RingedRoot") {
          moon.add(new THREE.Group(), new THREE.Group());
        }
        return moon;
      }),
    };
    configureGenesisMoons(parts, { quality: "high" }, "campaign");
    expect(parts.moons.filter((moon) => moon.visible)).toHaveLength(3);
    expect(parts.moons[0].scale.x).toBeCloseTo(.68);
    expect(parts.moons[0].position.length()).toBeCloseTo(2 * 1.12);
    configureGenesisMoons(parts, { quality: "medium" }, "campaign");
    expect(parts.moons.filter((moon) => moon.visible)).toHaveLength(2);
    expect(parts.moons[0].scale.x).toBeCloseTo(.62);
    expect(parts.moons[0].position.length()).toBeCloseTo(2 * 1.16);
    configureGenesisMoons(parts, { quality: "low" }, "campaign");
    expect(parts.moons.filter((moon) => moon.visible)).toHaveLength(1);
    expect(parts.moons[0].children.every((child) => child.visible)).toBe(true);
    configureGenesisMoons(parts, { quality: "high" }, "command");
    expect(parts.moons.filter((moon) => moon.visible)).toHaveLength(2);
    expect(parts.moons[0].scale.x).toBeCloseTo(.68);
  });

  it("centraliza fatores e opacidades por perfil", () => {
    expect(GENESIS_PLANET_PRESENTATION.high.relief.GenesisWorld_IceSpikes).toBe(.45);
    expect(GENESIS_PLANET_PRESENTATION.high.relief.GenesisWorld_CrystalSpires).toBe(.52);
    expect(GENESIS_PLANET_PRESENTATION.high.relief.GenesisWorld_SwampPods).toBe(.58);
    expect(getGenesisPresentation({ quality: "high" }, "command").moons.maxVisible).toBe(2);
    expect(getGenesisPresentation({ quality: "high" }, "campaign").moons.maxVisible).toBe(3);
  });
});

describe("decluttering de marcadores", () => {
  it("respeita prioridade e mantém atual e selecionado", () => {
    const markers = [
      { id: "locked", x: 10, y: 10, priority: 10 },
      { id: "available", x: 15, y: 12, priority: 60 },
      { id: "current", x: 17, y: 13, priority: 100, current: true },
      { id: "selected", x: 18, y: 14, priority: 90, selected: true },
      { id: "far", x: 100, y: 100, priority: 50 },
    ];
    const visible = declutterProjectedMarkers(markers, { minimumDistance: 36 });
    expect(visible).toEqual(new Set(["current", "selected", "far"]));
    expect(getProjectedMarkerPriority({ current: true })).toBe(100);
    expect(getProjectedMarkerPriority({ selected: true })).toBe(90);
    expect(getProjectedMarkerPriority({ boss: true, accessible: true })).toBe(80);
  });
});
