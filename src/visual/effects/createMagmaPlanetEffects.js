import { createRoutePoints, createRouteRibbon, getChapterPhaseFrames } from "./genesisRouteEffectUtils.js";

export function createMagmaPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group(); root.name = "Chapter06_MagmaEffects";
  const lava = createRouteRibbon({ THREE, chapterId: "chapter_06", radius: 1.028, width: .085, material: new THREE.MeshBasicMaterial({ color: "#ea580c", transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }) });
  root.add(lava);
  const embers = createRoutePoints({ THREE, chapterId: "chapter_06", count: Math.max(16, Math.floor(profile.particles * .55)), seed: 6606, radius: 1.052, heightRange: .07, minimumSideOffset: .02, color: "#fbbf24", size: .018, opacity: .65 });
  root.add(embers);
  const frames = getChapterPhaseFrames(THREE, "chapter_06");
  frames.filter((_, index) => [0, 2, 5, 7].includes(index)).forEach((frame, index) => { const volcano = new THREE.Mesh(new THREE.ConeGeometry(.055, .12, 7), new THREE.MeshBasicMaterial({ color: "#7c2d12", transparent: true, opacity: .8 })); volcano.position.copy(frame.normal).multiplyScalar(1.065); volcano.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), frame.normal); volcano.userData.phase = index; root.add(volcano); });
  root.userData.update = (_delta, elapsed, reduceMotion) => { lava.material.opacity = .28 + (reduceMotion ? .05 : (Math.sin(elapsed * .002) + 1) * .08); embers.rotation.y += reduceMotion ? 0 : .00035; };
  return root;
}
