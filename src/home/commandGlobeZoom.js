export const COMMAND_GLOBE_ZOOM = Object.freeze({
  absoluteMinimum: 2.2,
  minimumRatio: .52,
  maximumRatio: 1.45,
  absoluteMaximum: 7.2,
});

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function initializeCommandGlobeZoom(runtime) {
  if (!runtime?.camera?.position) return null;

  const currentDistance = Math.max(
    .001,
    finiteOr(runtime.camera.position.length(), 5),
  );

  runtime.defaultZoomDistance = currentDistance;
  runtime.zoomMinDistance = Math.max(
    COMMAND_GLOBE_ZOOM.absoluteMinimum,
    Math.min(3, currentDistance * COMMAND_GLOBE_ZOOM.minimumRatio),
  );
  runtime.zoomMaxDistance = Math.max(
    COMMAND_GLOBE_ZOOM.absoluteMaximum,
    currentDistance * COMMAND_GLOBE_ZOOM.maximumRatio,
  );
  runtime.zoomDistance = currentDistance;

  return {
    defaultDistance: runtime.defaultZoomDistance,
    minimumDistance: runtime.zoomMinDistance,
    maximumDistance: runtime.zoomMaxDistance,
  };
}

export function setCommandGlobeZoomDistance(runtime, requestedDistance) {
  if (!runtime?.camera?.position) return null;

  if (!Number.isFinite(runtime.defaultZoomDistance)) {
    initializeCommandGlobeZoom(runtime);
  }

  const minimum = finiteOr(
    runtime.zoomMinDistance,
    COMMAND_GLOBE_ZOOM.absoluteMinimum,
  );
  const maximum = finiteOr(
    runtime.zoomMaxDistance,
    COMMAND_GLOBE_ZOOM.absoluteMaximum,
  );
  const current = finiteOr(
    runtime.camera.position.length(),
    runtime.defaultZoomDistance,
  );
  const requested = finiteOr(requestedDistance, current);
  const nextDistance = Math.min(maximum, Math.max(minimum, requested));

  runtime.camera.position.setLength(nextDistance);
  runtime.camera.lookAt?.(0, 0, 0);
  runtime.camera.updateProjectionMatrix?.();
  runtime.zoomDistance = nextDistance;
  runtime.cameraBaseDistance = nextDistance;

  return nextDistance;
}

export function zoomCommandGlobeBy(runtime, distanceDelta) {
  if (!runtime?.camera?.position) return null;

  const current = finiteOr(
    runtime.camera.position.length(),
    runtime.defaultZoomDistance || 5,
  );

  return setCommandGlobeZoomDistance(
    runtime,
    current + finiteOr(distanceDelta, 0),
  );
}

export function resetCommandGlobeZoom(runtime) {
  if (!runtime) return null;

  return setCommandGlobeZoomDistance(
    runtime,
    finiteOr(runtime.defaultZoomDistance, 5),
  );
}

export function getCommandGlobeZoomPercent(runtime) {
  if (!runtime?.camera?.position) return 100;

  const defaultDistance = Math.max(
    .001,
    finiteOr(
      runtime.defaultZoomDistance,
      runtime.camera.position.length(),
    ),
  );
  const currentDistance = Math.max(
    .001,
    finiteOr(runtime.camera.position.length(), defaultDistance),
  );

  return Math.round(
    Math.min(220, Math.max(50, defaultDistance / currentDistance * 100)),
  );
}

export function normalizeCommandWheelDelta(deltaY, deltaMode = 0) {
  const multiplier = deltaMode === 1
    ? 16
    : deltaMode === 2
      ? 120
      : 1;

  return finiteOr(deltaY, 0) * multiplier;
}

export function getPointerPinchDistance(pointerMap) {
  const points = [...(pointerMap?.values?.() || [])];
  if (points.length < 2) return null;

  const [first, second] = points;
  const dx = finiteOr(second.x, 0) - finiteOr(first.x, 0);
  const dy = finiteOr(second.y, 0) - finiteOr(first.y, 0);

  return Math.hypot(dx, dy);
}
