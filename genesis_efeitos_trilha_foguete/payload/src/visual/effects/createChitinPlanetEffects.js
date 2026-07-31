import { createThemeMaterial, setMaterialEffectPulse } from "./genesisEffectUtils.js";
import {
  createRouteInstances,
  createRoutePoints,
  createRouteWindSegments,
} from "./genesisRouteEffectUtils.js";

export function createChitinPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter03_ChitinEffects";

  const duneGeometry = new THREE.SphereGeometry(
    .078, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2,
  );
  const duneMaterial = createThemeMaterial(THREE, {
    color: "#b66b25",
    emissive: "#4a1d08",
    emissiveIntensity: .025,
    roughness: .98,
    metalness: 0,
  });
  const dunes = createRouteInstances({
    THREE,
    chapterId: "chapter_03",
    geometry: duneGeometry,
    material: duneMaterial,
    count: Math.max(10, Math.floor(profile.structures * .64)),
    seed: 3301,
    radius: 1.014,
    minimumSideOffset: .045,
    maximumSideOffset: .13,
    scaleAt: (random) => [
      .8 + random() * 1.35,
      .22 + random() * .28,
      .9 + random() * 1.55,
    ],
    rotationJitter: Math.PI * .3,
  });
  dunes.name = "ChitinRouteDunes";
  root.add(dunes);

  const dust = createRoutePoints({
    THREE,
    chapterId: "chapter_03",
    count: Math.max(18, Math.floor(profile.particles * .64)),
    seed: 3302,
    radius: 1.045,
    heightRange: .045,
    color: "#d9912b",
    size: .012,
    opacity: .34,
    additive: false,
  });
  dust.name = "ChitinRouteDust";
  root.add(dust);

  const sandStreaks = createRouteWindSegments({
    THREE,
    chapterId: "chapter_03",
    count: Math.max(6, profile.lines * 3),
    seed: 3303,
    radius: 1.052,
    length: .075,
    color: "#f6ad55",
    opacity: .22,
  });
  sandStreaks.name = "ChitinSandStreaks";
  root.add(sandStreaks);

  root.userData.update = (delta, elapsed, reduceMotion) => {
    setMaterialEffectPulse(
      dust.material,
      .76 + Math.sin(elapsed * .72) * .14,
    );
    setMaterialEffectPulse(
      sandStreaks.userData.windMaterial,
      .72 + Math.sin(elapsed * 1.05) * .16,
    );
  };
  return root;
}
