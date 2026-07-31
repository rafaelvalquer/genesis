import {
  clusteredSurfaceNormal,
  createSeededRandom,
  createShellPoints,
  createSurfaceArc,
  createSurfaceInstances,
  createThemeMaterial,
  setMaterialEffectPulse,
} from "./genesisEffectUtils.js";

export function createHivePlanetEffects({
  THREE,
  profile,
}) {
  const root = new THREE.Group();
  root.name = "Chapter01_HiveEffects";

  const center = new THREE.Vector3(.62, .18, .76).normalize();
  const podMaterial = createThemeMaterial(THREE, {
    color: "#0f766e",
    emissive: "#22d3ee",
    emissiveIntensity: .18,
    roughness: .76,
    metalness: 0,
  });
  const pods = createSurfaceInstances({
    THREE,
    geometry: new THREE.DodecahedronGeometry(.035, 0),
    material: podMaterial,
    count: profile.structures,
    seed: 1101,
    radius: 1.028,
    center,
    spread: .66,
    minimumScale: .55,
    scaleRange: 1.1,
    verticalScale: 1.7,
  });
  pods.name = "HivePods";
  root.add(pods);

  const veinMaterials = [];
  const random = createSeededRandom(1102);
  for (let index = 0; index < profile.lines; index += 1) {
    const material = new THREE.LineBasicMaterial({
      color: index % 2 ? "#2dd4bf" : "#22d3ee",
      transparent: true,
      opacity: .42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    veinMaterials.push(material);

    const start = clusteredSurfaceNormal(
      THREE,
      random,
      center,
      .74,
    );
    const end = clusteredSurfaceNormal(
      THREE,
      random,
      center.clone().multiplyScalar(.72)
        .add(new THREE.Vector3(-.35, .1, .12))
        .normalize(),
      .78,
    );

    const vein = createSurfaceArc({
      THREE,
      start,
      end,
      radius: 1.035,
      steps: 26,
      material,
    });
    vein.name = `HiveVein_${index + 1}`;
    vein.renderOrder = 2;
    root.add(vein);
  }

  const spores = createShellPoints({
    THREE,
    count: profile.particles,
    seed: 1103,
    minimumRadius: 1.08,
    radiusRange: .38,
    color: "#2dd4bf",
    size: .018,
    opacity: .52,
    additive: true,
  });
  spores.name = "HiveSpores";
  root.add(spores);

  root.userData.update = (
    delta,
    elapsed,
    reduceMotion,
  ) => {
    const motion = reduceMotion ? .12 : 1;
    spores.rotation.y += delta * .075 * motion;
    spores.rotation.x = Math.sin(elapsed * .12) * .03 * motion;

    veinMaterials.forEach((material, index) => {
      setMaterialEffectPulse(
        material,
        .72 + Math.sin(elapsed * 1.35 + index) * .22,
      );
    });

    podMaterial.emissiveIntensity = reduceMotion
      ? .16
      : .15 + (Math.sin(elapsed * 1.1) * .5 + .5) * .13;
  };

  return root;
}
