import { createThemeMaterial, setMaterialEffectPulse } from "./genesisEffectUtils.js";
import {
  createRouteInstances,
  createRoutePoints,
} from "./genesisRouteEffectUtils.js";

export function createHivePlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter01_HiveEffects";

  const rockMaterial = createThemeMaterial(THREE, {
    color: "#30424a",
    emissive: "#0f766e",
    emissiveIntensity: .07,
    roughness: .94,
    metalness: 0,
  });
  const rocks = createRouteInstances({
    THREE,
    chapterId: "chapter_01",
    geometry: new THREE.DodecahedronGeometry(.045, 0),
    material: rockMaterial,
    count: Math.max(9, Math.floor(profile.structures * .86)),
    seed: 1101,
    radius: 1.018,
    minimumSideOffset: .045,
    maximumSideOffset: .12,
    scaleAt: (random) => [
      .7 + random() * 1.15,
      .42 + random() * .58,
      .65 + random() * 1.05,
    ],
  });
  rocks.name = "HiveRouteRocks";
  root.add(rocks);

  const spores = createRoutePoints({
    THREE,
    chapterId: "chapter_01",
    count: Math.max(14, Math.floor(profile.particles * .52)),
    seed: 1102,
    radius: 1.05,
    heightRange: .05,
    color: "#2dd4bf",
    size: .015,
    opacity: .42,
  });
  spores.name = "HiveRouteSpores";
  root.add(spores);

  root.userData.update = (delta, elapsed, reduceMotion) => {
    setMaterialEffectPulse(
      spores.material,
      .72 + Math.sin(elapsed * .95) * .18,
    );
    rockMaterial.emissiveIntensity = reduceMotion
      ? .06
      : .05 + (Math.sin(elapsed * 1.05) * .5 + .5) * .07;
  };
  return root;
}
