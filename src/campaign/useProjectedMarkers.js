import { useCallback, useRef } from "react";
import { declutterProjectedMarkers } from "../visual/declutterProjectedMarkers.js";

export function useProjectedMarkers() {
  const markerRefs = useRef(new Map());

  const registerMarker = useCallback((phaseId, node) => {
    if (node) markerRefs.current.set(phaseId, node);
    else markerRefs.current.delete(phaseId);
  }, []);

  const projectMarkers = useCallback((runtime) => {
    const {
      THREE, camera, planetGroup, planetReferenceFrame, markerReferenceRoot,
      markerVectors, width, height, tempVector,
      planetCenter, cameraPosition, surfaceNormal, cameraDirection,
    } = runtime;
    (planetReferenceFrame || planetGroup).getWorldPosition(planetCenter);
    camera.getWorldPosition(cameraPosition);
    const projectedMarkers = [];
    for (const [phaseId, node] of markerRefs.current) {
      const local = markerVectors.get(phaseId);
      if (!local) {
        node.hidden = true;
        continue;
      }
      tempVector.copy(local);
      (markerReferenceRoot || planetGroup).localToWorld(tempVector);
      surfaceNormal.copy(tempVector).sub(planetCenter).normalize();
      cameraDirection.copy(cameraPosition).sub(tempVector).normalize();
      const visible = surfaceNormal.dot(cameraDirection) > .05;
      tempVector.project(camera);
      const onScreen = visible && Math.abs(tempVector.x) < 1.12 && Math.abs(tempVector.y) < 1.12;
      if (onScreen) {
        const x = (tempVector.x * .5 + .5) * width;
        const y = (-tempVector.y * .5 + .5) * height;
        node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        projectedMarkers.push({
          id: phaseId,
          x,
          y,
          priority: Number(node.dataset.markerPriority || 10),
          current: node.dataset.markerCurrent === "true",
          selected: node.dataset.markerSelected === "true",
        });
      }
      node.dataset.projectable = onScreen ? "true" : "false";
    }
    const visibleMarkerIds = declutterProjectedMarkers(projectedMarkers);
    for (const [phaseId, node] of markerRefs.current) {
      const onScreen = node.dataset.projectable === "true" && visibleMarkerIds.has(phaseId);
      node.hidden = !onScreen;
      node.style.visibility = onScreen ? "visible" : "hidden";
      node.style.pointerEvents = onScreen ? "" : "none";
    }
  }, []);

  return { markerRefs, registerMarker, projectMarkers };
}
