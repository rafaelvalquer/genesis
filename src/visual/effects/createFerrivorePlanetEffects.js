import { createRouteRibbon } from "./genesisRouteEffectUtils.js";

export function createFerrivorePlanetEffects({ THREE, profile }) {
  const root = new THREE.Group(); root.name = "Chapter07_FerrivoreEffects";
  const route = createRouteRibbon({ THREE, chapterId: "chapter_07", radius: 1.03, width: .05,
    material: new THREE.MeshBasicMaterial({ color: "#C65A33", transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide }) });
  const vein = createRouteRibbon({ THREE, chapterId: "chapter_07", radius: 1.034, width: .012,
    material: new THREE.MeshBasicMaterial({ color: "#63E6D6", transparent: true, opacity: .26, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }) });
  root.add(route, vein);
  root.userData.update = (_delta, elapsed, reduceMotion) => {
    vein.material.opacity = reduceMotion ? .24 : .22 + (Math.sin(elapsed * .0015) + 1) * .04;
  };
  return root;
}
