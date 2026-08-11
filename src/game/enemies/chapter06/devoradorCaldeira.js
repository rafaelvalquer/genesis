import { enemyBehavior } from "../enemyBehavior.js";

export const devoradorCaldeiraBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    devoradorState: "walking",
    devoradorStateStartedAt: session.elapsed,
    devoradorStateEndsAt: Infinity,
    devoradorTargetId: null,
    devoradorImpactApplied: false,
    devoradorCrushing: false,
    devoradorSuccessfulBites: 0,
    devoradorFrenzyTriggered: false,
    devoradorFrenzy: false,
    devoradorFrenzyPending: false,
    armorDamageFactor: config.armorDamageFactor,
  }),
  update: (runtime, enemy, config, dt, events) => {
    runtime.updateDevorador(enemy, config, dt, events);
    return true;
  },
});
