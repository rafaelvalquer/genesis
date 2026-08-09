import { cloneGltfScene, loadGltfModel } from "./loadGltfModel.js";
import { centerAndScaleModel } from "./normalizeGltfModel.js";

export const GENESIS_ROCKET_URL = "/models/command/low-poly-rocket-ship.glb";
// The source GLB is long on its local Y axis, with the engines at -Y. Align
// its nose (+Y) with the orbital forward axis (-Z).
export const ROCKET_FORWARD_VECTOR = Object.freeze({ x: 0, y: 0, z: -1 });
export const ROCKET_UP_VECTOR = Object.freeze({ x: 0, y: 1, z: 0 });
export const ROCKET_MODEL_ROTATION = Object.freeze({ x: -Math.PI / 2, y: 0, z: 0 });

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
      color: biome.atmosphere,
      transparent: true,
      opacity: quality.quality === "low" ? .38 : .68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  // The engines are on the model's negative local Y side, directly behind
  // the tangential travel direction after the calibration above.
  engineGlow.position.y = -.16;
  orientationNode.add(engineGlow);
  motionNode.add(orientationNode);
  orbitRoot.add(motionNode);
  parent.add(orbitRoot);
  return {
    orbitRoot,
    motionNode,
    orientationNode,
    model,
    engineGlow,
    forward: new THREE.Vector3(ROCKET_FORWARD_VECTOR.x, ROCKET_FORWARD_VECTOR.y, ROCKET_FORWARD_VECTOR.z),
    up: new THREE.Vector3(ROCKET_UP_VECTOR.x, ROCKET_UP_VECTOR.y, ROCKET_UP_VECTOR.z),
  };
}

export async function createRocketOrbit({ THREE, parent, quality, biome }) {
  const gltf = await loadGltfModel(GENESIS_ROCKET_URL);
  const model = cloneGltfScene(gltf, { cloneGeometries: true, cloneMaterials: true, cloneTextures: true });
  centerAndScaleModel(THREE, model, .24);
  return createRocketOrbitNodes({ THREE, parent, quality, biome, model });
}

export function orientRocketToOrbit(THREE, rocket, tangent, radialUp) {
  const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(rocket.forward, tangent);
  const alignedUp = rocket.up.clone()
    .applyQuaternion(forwardQuaternion);
  alignedUp.addScaledVector(
    tangent,
    -alignedUp.dot(tangent),
  ).normalize();
  const desiredUp = radialUp.clone()
    .addScaledVector(tangent, -radialUp.dot(tangent))
    .normalize();
  let rollAngle = alignedUp.angleTo(desiredUp);
  const cross = alignedUp.clone().cross(desiredUp);
  if (cross.dot(tangent) < 0) rollAngle *= -1;
  const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(tangent, rollAngle);
  rocket.motionNode.quaternion.copy(rollQuaternion.multiply(forwardQuaternion));
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
  const radialUp = current.clone().normalize();
  rocket.motionNode.position.copy(current);
  orientRocketToOrbit(THREE, rocket, tangent, radialUp);
  if (!reduceMotion && rocket.engineGlow) {
    rocket.engineGlow.scale.y = .85 + Math.sin(elapsed * 8) * .14;
  }
}
