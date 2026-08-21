import { createRoutePoints, createRouteRibbon, getChapterPhaseFrames } from "./genesisRouteEffectUtils.js";

export function createFerruginousPlanetEffects({ THREE, profile }) {
  const root = new THREE.Group();
  root.name = "Chapter07_FerruginousEffects";
  const route = createRouteRibbon({ THREE, chapterId: "chapter_07", radius: 1.03, width: .065,
    material: new THREE.MeshBasicMaterial({ color: "#b65a32", transparent: true, opacity: .68,
      depthWrite: false, side: THREE.DoubleSide }) });
  const guidance = createRouteRibbon({ THREE, chapterId: "chapter_07", radius: 1.034, width: .018,
    material: new THREE.MeshBasicMaterial({ color: "#67e8f9", transparent: true, opacity: .56,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }) });
  root.add(route, guidance);
  const dust = createRoutePoints({ THREE, chapterId: "chapter_07", count: Math.max(14, Math.floor(profile.particles * .48)),
    seed: 7756, radius: 1.052, heightRange: .055, minimumSideOffset: .025, color: "#d08a62", size: .014, opacity: .48 });
  root.add(dust);
  const frames = getChapterPhaseFrames(THREE, "chapter_07");
  frames.forEach((frame, index) => {
    const landmark = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.025 + index * .002, .035, .025, 8),
      new THREE.MeshStandardMaterial({ color: index === 7 ? "#5e6870" : "#3f3734", roughness: .72, metalness: .45 }));
    const tower = new THREE.Mesh(new THREE.BoxGeometry(.018, .06 + index * .004, .018),
      new THREE.MeshStandardMaterial({ color: "#5e6870", roughness: .58, metalness: .58 }));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.009 + (index === 7 ? .005 : 0), 8, 6),
      new THREE.MeshBasicMaterial({ color: index === 7 ? "#facc15" : "#67e8f9", transparent: true, opacity: .9 }));
    tower.position.y = .04; beacon.position.y = .077 + index * .004;
    landmark.add(base, tower, beacon);
    landmark.position.copy(frame.normal).multiplyScalar(1.045);
    landmark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), frame.normal);
    landmark.userData.phaseIndex = index;
    root.add(landmark);
  });
  root.userData.update = (_delta, elapsed, reduceMotion) => {
    guidance.material.opacity = reduceMotion ? .52 : .44 + (Math.sin(elapsed * .0022) + 1) * .1;
    if (!reduceMotion) dust.rotation.y += .00022;
  };
  return root;
}
