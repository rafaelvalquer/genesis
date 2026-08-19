export function getCuratedRootPlacement({ bounds, sourceRoot, targetRoot, preferredScale, canvasSize = 768, margin = 8 }) {
  const limits = [preferredScale];
  if (bounds.minX < sourceRoot.x) limits.push((targetRoot.x - margin) / (sourceRoot.x - bounds.minX));
  if (bounds.maxX > sourceRoot.x) limits.push((canvasSize - margin - targetRoot.x) / (bounds.maxX - sourceRoot.x));
  if (bounds.minY < sourceRoot.y) limits.push((targetRoot.y - margin) / (sourceRoot.y - bounds.minY));
  if (bounds.maxY > sourceRoot.y) limits.push((canvasSize - margin - targetRoot.y) / (bounds.maxY - sourceRoot.y));
  const scale = Math.max(.01, Math.min(...limits));
  return {
    scale,
    project(point) { return { x: targetRoot.x + (point.x - sourceRoot.x) * scale, y: targetRoot.y + (point.y - sourceRoot.y) * scale }; },
  };
}
