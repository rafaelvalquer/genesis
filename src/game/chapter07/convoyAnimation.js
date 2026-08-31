import { CONVOY_ANIMATION_CONFIG, CONVOY_ENERGY_SPAWN_DURATION_MS } from "./convoyAnimationConfig.js";

export function getDesiredConvoyAnimationState(session) {
  return session?.convoy ? "idle" : "idle";
}

export function triggerConvoyEnergySpawn(convoy, now = 0) {
  if (!convoy) return null;
  convoy.animation = { state: "energy_spawn", startedAt: now };
  return convoy.animation;
}

export function updateConvoyAnimation(session) {
  const convoy = session?.convoy;
  if (!convoy) return null;
  const animation = convoy.animation || (convoy.animation = { state: "idle", startedAt: session.elapsed || 0 });
  if (animation.state === "energy_spawn" && session.elapsed - animation.startedAt >= CONVOY_ENERGY_SPAWN_DURATION_MS) {
    animation.state = "idle";
    animation.startedAt = session.elapsed;
  }
  return animation;
}

export function resolveConvoyAnimationFrame(state, elapsed, frameCount = CONVOY_ANIMATION_CONFIG[state]?.frames) {
  const config = CONVOY_ANIMATION_CONFIG[state] || CONVOY_ANIMATION_CONFIG.idle;
  const index = Math.floor(Math.max(0, elapsed) / config.frameDuration);
  return config.loop ? index % Math.max(1, frameCount) : Math.min(Math.max(0, frameCount - 1), index);
}
