import {
  createSeededRandom,
  createShellPoints,
  createSurfaceInstances,
  createThemeMaterial,
  randomSurfaceNormal,
  setMaterialEffectPulse,
} from "./genesisEffectUtils.js";

function createLightningGroup(THREE, profile) {
  const group = new THREE.Group();
  group.name = "StormLightning";

  const material = new THREE.LineBasicMaterial({
    color: "#dbeafe",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const random = createSeededRandom(4403);

  const count = Math.max(2, profile.lines);
  for (let index = 0; index < count; index += 1) {
    const startNormal = randomSurfaceNormal(THREE, random);
    const tangent = randomSurfaceNormal(THREE, random)
      .sub(startNormal.clone().multiplyScalar(
        randomSurfaceNormal(THREE, random).dot(startNormal),
      ))
      .normalize();

    const points = [];
    for (let step = 0; step < 5; step += 1) {
      const t = step / 4;
      const point = startNormal.clone()
        .addScaledVector(tangent, (t - .5) * .3)
        .addScaledVector(
          randomSurfaceNormal(THREE, random),
          (random() - .5) * .045,
        )
        .normalize()
        .multiplyScalar(1.035 + Math.sin(t * Math.PI) * .06);
      points.push(point);
    }

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      material,
    );
    group.add(line);
  }

  group.userData.lightningMaterial = material;
  return group;
}

export function createStormPlanetEffects({
  THREE,
  profile,
}) {
  const root = new THREE.Group();
  root.name = "Chapter04_StormEffects";

  const clouds = createShellPoints({
    THREE,
    count: profile.particles,
    seed: 4401,
    minimumRadius: 1.1,
    radiusRange: .32,
    color: "#818cf8",
    size: .03,
    opacity: .28,
    additive: true,
    equatorial: true,
  });
  clouds.name = "StormCloudField";
  root.add(clouds);

  const debrisMaterial = createThemeMaterial(THREE, {
    color: "#64748b",
    roughness: .9,
    metalness: .06,
  });
  const debris = createSurfaceInstances({
    THREE,
    geometry: new THREE.TetrahedronGeometry(.025, 0),
    material: debrisMaterial,
    count: Math.max(8, Math.floor(profile.structures * .62)),
    seed: 4402,
    radius: 1.13,
    minimumScale: .5,
    scaleRange: 1.4,
    verticalScale: 1.2,
  });
  debris.name = "StormSuspendedDebris";
  root.add(debris);

  const cycloneMaterial = new THREE.MeshBasicMaterial({
    color: "#67e8f9",
    transparent: true,
    opacity: .13,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cyclone = new THREE.Mesh(
    new THREE.TorusGeometry(1.17, .018, 8, 112),
    cycloneMaterial,
  );
  cyclone.name = "StormCyclone";
  cyclone.rotation.set(Math.PI * .46, -.36, Math.PI * .18);
  root.add(cyclone);

  const lightning = createLightningGroup(THREE, profile);
  root.add(lightning);
  const lightningMaterial = lightning.userData.lightningMaterial;

  root.userData.update = (
    delta,
    elapsed,
    reduceMotion,
  ) => {
    const motion = reduceMotion ? .06 : 1;
    clouds.rotation.y -= delta * .13 * motion;
    clouds.rotation.z += delta * .025 * motion;
    debris.rotation.y += delta * .08 * motion;
    cyclone.rotation.z += delta * .12 * motion;

    const cycle = elapsed % 5.4;
    const secondary = (elapsed + 1.7) % 7.1;
    const flash = reduceMotion
      ? 0
      : Math.max(
        cycle < .16 ? Math.sin(cycle / .16 * Math.PI) : 0,
        secondary < .09
          ? Math.sin(secondary / .09 * Math.PI) * .62
          : 0,
      );

    setMaterialEffectPulse(lightningMaterial, flash);
    setMaterialEffectPulse(
      cycloneMaterial,
      .7 + Math.sin(elapsed * .82) * .18,
    );
  };

  return root;
}
