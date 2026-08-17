import { GENESIS_BEACON_NAMES } from "./genesisChapterBeacons.js";

export const GENESIS_SURFACE_PART_NAMES = Object.freeze([
  "GenesisWorld_MainPlanet",
  "GenesisWorld_CrystalSpires",
  "GenesisWorld_SwampPods",
]);

export const PERMANENT_PLANET_STRUCTURES = Object.freeze([
  "GenesisWorld_CrystalSpires",
  "GenesisWorld_SwampPods",
]);

export const GENESIS_MOON_NAMES = Object.freeze([
  "GenesisMoon_Rocky",
  "GenesisMoon_Lava",
  "GenesisMoon_Blue",
  "GenesisMoon_Red",
]);

function collectVerticesInModelSpace(THREE, mesh, model) {
  const position = mesh.geometry?.getAttribute("position");
  if (!position?.count) return [];
  mesh.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const vertices = [];
  const vertex = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    vertices.push(model.worldToLocal(vertex.clone()));
  }
  return vertices;
}

function calculateRadiusAroundCenter(vertices, center) {
  if (!vertices.length) return 0;
  let total = 0;
  vertices.forEach((vertex) => { total += vertex.distanceTo(center); });
  return total / vertices.length;
}

export function calculateMeanSurfaceRadius(THREE, mesh, model) {
  return calculateRadiusAroundCenter(
    collectVerticesInModelSpace(THREE, mesh, model),
    new THREE.Vector3(),
  );
}

function attachNamedObjects(model, root, names) {
  names.forEach((name) => {
    const object = model.getObjectByName(name);
    if (object && object !== root && object.parent !== root) root.attach(object);
  });
}

function attachToCenteredRoot(THREE, model, parent, root, objects) {
  const available = objects.filter(Boolean);
  if (!available.length) return;
  model.updateMatrixWorld(true);
  parent.updateMatrixWorld(true);
  const box = new THREE.Box3();
  available.forEach((object) => box.expandByObject(object));
  const centerWorld = box.getCenter(new THREE.Vector3());
  const centerLocal = parent.worldToLocal(centerWorld.clone());
  root.position.copy(centerLocal);
  if (root.parent !== parent) parent.add(root);
  root.updateMatrixWorld(true);
  available.forEach((object) => root.attach(object));
}

function createLayoutRoots(THREE, model) {
  const surfaceRoot = new THREE.Group();
  surfaceRoot.name = "GenesisPlanetSurfaceRoot";
  const moonRoot = new THREE.Group();
  moonRoot.name = "GenesisMoonsRoot";
  const beaconRoot = new THREE.Group();
  beaconRoot.name = "GenesisBeaconsRoot";
  const ringedMoonRoot = new THREE.Group();
  ringedMoonRoot.name = "GenesisMoon_RingedRoot";
  model.add(surfaceRoot, moonRoot, beaconRoot);
  moonRoot.add(ringedMoonRoot);
  return { surfaceRoot, moonRoot, beaconRoot, ringedMoonRoot };
}

function readExistingLayout(THREE, model) {
  const metadata = model.userData.genesisLayoutMetadata;
  return {
    corrected: Boolean(metadata?.corrected),
    sourceCenter: new THREE.Vector3().fromArray(metadata?.sourceCenter || [0, 0, 0]),
    sourceRadius: metadata?.sourceRadius || 1,
    meanSurfaceRadius: metadata?.meanSurfaceRadius || 1,
    scale: metadata?.scale || 1,
    surfaceRoot: model.getObjectByName("GenesisPlanetSurfaceRoot"),
    moonRoot: model.getObjectByName("GenesisMoonsRoot"),
    beaconRoot: model.getObjectByName("GenesisBeaconsRoot"),
    ringedMoonRoot: model.getObjectByName("GenesisMoon_RingedRoot"),
  };
}

export function normalizeGenesisPlanet({ THREE, model, targetRadius = 1 }) {
  if (model.userData.genesisLayoutNormalized) return readExistingLayout(THREE, model);

  model.updateMatrixWorld(true);
  const mainPlanet = model.getObjectByName("GenesisWorld_MainPlanet");
  if (!mainPlanet?.isMesh) throw new Error("Superfície GenesisWorld_MainPlanet ausente");

  const mainBox = new THREE.Box3().setFromObject(mainPlanet);
  if (mainBox.isEmpty()) throw new Error("Superfície Genesis sem volume válido");
  const mainCenterWorld = mainBox.getCenter(new THREE.Vector3());
  const mainCenterLocal = model.worldToLocal(mainCenterWorld.clone());
  const sourceVertices = collectVerticesInModelSpace(THREE, mainPlanet, model);
  const referenceRadius = calculateRadiusAroundCenter(sourceVertices, mainCenterLocal);
  if (!Number.isFinite(referenceRadius) || referenceRadius <= 0) {
    throw new Error("Superfície Genesis sem raio visual válido");
  }

  const requiresLayoutRepair = mainCenterLocal.length() > referenceRadius * .05;
  const roots = createLayoutRoots(THREE, model);
  attachNamedObjects(model, roots.surfaceRoot, GENESIS_SURFACE_PART_NAMES);
  GENESIS_MOON_NAMES.forEach((name) => {
    const moonRoot = new THREE.Group();
    moonRoot.name = `${name}Root`;
    attachToCenteredRoot(
      THREE, model, roots.moonRoot, moonRoot, [model.getObjectByName(name)],
    );
  });
  attachToCenteredRoot(THREE, model, roots.moonRoot, roots.ringedMoonRoot, [
    model.getObjectByName("GenesisMoon_Ringed"),
    model.getObjectByName("GenesisMoon_Ringed_Ring"),
  ]);
  attachNamedObjects(model, roots.beaconRoot, GENESIS_BEACON_NAMES);

  if (requiresLayoutRepair) roots.surfaceRoot.position.copy(mainCenterLocal).multiplyScalar(-1);
  model.updateMatrixWorld(true);

  const meanSurfaceRadius = calculateMeanSurfaceRadius(THREE, mainPlanet, model);
  if (!Number.isFinite(meanSurfaceRadius) || meanSurfaceRadius <= 0) {
    throw new Error("Falha ao calcular o raio corrigido do planeta Genesis");
  }
  const scale = targetRadius / meanSurfaceRadius;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  model.userData.genesisLayoutNormalized = true;
  model.userData.genesisLayoutMetadata = {
    corrected: requiresLayoutRepair,
    sourceCenter: mainCenterLocal.toArray(),
    sourceRadius: referenceRadius,
    meanSurfaceRadius: targetRadius,
    scale,
  };

  return {
    corrected: requiresLayoutRepair,
    sourceCenter: mainCenterLocal.clone(),
    sourceRadius: referenceRadius,
    meanSurfaceRadius: targetRadius,
    scale,
    ...roots,
  };
}
