import { smoothGenesisGeometry } from "./smoothGenesisGeometry.js";

export function compressGenesisRelief({
  THREE,
  mesh,
  planetRoot,
  baseRadius = 1,
  factor,
}) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!position || !Number.isFinite(factor)) return false;
  if (!geometry.userData.genesisOriginalPosition) {
    geometry.userData.genesisOriginalPosition = position.array.slice();
  }
  position.array.set(geometry.userData.genesisOriginalPosition);
  position.needsUpdate = true;

  mesh.updateMatrixWorld(true);
  planetRoot.updateMatrixWorld(true);
  const vertex = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    mesh.localToWorld(vertex);
    planetRoot.worldToLocal(vertex);
    const radius = vertex.length();
    if (radius > baseRadius) {
      vertex.multiplyScalar((baseRadius + (radius - baseRadius) * factor) / radius);
    }
    planetRoot.localToWorld(vertex);
    mesh.worldToLocal(vertex);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  geometry.userData.genesisReliefFactor = factor;
  geometry.computeVertexNormals();
  smoothGenesisGeometry(geometry);
  return true;
}
