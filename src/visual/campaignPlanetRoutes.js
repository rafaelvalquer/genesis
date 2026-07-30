import { getCampaignPhaseState } from "./campaignPhaseState.js";

export function createChapterRoutes(THREE, chapter, phases, campaign, vectors) {
  const group = new THREE.Group();
  const segments = [];
  for (let index = 1; index < phases.length; index += 1) {
    const destination = phases[index];
    const state = getCampaignPhaseState(destination, campaign);
    const points = [];
    for (let step = 0; step <= 16; step += 1) {
      points.push(vectors.get(phases[index - 1].id).clone()
        .lerp(vectors.get(destination.id), step / 16).normalize().multiplyScalar(1.055));
    }
    const color = state.completed
      ? chapter.palette.primary
      : state.current ? chapter.palette.accent
        : state.accessible ? "#7192a6" : "#263847";
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({
        color, transparent: true, opacity: state.locked ? .24 : state.current ? .95 : .58,
        dashSize: state.locked ? .035 : 1, gapSize: state.locked ? .025 : 0,
      }),
    );
    line.computeLineDistances();
    line.renderOrder = 4;
    line.userData.phaseId = destination.id;
    line.userData.state = state.key;
    group.add(line);
    segments.push(line);
  }
  group.userData.segments = segments;
  return group;
}
