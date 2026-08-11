import { enemyBehavior } from "../enemyBehavior.js";

export const cuspidorBrasaBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    cuspidorState: "walking",
    cuspidorStateStartedAt: session.elapsed,
    cuspidorStateEndsAt: Infinity,
    cuspidorTargetId: null,
    cuspidorProjectileReleased: false,
    cuspidorAttackReadyAt: session.elapsed,
    armorDamageFactor: config.armorDamageFactor,
  }),
  update: (runtime, enemy, config, dt, events) => {
    runtime.updateCuspidorBrasa(enemy, config, dt, events);
    return true;
  },
});
