export function createProjectileTrail(capacity, x, y) {
  const normalizedCapacity = Math.max(1, Math.floor(capacity));
  const points = Array.from({ length: normalizedCapacity }, () => ({ x, y }));
  return { points, cursor: 1 % normalizedCapacity, length: 1, capacity: normalizedCapacity };
}

export function pushProjectileTrail(trail, x, y) {
  if (Array.isArray(trail)) {
    trail.push({ x, y });
    return;
  }
  if (!trail?.points?.length) return;
  const point = trail.points[trail.cursor];
  point.x = x;
  point.y = y;
  trail.cursor = (trail.cursor + 1) % trail.capacity;
  trail.length = Math.min(trail.capacity, trail.length + 1);
}

export function projectileTrailPoint(trail, chronologicalIndex, recentLimit = trail?.length || 0) {
  if (Array.isArray(trail)) {
    const count = Math.min(trail.length, Math.max(0, recentLimit));
    const skipped = trail.length - count;
    return chronologicalIndex >= 0 && chronologicalIndex < count
      ? trail[skipped + chronologicalIndex]
      : null;
  }
  if (!trail?.length) return null;
  const count = Math.min(trail.length, Math.max(0, recentLimit));
  if (chronologicalIndex < 0 || chronologicalIndex >= count) return null;
  const oldest = (trail.cursor - trail.length + trail.capacity) % trail.capacity;
  const skipped = trail.length - count;
  return trail.points[(oldest + skipped + chronologicalIndex) % trail.capacity];
}

export function forEachProjectileTrailPoint(trail, recentLimit, callback) {
  const count = Math.min(trail?.length || 0, Math.max(0, recentLimit));
  for (let index = 0; index < count; index += 1) {
    callback(projectileTrailPoint(trail, index, count), index, count);
  }
  return count;
}

export function projectileTrailLength(trail) {
  return trail?.length || 0;
}
