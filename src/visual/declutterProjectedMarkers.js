export function getProjectedMarkerPriority(marker) {
  if (marker.current) return 100;
  if (marker.selected) return 90;
  if (marker.boss && marker.accessible) return 80;
  if (marker.accessible) return 60;
  if (marker.completed) return 50;
  return 10;
}

export function declutterProjectedMarkers(
  projectedMarkers,
  { minimumDistance = 36 } = {},
) {
  const accepted = [];
  const visible = new Set();
  [...projectedMarkers]
    .sort((left, right) => right.priority - left.priority)
    .forEach((marker) => {
      const protectedMarker = marker.current || marker.selected;
      const collides = accepted.some((acceptedMarker) => (
        Math.hypot(marker.x - acceptedMarker.x, marker.y - acceptedMarker.y) < minimumDistance
      ));
      if (protectedMarker || !collides) {
        accepted.push(marker);
        visible.add(marker.id);
      }
    });
  return visible;
}
