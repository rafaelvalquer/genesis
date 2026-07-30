export const GENESIS_PLANET_MODEL_ORIENTATION = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

export function applyGenesisPlanetOrientation(root) {
  root.rotation.set(
    GENESIS_PLANET_MODEL_ORIENTATION.x,
    GENESIS_PLANET_MODEL_ORIENTATION.y,
    GENESIS_PLANET_MODEL_ORIENTATION.z,
  );
  return root;
}
