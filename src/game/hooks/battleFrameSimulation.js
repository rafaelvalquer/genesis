export const BATTLE_SIMULATION_STEP_MS = 32;

/**
 * Advances fixed simulation steps while keeping the frame accumulator separate
 * from rendering. The caller remains responsible for processing each step's
 * events in order.
 */
export function advanceBattleSimulation({
  accumulator,
  cinematicFactor = 1,
  fortunePaused = false,
  frameDelta,
  onStep,
  outroFactor = 1,
  paused = false,
  speed = 1,
  stepMs = BATTLE_SIMULATION_STEP_MS,
}) {
  let nextAccumulator = accumulator;
  if (!paused && !fortunePaused) {
    const battleSpeed = outroFactor < 1 ? outroFactor : speed;
    nextAccumulator += frameDelta * battleSpeed * cinematicFactor;
  }
  while (nextAccumulator >= stepMs) {
    onStep(stepMs);
    nextAccumulator -= stepMs;
  }
  return nextAccumulator;
}
