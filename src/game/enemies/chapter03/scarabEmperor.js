import { enemyBehavior } from "../enemyBehavior.js";
export const scarabEmperorBehavior = enemyBehavior({
  createState: (session, queued) => ({ scarabState: "phase1Walking", scarabStateStartedAt: session.elapsed, scarabStateEndsAt: Infinity, scarabPhase2Triggered: false, scarabPhase3Triggered: false, scarabTransitionToPhase: null, scarabAttackApplied: false, scarabAttackTargetId: null }),
  update: (runtime, enemy, config, dt, events) => (runtime.updateScarabEmperor(enemy, config, dt, events), true),
});
