export function smoothGenesisGeometry(
  geometry,
  { computeNormals = true, normalizeNormals = true } = {},
) {
  if (!geometry) return geometry;
  if (!geometry.getAttribute("normal") && computeNormals) geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  if (normalizeNormals && normals) {
    geometry.normalizeNormals();
    normals.needsUpdate = true;
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.genesisSmoothed = true;
  return geometry;
}
