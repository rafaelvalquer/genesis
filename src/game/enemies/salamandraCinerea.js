import { enemyBehavior } from "./enemyBehavior.js";

export const salamandraCinereaBehavior = enemyBehavior({
  createState: (session, queued, config) => ({
    salamandraChargeAvailableAt: session.elapsed + config.charge.delayAfterSpawnMs,
    salamandraNextChargeAt: session.elapsed + config.charge.delayAfterSpawnMs + Math.floor(session.rng() * 1500),
    salamandraChargeUntil: 0,
    salamandraCharges: 0,
  }),
  update: (runtime, enemy, config, dt, events) => (runtime.updateSalamandra(enemy, config, dt, events), true),
});
