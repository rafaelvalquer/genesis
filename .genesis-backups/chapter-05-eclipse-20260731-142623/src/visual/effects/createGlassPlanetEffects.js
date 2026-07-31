import {
  createShellPoints,
  createSurfaceInstances,
  createThemeMaterial,
  setMaterialEffectPulse,
} from "./genesisEffectUtils.js";

export function createGlassPlanetEffects({
  THREE,
  profile,
}) {
  const root = new THREE.Group();
  root.name = "Chapter02_GlassEffects";

  const center = new THREE.Vector3(-.48, .42, .77).normalize();
  const crystalMaterial = createThemeMaterial(THREE, {
    color: "#a78bfa",
    emissive: "#7fffd4",
    emissiveIntensity: .18,
    roughness: .28,
    metalness: .09,
  });
  const crystals = createSurfaceInstances({
    THREE,
    geometry: new THREE.ConeGeometry(.026, .13, 4),
    material: crystalMaterial,
    count: profile.structures,
    seed: 2201,
    radius: 1.022,
    center,
    spread: .72,
    minimumScale: .55,
    scaleRange: 1.25,
    verticalScale: 1.7,
  });
  crystals.name = "GlassCrystalSpires";
  root.add(crystals);

  const auroraMaterials = [];
  for (let index = 0; index < Math.max(1, profile.rings); index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 ? "#7fffd4" : "#a78bfa",
      transparent: true,
      opacity: .15 - index * .025,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    auroraMaterials.push(material);

    const aurora = new THREE.Mesh(
      new THREE.TorusGeometry(
        1.16 + index * .045,
        .012,
        8,
        96,
      ),
      material,
    );
    aurora.name = `GlassAurora_${index + 1}`;
    aurora.rotation.set(
      Math.PI * (.3 + index * .17),
      index * .54,
      Math.PI * .16,
    );
    root.add(aurora);
  }

  const shards = createShellPoints({
    THREE,
    count: Math.max(16, Math.floor(profile.particles * .78)),
    seed: 2202,
    minimumRadius: 1.08,
    radiusRange: .5,
    color: "#c4b5fd",
    size: .021,
    opacity: .5,
    additive: true,
  });
  shards.name = "GlassOrbitalShards";
  root.add(shards);

  root.userData.update = (
    delta,
    elapsed,
    reduceMotion,
  ) => {
    const motion = reduceMotion ? .08 : 1;
    shards.rotation.y -= delta * .055 * motion;
    shards.rotation.z += delta * .018 * motion;

    auroraMaterials.forEach((material, index) => {
      setMaterialEffectPulse(
        material,
        .76 + Math.sin(elapsed * .72 + index * 1.8) * .18,
      );
    });

    crystalMaterial.emissiveIntensity = reduceMotion
      ? .16
      : .14 + (Math.sin(elapsed * .82) * .5 + .5) * .18;
  };

  return root;
}
