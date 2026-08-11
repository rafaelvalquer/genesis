import { enemyBehavior } from "../enemyBehavior.js";

export const predadorCaldeiraBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    predatorState: "walking",
    predatorStateStartedAt: session.elapsed,
    predatorStateEndsAt: Infinity,
    predatorTargetId: null,
    predatorClawApplied: false,
    predatorBiteApplied: false,
    predatorFrenzyTriggered: false,
    predatorFrenzyPending: false,
    predatorFrenzy: false,
    armorDamageFactor: config.armorDamageFactor,
  }),
  update: (runtime, enemy, config, dt, events) => {
    runtime.updatePredadorCaldeira(enemy, config, dt, events);
    return true;
  },
});
