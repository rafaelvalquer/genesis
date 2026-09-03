import { useEffect, useRef } from "react";

/** Small non-React primitive used when a frame loop needs local setup state. */
export function createBattleAnimationScheduler() {
  let animationId = 0;
  return {
    request(frame) {
      animationId = requestAnimationFrame(frame);
      return animationId;
    },
    stop() {
      if (animationId) cancelAnimationFrame(animationId);
      animationId = 0;
    },
  };
}

/**
 * Owns only requestAnimationFrame lifecycle. Simulation and drawing are
 * supplied by the controller and renderer respectively.
 */
export function useBattleRenderLoop({ enabled, onFrame }) {
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return undefined;
    const scheduler = createBattleAnimationScheduler();
    const loop = (now) => {
      frameRef.current?.(now);
      scheduler.request(loop);
    };
    scheduler.request(loop);
    return () => scheduler.stop();
  }, [enabled]);
}

export default useBattleRenderLoop;
