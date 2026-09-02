export function resolveIcaroVisual(troop, config = {}, options = {}) {
  const state = options.state || troop?.state;
  const direction = options.direction || (state === "interceptionFire" ? troop?.interceptionAimDirection : null);
  if (options.direction === "up" || (state === "interceptionFire" && direction === "up")) {
    return config.interceptionFireUpVisual || config.interceptionFireVisual;
  }
  if (options.direction === "down" || (state === "interceptionFire" && direction === "down")) {
    return config.interceptionFireDownVisual || config.interceptionFireVisual;
  }
  if (state === "interceptionFire") return config.interceptionFireVisual;
  if (state === "interceptionLock") return config.interceptionLockVisual;
  if (state === "paralyzed") return config.paralyzedVisual;
  if (state === "idle") return config.idleVisual;
  return config.attackVisual;
}

export function getActiveIcaroInterceptionShot(troop, elapsed, config = {}) {
  const plan = troop?.icaroInterceptionShotPlan || [];
  if (!plan.length) return null;
  const visual = config.interceptionFireVisual || {};
  const startedAt = Number.isFinite(troop.interceptionFireStartedAt)
    ? troop.interceptionFireStartedAt
    : troop.stateStartedAt || 0;
  const shot = [...plan].reverse().find((entry) => {
    const definition = visual.shots?.[entry.shotIndex];
    return elapsed - startedAt >= Number(definition?.atMs ?? entry.shotIndex * 80);
  }) || plan[0];
  const definition = visual.shots?.[shot.shotIndex];
  return {
    targetId: shot.targetId,
    shotIndex: shot.shotIndex,
    direction: shot.direction || "forward",
    shotAgeMs: Math.max(0, elapsed - startedAt - Number(definition?.atMs ?? shot.shotIndex * 80)),
  };
}

export function getVisualShotTime(visual = {}, shotIndex = 0) {
  const shot = visual.shots?.[shotIndex];
  if (!shot) return 0;
  if (Number.isFinite(shot.atMs)) return shot.atMs;
  return Number(visual.timeline?.find((entry) => entry.frame === shot.frame)?.atMs || 0);
}

export function resolveIcaroAnimation(troop, config = {}, elapsed = 0, frameCounts = {}) {
  const paralyzed = elapsed < Number(troop?.electricParalyzedUntil || 0);
  let state = paralyzed ? "paralyzed" : troop?.state || "idle";
  let direction = null;
  if (!paralyzed && state === "interceptionFire") {
    const active = getActiveIcaroInterceptionShot(troop, elapsed, config);
    direction = active?.direction || troop.interceptionAimDirection || "forward";
    state = direction === "up" ? "interceptionFireUp" : direction === "down" ? "interceptionFireDown" : "interceptionFire";
  }
  const visual = state === "paralyzed" ? config.paralyzedVisual
    : state === "interceptionLock" ? config.interceptionLockVisual
      : state === "interceptionFireUp" ? config.interceptionFireUpVisual
        : state === "interceptionFireDown" ? config.interceptionFireDownVisual
          : state === "interceptionFire" ? config.interceptionFireVisual
            : state === "attackBurst" ? config.attackVisual : config.idleVisual;
  const count = Math.max(1, frameCounts[state] || frameCounts.idle || 1);
  const duration = Math.max(1, visual?.durationMs || 800);
  const age = Math.max(0, elapsed - (paralyzed ? 0 : (troop.stateStartedAt || 0)));
  const timeline = visual?.timeline;
  const timelineFrame = timeline?.length
    ? [...timeline].reverse().find((entry) => age >= Number(entry.atMs || 0))?.frame ?? 0
    : null;
  const result = { state, frame: timelineFrame == null
    ? (state === "idle" || paralyzed ? Math.floor(age / (duration / count)) % count : Math.min(count - 1, Math.floor(age / (duration / count))))
    : Math.min(count - 1, Math.max(0, timelineFrame)) };
  if (direction) result.direction = direction;
  return result;
}
