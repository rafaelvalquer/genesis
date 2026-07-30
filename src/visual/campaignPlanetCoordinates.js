import { CAMPAIGN_PHASE_LOCATIONS, latLonToCartesian } from "../campaign/campaignSceneData.js";

export { CAMPAIGN_PHASE_LOCATIONS, latLonToCartesian };

export function getTargetRotationForPhase(phaseId) {
  const location = CAMPAIGN_PHASE_LOCATIONS[phaseId];
  if (!location) return { x: 0, y: 0, z: 0 };
  const point = latLonToCartesian(location.latitude, location.longitude, 1);
  return {
    x: Math.atan2(point.y, Math.hypot(point.x, point.z)),
    y: Math.atan2(-point.x, point.z),
    z: 0,
  };
}

export function createChapterPhaseVectors(THREE, chapter, radius = 1.04) {
  return new Map(chapter.phaseIds.map((phaseId) => {
    const location = CAMPAIGN_PHASE_LOCATIONS[phaseId];
    const point = latLonToCartesian(location.latitude, location.longitude, radius + location.elevation * .1);
    return [phaseId, new THREE.Vector3(point.x, point.y, point.z)];
  }));
}
