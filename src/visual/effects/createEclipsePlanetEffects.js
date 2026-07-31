import {
  clusteredSurfaceNormal,
  createSeededRandom,
  createShellPoints,
  createSurfaceArc,
  createSurfaceInstances,
  createThemeMaterial,
  setMaterialEffectPulse,
} from "./genesisEffectUtils.js";

function createCorona(THREE, profile) {
  const root = new THREE.Group();
  root.name = "EclipseCorona";
  root.userData.materials = [];

  for (
    let index = 0;
    index < Math.max(2, profile.rings + 1);
    index += 1
  ) {
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 ? "#22d3ee" : "#d946ef",
      transparent: true,
      opacity: index === 0 ? .18 : .1,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        1.17 + index * .045,
        .012 + index * .003,
        8,
        112,
      ),
      material,
    );
    ring.name = `EclipseCoronaRing_${index + 1}`;
    ring.rotation.set(
      Math.PI * (.34 + index * .13),
      .35 + index * .42,
      Math.PI * (.09 + index * .08),
    );
    root.userData.materials.push(material);
    root.add(ring);
  }

  return root;
}

function createBeacon(THREE, normal) {
  const root = new THREE.Group();
  root.name = "EclipseCoreBeacon";
  root.position.copy(normal).multiplyScalar(1.045);
  root.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal,
  );

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: "#14051f",
    emissive: "#d946ef",
    emissiveIntensity: .78,
    roughness: .36,
    metalness: .22,
  });
  root.userData.coreMaterial = coreMaterial;
  root.add(new THREE.Mesh(
    new THREE.OctahedronGeometry(.045, 0),
    coreMaterial,
  ));

  for (let index = 0; index < 2; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        .072 + index * .026,
        .004,
        6,
        32,
      ),
      new THREE.MeshBasicMaterial({
        color: "#22d3ee",
        transparent: true,
        opacity: .48,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .012 + index * .012;
    root.add(ring);
  }

  return root;
}

export function createEclipsePlanetEffects({
  THREE,
  profile,
}) {
  const root = new THREE.Group();
  root.name = "Chapter05_EclipseEffects";

  const center = new THREE.Vector3(
    -.52,
    .68,
    .52,
  ).normalize();

  const obeliskMaterial = createThemeMaterial(THREE, {
    color: "#2e1065",
    emissive: "#d946ef",
    emissiveIntensity: .18,
    roughness: .42,
    metalness: .18,
  });
  const obelisks = createSurfaceInstances({
    THREE,
    geometry: new THREE.TetrahedronGeometry(.043, 0),
    material: obeliskMaterial,
    count: Math.max(
      10,
      Math.floor(profile.structures * .82),
    ),
    seed: 5501,
    radius: 1.025,
    center,
    spread: .76,
    minimumScale: .55,
    scaleRange: 1.2,
    verticalScale: 2.1,
  });
  obelisks.name = "EclipseObelisks";
  root.add(obelisks);

  const fractureMaterials = [];
  const random = createSeededRandom(5502);
  for (
    let index = 0;
    index < Math.max(3, profile.lines);
    index += 1
  ) {
    const material = new THREE.LineBasicMaterial({
      color: index % 2 ? "#22d3ee" : "#d946ef",
      transparent: true,
      opacity: index % 2 ? .28 : .42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    fractureMaterials.push(material);

    const start = clusteredSurfaceNormal(
      THREE,
      random,
      center,
      .72,
    );
    const end = clusteredSurfaceNormal(
      THREE,
      random,
      center.clone()
        .add(new THREE.Vector3(
          -.18 + random() * .36,
          -.2 + random() * .2,
          -.12 + random() * .24,
        ))
        .normalize(),
      .68,
    );
    const fracture = createSurfaceArc({
      THREE,
      start,
      end,
      radius: 1.038,
      steps: 28,
      material,
    });
    fracture.name = `EclipseFracture_${index + 1}`;
    fracture.renderOrder = 3;
    root.add(fracture);
  }

  const corona = createCorona(THREE, profile);
  root.add(corona);

  const fragments = createShellPoints({
    THREE,
    count: profile.particles,
    seed: 5503,
    minimumRadius: 1.1,
    radiusRange: .58,
    color: "#f0abfc",
    size: .019,
    opacity: .48,
    additive: true,
  });
  fragments.name = "EclipseOrbitalFragments";
  root.add(fragments);

  const cyanFragments = createShellPoints({
    THREE,
    count: Math.max(
      12,
      Math.floor(profile.particles * .36),
    ),
    seed: 5504,
    minimumRadius: 1.16,
    radiusRange: .46,
    color: "#22d3ee",
    size: .014,
    opacity: .42,
    additive: true,
    equatorial: true,
  });
  cyanFragments.name = "EclipseCyanFragments";
  root.add(cyanFragments);

  const beacon = createBeacon(THREE, center);
  root.add(beacon);

  root.userData.update = (
    delta,
    elapsed,
    reduceMotion,
  ) => {
    const motion = reduceMotion ? .07 : 1;
    fragments.rotation.y -= delta * .075 * motion;
    fragments.rotation.z += delta * .018 * motion;
    cyanFragments.rotation.y += delta * .11 * motion;
    corona.rotation.y += delta * .035 * motion;
    beacon.rotation.y -= delta * .16 * motion;

    fractureMaterials.forEach((material, index) => {
      setMaterialEffectPulse(
        material,
        .7 + Math.sin(
          elapsed * 1.18 + index * .8,
        ) * .2,
      );
    });

    corona.userData.materials.forEach(
      (material, index) => {
        setMaterialEffectPulse(
          material,
          .72 + Math.sin(
            elapsed * .74 + index * 1.4,
          ) * .16,
        );
      },
    );

    obeliskMaterial.emissiveIntensity = reduceMotion
      ? .17
      : .14
        + (Math.sin(elapsed * .92) * .5 + .5)
        * .18;

    beacon.userData.coreMaterial.emissiveIntensity =
      reduceMotion
        ? .62
        : .56
          + (Math.sin(elapsed * 1.52) * .5 + .5)
          * .54;
  };

  return root;
}
