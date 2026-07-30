function objectCenter(THREE, object, target = new THREE.Vector3()) {
  return object
    ? new THREE.Box3().setFromObject(object).getCenter(target)
    : target.set(0, 0, 0);
}

function createObjectLabel(THREE, text, color = "#e2f6ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(2, 8, 18, .82)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.fillStyle = color;
  context.font = "24px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData.instanceOwned = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false,
  }));
  sprite.name = `DebugLabel_${text}`;
  sprite.scale.set(.72, .12, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function isGenesisPlanetDebugEnabled() {
  return import.meta.env.DEV
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debugPlanet") === "1";
}

export function createGenesisPlanetDebug({
  THREE, parent, model, parts, layout, routeRadius = 1.045, markerRadius = 1.055,
}) {
  const root = new THREE.Group();
  root.name = "GenesisPlanetDebug";
  root.add(new THREE.AxesHelper(1.5));
  [
    { name: "SurfaceRadius", radius: 1, color: 0x22d3ee },
    { name: "AtmosphereRadius", radius: 1.03, color: 0x818cf8 },
    { name: "RouteRadius", radius: routeRadius, color: 0xfacc15 },
    { name: "MarkerRadius", radius: markerRadius, color: 0xf472b6 },
  ].forEach(({ name, radius, color }) => {
    const helper = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 12),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: .24 }),
    );
    helper.name = `Debug${name}`;
    root.add(helper);
  });
  parts.moons.forEach((moon) => {
    const box = new THREE.BoxHelper(moon, 0xfb7185);
    box.name = `DebugBox_${moon.name}`;
    root.add(box);
  });
  const centerMarker = new THREE.Mesh(
    new THREE.SphereGeometry(.025, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  centerMarker.name = "DebugMainPlanetCenter";
  root.add(centerMarker);
  parent.add(root);
  model.updateMatrixWorld(true);
  parent.updateMatrixWorld(true);

  [
    parts.mainPlanet,
    ...parts.moons,
    ...Object.values(parts.beacons),
  ].filter(Boolean).forEach((object) => {
    const label = createObjectLabel(THREE, object.name);
    label.position.copy(parent.worldToLocal(objectCenter(THREE, object).clone()));
    label.position.y += .12;
    root.add(label);
  });

  const diagnostics = {
    corrected: layout.corrected,
    sourceCenter: layout.sourceCenter.toArray().map((value) => Number(value.toFixed(4))),
    sourceRadius: Number(layout.sourceRadius.toFixed(4)),
    meanSurfaceRadius: Number(layout.meanSurfaceRadius.toFixed(4)),
    atmosphereCenter: objectCenter(THREE, parts.atmosphere).toArray().map((value) => Number(value.toFixed(4))),
    cloudCenter: objectCenter(THREE, parts.clouds).toArray().map((value) => Number(value.toFixed(4))),
  };
  parts.moons.forEach((moon) => {
    diagnostics[`${moon.name}Distance`] = Number(
      objectCenter(THREE, moon).length().toFixed(4),
    );
  });
  Object.entries(parts.beacons).forEach(([chapterId, beacon]) => {
    diagnostics[`${chapterId}Beacon`] = objectCenter(THREE, beacon)
      .toArray().map((value) => Number(value.toFixed(4)));
  });
  console.table(diagnostics);
  return root;
}
