import { useCallback, useRef } from "react";

export function useProjectedMarkers() {
  const markerRefs = useRef(new Map());

  const registerMarker = useCallback((phaseId, node) => {
    if (node) markerRefs.current.set(phaseId, node);
    else markerRefs.current.delete(phaseId);
  }, []);

  const projectMarkers = useCallback((runtime) => {
    const { THREE, camera, planetGroup, markerVectors, width, height, tempVector, cameraNormal } = runtime;
    cameraNormal.copy(camera.position).normalize();
    for (const [phaseId, node] of markerRefs.current) {
      const local = markerVectors.get(phaseId);
      if (!local) {
        node.hidden = true;
        continue;
      }
      tempVector.copy(local);
      planetGroup.localToWorld(tempVector);
      const visible = tempVector.dot(cameraNormal) / Math.max(.0001, tempVector.length()) > 0.08;
      tempVector.project(camera);
      const onScreen = visible && Math.abs(tempVector.x) < 1.12 && Math.abs(tempVector.y) < 1.12;
      node.hidden = !onScreen;
      if (onScreen) {
        node.style.transform = `translate3d(${(tempVector.x * .5 + .5) * width}px, ${(-tempVector.y * .5 + .5) * height}px, 0) translate(-50%, -50%)`;
      }
    }
  }, []);

  return { markerRefs, registerMarker, projectMarkers };
}
