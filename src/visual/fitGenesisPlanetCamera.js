export function getGenesisPlanetCameraDistance({
  radius = 1,
  verticalFov = 38,
  aspect = 1,
  padding = 1.25,
}) {
  const verticalHalfFov = verticalFov * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(.01, aspect));
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  return radius * padding / Math.max(.01, Math.sin(limitingHalfFov));
}

export function fitGenesisPlanetCamera({
  camera,
  radius = 1,
  verticalFov = camera.fov,
  aspect = camera.aspect,
  padding = 1.25,
}) {
  const distance = getGenesisPlanetCameraDistance({
    radius, verticalFov, aspect, padding,
  });
  camera.position.z = distance;
  camera.updateProjectionMatrix();
  return distance;
}
