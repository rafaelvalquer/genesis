import { CONVOY_ANIMATION_CONFIG, CONVOY_DESTROYED_TRANSITION_MS } from "./convoyAnimationConfig.js";

export function getDesiredConvoyAnimationState(session) {
  const convoy = session?.convoy;
  if (!convoy) return "idle";
  if (convoy.hp <= 0) return "destroyed_transition";
  return session?.convoyFlow?.state === "convoyTransit" ? "run" : "idle";
}

export function updateConvoyAnimation(session) {
  const convoy = session?.convoy;
  if (!convoy) return null;
  const animation = convoy.animation || (convoy.animation = { state: "idle", startedAt: session.elapsed || 0, previousState: null });
  const desired = getDesiredConvoyAnimationState(session);
  if (animation.state === "destroyed_transition" && (session.elapsed - animation.startedAt) >= CONVOY_DESTROYED_TRANSITION_MS) {
    animation.previousState = animation.state; animation.state = "destroyed_loop"; animation.startedAt = session.elapsed;
  } else if (animation.state !== "destroyed_loop" && animation.state !== desired) {
    animation.previousState = animation.state; animation.state = desired; animation.startedAt = session.elapsed;
    if (desired === "destroyed_transition") convoy.destroyedAt ??= session.elapsed;
  }
  return animation;
}

export function resolveConvoyAnimationFrame(state, elapsed, frameCount = CONVOY_ANIMATION_CONFIG[state]?.frames) {
  const config = CONVOY_ANIMATION_CONFIG[state] || CONVOY_ANIMATION_CONFIG.idle;
  const index = Math.floor(Math.max(0, elapsed) / config.frameDuration);
  return config.loop ? index % Math.max(1, frameCount) : Math.min(Math.max(0, frameCount - 1), index);
}
