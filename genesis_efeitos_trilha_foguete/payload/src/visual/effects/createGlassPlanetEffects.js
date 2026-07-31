import { createThemeMaterial, setMaterialEffectPulse } from "./genesisEffectUtils.js";
import {
  createRouteInstances,
  createRoutePoints,
} from "./genesisRouteEffectUtils.js";

export function createGlassPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter02_GlassEffects";

  const geometry = new THREE.ConeGeometry(.027, .14, 4);
  geometry.translate(0, .07, 0);
  const crystalMaterial = createThemeMaterial(THREE, {
    color: "#a78bfa",
    emissive: "#7fffd4",
    emissiveIntensity: .2,
    roughness: .28,
    metalness: .1,
  });
  const crystals = createRouteInstances({
    THREE,
    chapterId: "chapter_02",
    geometry,
    material: crystalMaterial,
    count: Math.max(10, profile.structures),
    seed: 2201,
    radius: 1.018,
    minimumSideOffset: .038,
    maximumSideOffset: .11,
    scaleAt: (random) => {
      const width = .55 + random() * .9;
      return [width, .75 + random() * 1.65, width];
    },
    rotationJitter: Math.PI * .45,
  });
  crystals.name = "GlassRouteCrystals";
  root.add(crystals);

  const glints = createRoutePoints({
    THREE,
    chapterId: "chapter_02",
    count: Math.max(18, Math.floor(profile.particles * .6)),
    seed: 2202,
    radius: 1.055,
    heightRange: .07,
    color: "#c4b5fd",
    size: .017,
    opacity: .48,
  });
  glints.name = "GlassRouteGlints";
  root.add(glints);

  root.userData.update = (delta, elapsed, reduceMotion) => {
    setMaterialEffectPulse(
      glints.material,
      .72 + Math.sin(elapsed * 1.12) * .2,
    );
    crystalMaterial.emissiveIntensity = reduceMotion
      ? .17
      : .15 + (Math.sin(elapsed * .88) * .5 + .5) * .18;
  };
  return root;
}
