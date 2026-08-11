import { enemyBehavior } from "../enemyBehavior.js";

export const vermeIncubadorBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    incubatorState: "crawl",
    incubatorStateStartedAt: session.elapsed,
    incubatorStateEndsAt: Infinity,
    incubatorSubmerged: false,
    incubatorOriginRow: null,
    incubatorOriginX: null,
    incubatorOriginY: null,
    incubatorTargetTroopId: null,
    incubatorTargetRow: null,
    incubatorTargetCol: null,
    incubatorTargetX: null,
    incubatorTargetY: null,
    incubatorReturning: false,
    incubationImpactApplied: false,
    nextIncubationAt: session.elapsed + config.incubationInitialDelayMs,
    incubatorRecentTargets: {},
  }),
  update: (runtime, enemy, config, dt, events) => {
    runtime.updateVermeIncubador(enemy, config, dt, events);
    return true;
  },
});
