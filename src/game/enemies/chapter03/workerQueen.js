import { enemyBehavior } from "../enemyBehavior.js";
const queenState = (session, queued, config) => queued.type === "workerQueen" ? {
  queenState: "spawn", queenStateStartedAt: session.elapsed, queenStateEndsAt: session.elapsed + config.spawnDurationMs,
  queenActionApplied: false, queenTargetId: null, queenEggsDeposited: false,
  queenNextEggLayAt: session.elapsed + config.firstEggLayDelayMs, queenWebReadyAt: session.elapsed,
  queenGuardReadyAt: session.elapsed + config.spawnDurationMs, queenGuardOwnerId: queued.queenGuardOwnerId || null,
  eggOwnerId: null, eggCreatedAt: null, eggHatchAt: Infinity,
} : { queenState: null, queenStateStartedAt: -Infinity, queenStateEndsAt: Infinity, queenActionApplied: false, queenTargetId: null, queenEggsDeposited: false, queenNextEggLayAt: Infinity, queenWebReadyAt: Infinity, queenGuardReadyAt: Infinity, queenGuardOwnerId: queued.queenGuardOwnerId || null, eggOwnerId: queued.eggOwnerId || null, eggCreatedAt: session.elapsed, eggHatchAt: session.elapsed + config.hatchAfterMs };
export const workerQueenBehavior = enemyBehavior({ createState: queenState, update: (runtime, enemy, config, dt, events) => (runtime.updateWorkerQueen(enemy, config, dt, events), true) });
export const workerQueenEggBehavior = enemyBehavior({ createState: queenState, update: (runtime, enemy, config, dt, events) => (runtime.updateWorkerQueenEgg(enemy, config, events), true) });
