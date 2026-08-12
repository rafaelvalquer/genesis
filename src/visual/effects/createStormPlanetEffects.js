import { createThemeMaterial, setMaterialEffectPulse } from "./genesisEffectUtils.js";
import {
  createRouteInstances,
  createRoutePoints,
  createRouteWindSegments,
} from "./genesisRouteEffectUtils.js";

export function createStormPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter04_StormEffects";

  const mountainGeometry = new THREE.ConeGeometry(.055, .18, 5);
  mountainGeometry.translate(0, .09, 0);
  const mountainMaterial = createThemeMaterial(THREE, {
    color: "#526274",
    emissive: "#172554",
    emissiveIntensity: .045,
    roughness: .92,
    metalness: .03,
  });
  const mountains = createRouteInstances({
    THREE,
    chapterId: "chapter_04",
    geometry: mountainGeometry,
    material: mountainMaterial,
    count: Math.max(9, Math.floor(profile.structures * .72)),
    seed: 4401,
    radius: 1.016,
    minimumSideOffset: .05,
    maximumSideOffset: .13,
    scaleAt: (random) => {
      const width = .68 + random() * .9;
      return [width, .75 + random() * 1.45, width];
    },
    rotationJitter: Math.PI * .55,
  });
  mountains.name = "StormRouteMountains";
  root.add(mountains);

  const windLines = createRouteWindSegments({
    THREE,
    chapterId: "chapter_04",
    count: Math.max(14, profile.lines * 5),
    seed: 4402,
    radius: 1.075,
    length: .12,
    color: "#dbeafe",
    opacity: .48,
  });
  windLines.name = "StormRouteWinds";
  root.add(windLines);

  const windMist = createRoutePoints({
    THREE,
    chapterId: "chapter_04",
    count: Math.max(18, Math.floor(profile.particles * .58)),
    seed: 4403,
    radius: 1.07,
    heightRange: .08,
    color: "#67e8f9",
    size: .016,
    opacity: .35,
  });
  windMist.name = "StormRouteMist";
  root.add(windMist);

  root.userData.update = (delta, elapsed, reduceMotion) => {
    setMaterialEffectPulse(
      windMist.material,
      .7 + Math.sin(elapsed * .86) * .18,
    );
    setMaterialEffectPulse(
      windLines.userData.windMaterial,
      .68 + Math.sin(elapsed * 1.35) * .24,
    );
    mountainMaterial.emissiveIntensity = reduceMotion
      ? .055
      : .045 + (Math.sin(elapsed * .45) * .5 + .5) * .08;
  };
  return root;
}
