import {
  alignObjectToSurface,
  createShellPoints,
  createSurfaceInstances,
  createThemeMaterial,
  setMaterialEffectPulse,
} from "./genesisEffectUtils.js";

function createRibCage(THREE) {
  const root = new THREE.Group();
  root.name = "ChitinColossalRibCage";

  const material = createThemeMaterial(THREE, {
    color: "#d6a15f",
    roughness: .86,
    metalness: 0,
    emissive: "#7c2d12",
    emissiveIntensity: .05,
  });

  for (let index = 0; index < 6; index += 1) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(
        .16 + index * .018,
        .0085,
        6,
        28,
        Math.PI * 1.14,
      ),
      material,
    );
    rib.position.set(
      (index - 2.5) * .034,
      .012 + Math.abs(index - 2.5) * .004,
      0,
    );
    rib.rotation.set(
      Math.PI / 2,
      .15,
      -.56 + index * .035,
    );
    root.add(rib);
  }

  const normal = new THREE.Vector3(-.56, -.18, .8).normalize();
  root.position.copy(normal).multiplyScalar(1.036);
  alignObjectToSurface(THREE, root, normal);
  root.scale.setScalar(1.08);

  return root;
}

export function createChitinPlanetEffects({
  THREE,
  profile,
}) {
  const root = new THREE.Group();
  root.name = "Chapter03_ChitinEffects";

  const center = new THREE.Vector3(-.56, -.18, .8).normalize();
  const hornMaterial = createThemeMaterial(THREE, {
    color: "#9a5a24",
    roughness: .84,
    metalness: 0,
    emissive: "#431407",
    emissiveIntensity: .04,
  });
  const horns = createSurfaceInstances({
    THREE,
    geometry: new THREE.ConeGeometry(.026, .14, 5),
    material: hornMaterial,
    count: Math.max(8, Math.floor(profile.structures * .72)),
    seed: 3301,
    radius: 1.02,
    center,
    spread: .78,
    minimumScale: .58,
    scaleRange: 1.1,
    verticalScale: 1.55,
  });
  horns.name = "ChitinHorns";
  root.add(horns);

  const ribCage = createRibCage(THREE);
  root.add(ribCage);

  const dust = createShellPoints({
    THREE,
    count: profile.particles,
    seed: 3302,
    minimumRadius: 1.08,
    radiusRange: .42,
    color: "#d9912b",
    size: .015,
    opacity: .42,
    additive: false,
    equatorial: true,
  });
  dust.name = "ChitinDustBand";
  root.add(dust);

  const stormMaterial = new THREE.MeshBasicMaterial({
    color: "#f59e0b",
    transparent: true,
    opacity: .14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stormRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, .014, 8, 96),
    stormMaterial,
  );
  stormRing.name = "ChitinSandCurrent";
  stormRing.rotation.set(Math.PI * .54, .22, Math.PI * .12);
  root.add(stormRing);

  root.userData.update = (
    delta,
    elapsed,
    reduceMotion,
  ) => {
    const motion = reduceMotion ? .08 : 1;
    dust.rotation.y += delta * .16 * motion;
    stormRing.rotation.z -= delta * .075 * motion;
    ribCage.rotation.y = Math.sin(elapsed * .14) * .018 * motion;

    setMaterialEffectPulse(
      stormMaterial,
      .68 + Math.sin(elapsed * .9) * .16,
    );
  };

  return root;
}
