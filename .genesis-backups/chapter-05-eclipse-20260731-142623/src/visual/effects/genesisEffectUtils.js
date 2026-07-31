export function createSeededRandom(seed = 1) {
  let value = Math.abs(Math.floor(seed)) || 1;

  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function randomSurfaceNormal(THREE, random) {
  const y = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  );
}

export function clusteredSurfaceNormal(
  THREE,
  random,
  center,
  spread = .45,
) {
  const jitter = randomSurfaceNormal(THREE, random)
    .multiplyScalar(spread * random());

  return center.clone().add(jitter).normalize();
}

export function alignObjectToSurface(
  THREE,
  object,
  normal,
) {
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal,
  );
}

export function createShellPoints({
  THREE,
  count,
  seed,
  minimumRadius,
  radiusRange,
  color,
  size,
  opacity = .6,
  additive = true,
  equatorial = false,
}) {
  const random = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = minimumRadius + random() * radiusRange;
    const angle = random() * Math.PI * 2;
    const y = equatorial
      ? (random() - .5) * .44
      : random() * 2 - 1;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));

    positions[index * 3] = Math.cos(angle) * radial * radius;
    positions[index * 3 + 1] = y * radius;
    positions[index * 3 + 2] = Math.sin(angle) * radial * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );

  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive
      ? THREE.AdditiveBlending
      : THREE.NormalBlending,
  });

  return new THREE.Points(geometry, material);
}

export function createSurfaceArc({
  THREE,
  start,
  end,
  radius = 1.025,
  steps = 24,
  material,
}) {
  const points = [];

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    points.push(
      start.clone()
        .lerp(end, t)
        .normalize()
        .multiplyScalar(radius),
    );
  }

  const geometry = new THREE.BufferGeometry()
    .setFromPoints(points);

  return new THREE.Line(geometry, material);
}

export function createSurfaceInstances({
  THREE,
  geometry,
  material,
  count,
  seed,
  radius = 1.02,
  center = null,
  spread = .5,
  minimumScale = .7,
  scaleRange = .7,
  verticalScale = 1,
}) {
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    count,
  );
  const random = createSeededRandom(seed);
  const dummy = new THREE.Object3D();

  for (let index = 0; index < count; index += 1) {
    const normal = center
      ? clusteredSurfaceNormal(
        THREE,
        random,
        center,
        spread,
      )
      : randomSurfaceNormal(THREE, random);

    dummy.position.copy(normal).multiplyScalar(radius);
    alignObjectToSurface(THREE, dummy, normal);

    const scale = minimumScale + random() * scaleRange;
    dummy.scale.set(
      scale,
      scale * verticalScale,
      scale,
    );
    dummy.rotateY(random() * Math.PI * 2);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createThemeMaterial(
  THREE,
  properties = {},
) {
  return new THREE.MeshStandardMaterial({
    roughness: .72,
    metalness: .04,
    ...properties,
  });
}

export function setMaterialEffectPulse(
  material,
  multiplier,
) {
  material.userData.genesisEffectPulse = Math.max(
    0,
    Number.isFinite(multiplier) ? multiplier : 1,
  );
}
