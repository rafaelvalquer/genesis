import { CELL, FIELD } from "../../visualGeometry.js";
import { enemyBehavior } from "../enemyBehavior.js";

export const colossoCaldeiraBehavior = enemyBehavior({
  createState: (session, queued, config) => ({
    colossoState: "spawnAwakening", colossoStateStartedAt: session.elapsed,
    colossoStateEndsAt: session.elapsed + config.spawnDurationMs, colossoPhase: 1, colossoPendingPhase: null,
    colossoTargetable: false, targetableRows: [], hitZones: [], colossoPreviousAttack: null,
    colossoQueuedAttack: null, colossoNextDecisionAt: session.elapsed + config.spawnDurationMs + 1100,
    colossoAttackReadyAt: session.elapsed + config.spawnDurationMs + 1100,
    colossoAttackApplied: false, colossoRecentRows: [], colossoRecentCells: [], colossoRecentAttackSequence: [], colossoRifts: [], colossoRiftSpawnCounts: { 1: 0, 2: 0, 3: 0 }, colossoTargetCells: [], colossoRiftTarget: null, colossoImpactQueue: [], colossoCollapseRows: [], colossoCollapseIndex: 0,
    colossoFinalCollapseUsed: false, colossoDying: false,
  }),
  onSpawn: (session, enemy, config) => {
    enemy.row = config.bossAnchorRow; enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2;
    enemy.y = enemy.row * CELL.height + CELL.height / 2; enemy.previousRenderX = enemy.x; enemy.previousRenderY = enemy.y;
    enemy.moving = false;
  },
  update: (runtime, enemy, config, dt, events) => (runtime.updateColossoCaldeira(enemy, config, events), true),
});
