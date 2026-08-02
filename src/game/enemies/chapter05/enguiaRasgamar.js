import { CELL, FIELD } from "../../visualGeometry.js";
import { enemyBehavior } from "../enemyBehavior.js";
export const enguiaRasgamarBehavior = enemyBehavior({
  createState: (session, queued, config) => ({ rasgamarState: "spawnSubmerged", rasgamarStateStartedAt: session.elapsed, rasgamarStateEndsAt: session.elapsed + config.submergedSpawnMs, rasgamarTargetId: null, rasgamarTargetX: null, rasgamarPulseIndexes: [], rasgamarNextActionAt: session.elapsed + config.submergedSpawnMs, rasgamarNextExposureAt: session.elapsed + config.idleSurfaceExposureEveryMs, rasgamarSubmerged: true, rasgamarPatrolCol: null }),
  onSpawn: (session, enemy) => { enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2; enemy.previousRenderX = enemy.x; enemy.moving = false; },
  update: (runtime, enemy, config, dt, events) => (runtime.updateRasgamar(enemy, config, dt, events), true),
});
