import { setMaterialEffectPulse } from "./genesisEffectUtils.js";
import {
  createRoutePoints,
  createRouteRibbon,
  getChapterPhaseFrames,
} from "./genesisRouteEffectUtils.js";

function createRipples(THREE) {
  const root = new THREE.Group();
  root.name = "OceanRouteRipples";
  const frames = getChapterPhaseFrames(THREE, "chapter_05");

  frames.forEach((frame, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 ? "#67e8f9" : "#38bdf8",
      transparent: true,
      opacity: .34,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.027, .04, 28),
      material,
    );
    const offset = index % 2 === 0 ? -.055 : .055;
    const normal = frame.normal.clone()
      .addScaledVector(frame.lateral, offset)
      .normalize();
    ring.position.copy(normal).multiplyScalar(1.042);
    ring.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );
    ring.userData.phase = index * .83;
    ring.userData.baseOpacity = material.opacity;
    root.add(ring);
  });
  return root;
}

export function createOceanPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter05_OceanEffects";

  const currentMaterial = new THREE.MeshBasicMaterial({
    color: "#0284c7",
    transparent: true,
    opacity: .22,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const current = createRouteRibbon({
    THREE,
    chapterId: "chapter_05",
    radius: 1.025,
    width: .09,
    material: currentMaterial,
  });
  current.name = "OceanRouteCurrent";
  root.add(current);

  const foamMaterial = new THREE.MeshBasicMaterial({
    color: "#bae6fd",
    transparent: true,
    opacity: .36,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const foamRibbon = createRouteRibbon({
    THREE,
    chapterId: "chapter_05",
    radius: 1.037,
    width: .022,
    sideOffset: .018,
    material: foamMaterial,
  });
  foamRibbon.name = "OceanRouteFoamRibbon";
  root.add(foamRibbon);

  const foam = createRoutePoints({
    THREE,
    chapterId: "chapter_05",
    count: Math.max(22, Math.floor(profile.particles * .7)),
    seed: 5501,
    radius: 1.047,
    heightRange: .035,
    minimumSideOffset: .018,
    maximumSideOffset: .095,
    color: "#e0f2fe",
    size: .014,
    opacity: .48,
  });
  foam.name = "OceanRouteFoam";
  root.add(foam);

  const ripples = createRipples(THREE);
  root.add(ripples);

  root.userData.update = (delta, elapsed, reduceMotion) => {
    setMaterialEffectPulse(
      foam.material,
      .72 + Math.sin(elapsed * .9) * .18,
    );
    setMaterialEffectPulse(
      currentMaterial,
      .76 + Math.sin(elapsed * .72) * .14,
    );
    setMaterialEffectPulse(
      foamMaterial,
      .72 + Math.sin(elapsed * 1.04 + 1.1) * .2,
    );
    ripples.children.forEach((ring) => {
      const wave = reduceMotion
        ? .2
        : (Math.sin(elapsed * 1.25 + ring.userData.phase) * .5 + .5);
      const scale = .82 + wave * .52;
      ring.scale.setScalar(scale);
      setMaterialEffectPulse(
        ring.material,
        .55 + wave * .45,
      );
    });
  };
  return root;
}
