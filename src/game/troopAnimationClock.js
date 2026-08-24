export const TROOP_ANIMATION_PLANNING_STATES = Object.freeze([
  "initialPreparation",
  "checkpointPreparation",
  "checkpointDecision",
  "sectorCountdown",
  "convoyEntry",
]);

export function isTroopAnimationPlanningState(session) {
  return session?.phase?.progressionMode === "convoy"
    && TROOP_ANIMATION_PLANNING_STATES.includes(session.convoyFlow?.state);
}

export function advanceTroopAnimationClock(clock, session, now) {
  const planning = isTroopAnimationPlanningState(session);
  if (!clock || clock.session !== session) {
    if (clock) Object.assign(clock, { session, elapsed: session?.elapsed || 0, lastNow: now, planning });
    return session?.elapsed || 0;
  }
  if (!planning) clock.elapsed = session.elapsed;
  else if (!clock.planning) clock.elapsed = session.elapsed;
  else clock.elapsed += Math.min(100, Math.max(0, now - clock.lastNow));
  clock.lastNow = now;
  clock.planning = planning;
  return clock.elapsed;
}
