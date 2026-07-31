import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  getCommandGlobeZoomPercent,
  getPointerPinchDistance,
  initializeCommandGlobeZoom,
  normalizeCommandWheelDelta,
  resetCommandGlobeZoom,
  setCommandGlobeZoomDistance,
  zoomCommandGlobeBy,
} from "./commandGlobeZoom.js";

function createRuntime(distance = 5.2) {
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, 0, distance);
  camera.updateProjectionMatrix = vi.fn();

  return { camera };
}

describe("zoom orbital da tela Comando", () => {
  it("inicializa, aproxima, afasta e restaura o zoom", () => {
    const runtime = createRuntime();

    const limits = initializeCommandGlobeZoom(runtime);
    expect(limits.defaultDistance).toBeCloseTo(5.2);

    const closer = zoomCommandGlobeBy(runtime, -1);
    expect(closer).toBeCloseTo(4.2);
    expect(getCommandGlobeZoomPercent(runtime)).toBeGreaterThan(100);

    const farther = zoomCommandGlobeBy(runtime, 2);
    expect(farther).toBeCloseTo(6.2);
    expect(getCommandGlobeZoomPercent(runtime)).toBeLessThan(100);

    resetCommandGlobeZoom(runtime);
    expect(runtime.camera.position.length()).toBeCloseTo(5.2);
    expect(getCommandGlobeZoomPercent(runtime)).toBe(100);
  });

  it("respeita os limites mínimo e máximo", () => {
    const runtime = createRuntime();
    initializeCommandGlobeZoom(runtime);

    setCommandGlobeZoomDistance(runtime, -100);
    expect(runtime.camera.position.length()).toBeCloseTo(
      runtime.zoomMinDistance,
    );

    setCommandGlobeZoomDistance(runtime, 100);
    expect(runtime.camera.position.length()).toBeCloseTo(
      runtime.zoomMaxDistance,
    );
  });

  it("normaliza roda e calcula distância da pinça", () => {
    expect(normalizeCommandWheelDelta(2, 0)).toBe(2);
    expect(normalizeCommandWheelDelta(2, 1)).toBe(32);
    expect(normalizeCommandWheelDelta(2, 2)).toBe(240);

    const pointers = new Map([
      [1, { x: 10, y: 20 }],
      [2, { x: 40, y: 60 }],
    ]);

    expect(getPointerPinchDistance(pointers)).toBe(50);
  });
});
