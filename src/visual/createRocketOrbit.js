import { cloneGltfScene, loadGltfModel } from "./loadGltfModel.js";
import { centerAndScaleModel } from "./normalizeGltfModel.js";

export const GENESIS_ROCKET_URL = "/models/command/low-poly-rocket-ship.glb";
export const ROCKET_FORWARD_VECTOR = Object.freeze({ x: 0, y: 0, z: 1 });
export const ROCKET_MODEL_ROTATION = Object.freeze({ x: -Math.PI / 2, y: 0, z: Math.PI / 2 });

export function createRocketOrbitNodes({ THREE, parent, quality, biome, model }) {
  const orbitRoot = new THREE.Group();
  orbitRoot.name = "rocketOrbitRoot";
  const motionNode = new THREE.Group();
  motionNode.name = "rocketMotionNode";
  const orientationNode = new THREE.Group();
  orientationNode.name = "rocketOrientationNode";
  orientationNode.rotation.set(ROCKET_MODEL_ROTATION.x, ROCKET_MODEL_ROTATION.y, ROCKET_MODEL_ROTATION.z);
  orientationNode.add(model);
  const engineGlow = new THREE.Mesh(
    new THREE.ConeGeometry(.025, .12, 8),
    new THREE.MeshBasicMaterial({
      color: biome.atmosphere, transparent: true, opacity: quality.quality === "low" ? .38 : .68,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  engineGlow.rotation.x = Math.PI / 2;
  engineGlow.position.z = .16;
  orientationNode.add(engineGlow);
  motionNode.add(orientationNode);
  orbitRoot.add(motionNode);
  parent.add(orbitRoot);
  return {
    orbitRoot, motionNode, orientationNode, model, engineGlow,
    forward: new THREE.Vector3(ROCKET_FORWARD_VECTOR.x, ROCKET_FORWARD_VECTOR.y, ROCKET_FORWARD_VECTOR.z),
  };
}

export async function createRocketOrbit({ THREE, parent, quality, biome }) {
  const gltf = await loadGltfModel(GENESIS_ROCKET_URL);
  const model = cloneGltfScene(gltf, {
    cloneGeometries: true,
    cloneMaterials: true,
    cloneTextures: true,
  });
  centerAndScaleModel(THREE, model, .24);
  return createRocketOrbitNodes({ THREE, parent, quality, biome, model });
}

export function updateRocketOrbit(THREE, rocket, elapsed, reduceMotion) {
  if (!rocket) return;
  const angle = reduceMotion ? .65 : elapsed * Math.PI * 2 / 24;
  const nextAngle = angle + .025;
  const current = new THREE.Vector3(
    Math.cos(angle) * 1.55,
    Math.sin(angle * .65) * .25,
    Math.sin(angle) * 1.25,
  );
  const next = new THREE.Vector3(
    Math.cos(nextAngle) * 1.55,
    Math.sin(nextAngle * .65) * .25,
    Math.sin(nextAngle) * 1.25,
  );
  const tangent = next.sub(current).normalize();
  rocket.motionNode.position.copy(current);
  rocket.motionNode.quaternion.setFromUnitVectors(rocket.forward, tangent);
  if (!reduceMotion && rocket.engineGlow) rocket.engineGlow.scale.y = .85 + Math.sin(elapsed * 8) * .14;
}
