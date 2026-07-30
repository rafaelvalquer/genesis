export function normalizeModelToRadius(THREE, model, targetRadius, referenceName) {
  model.updateMatrixWorld(true);
  const reference = referenceName ? model.getObjectByName(referenceName) : model;
  if (!reference) throw new Error(`Referência GLB ausente: ${referenceName}`);
  const sphere = new THREE.Box3().setFromObject(reference).getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error("Modelo GLB sem volume válido");
  const scale = targetRadius / sphere.radius;
  const localCenter = sphere.center.clone().sub(model.position);
  model.scale.multiplyScalar(scale);
  model.position.copy(localCenter).multiplyScalar(-scale);
  model.updateMatrixWorld(true);
  return { reference, center: sphere.center, radius: sphere.radius, scale };
}

export function centerAndScaleModel(THREE, model, targetSize) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const scale = targetSize / Math.max(largest, .0001);
  const localCenter = center.clone().sub(model.position);
  model.scale.multiplyScalar(scale);
  model.position.copy(localCenter).multiplyScalar(-scale);
  return { center, size, scale };
}
