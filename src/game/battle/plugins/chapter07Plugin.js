import { createConvoyFlow, createConvoyState } from "../../chapter07/convoyState.js";
import { updateConvoyEnergy } from "../../chapter07/convoyEnergy.js";
import { advanceConvoyTransit, completeConvoySector, startConvoySector } from "../../chapter07/convoyFlow.js";
import { enterCheckpointPreparation, hasCombatRelevantEnemies } from "../../chapter07/convoyCheckpoints.js";
import { applyConvoyCheckpointOption } from "../../chapter07/convoyCheckpointRewards.js";
import { updateConvoyReinforcements } from "../../chapter07/convoySpawnDirector.js";
import { canEnemyReachConvoy, hasBlockingTroop, updateConvoyThreat } from "../../chapter07/convoyTargeting.js";
import { damageConvoy } from "../../chapter07/convoyDamage.js";
import { commitPersistentBite, getPersistentBiteMultiplier, resetPersistentBite } from "../../chapter07/persistentBite.js";
import { updateSaltadorAlado } from "../../chapter07/saltadorAlado.js";
import { updateSporeField } from "../../chapter07/sporeField.js";
import { repositionTroop as repositionConvoyTroop } from "../../chapter07/convoyReposition.js";
import { calculateConvoyStars } from "../../chapter07/convoyScoring.js";
import { updateConvoyAnimation } from "../../chapter07/convoyAnimation.js";
import { CONVOY_DEFEAT_RESULT_DELAY_MS } from "../../chapter07/convoyAnimationConfig.js";
import { getVertebralToxinAttackSpeedFactor } from "../../chapter07/vertebralToxin.js";
import { generateForestObstacles } from "../../chapter07/forestObstacleGeneration.js";
import { damageForestObstacle, destroyForestObstacle } from "../../chapter07/forestObstacleSystem.js";
import {
  getBlockingForestObstacle,
  getForestObstacleAt,
  getForestObstacleHitPoint,
  getNearestTargetableForestObstacle,
  resolveForestCombatTarget,
} from "../../chapter07/forestObstacleTargeting.js";
import { findFirstForestObstacleCollision } from "../../chapter07/forestObstacleCollision.js";

/**
 * Chapter 7 battle integration boundary.
 *
 * This object intentionally exposes the exact runtime functions that engine.js
 * already consumed. It does not wrap, transform or reorder calls, so moving the
 * dependency behind the registry cannot alter combat mechanics or timing.
 */
export const chapter07Plugin = Object.freeze({
  chapterId: "chapter_07",
  createConvoyFlow,
  createConvoyState,
  updateConvoyEnergy,
  advanceConvoyTransit,
  completeConvoySector,
  startConvoySector,
  hasCombatRelevantEnemies,
  enterCheckpointPreparation,
  applyConvoyCheckpointOption,
  updateConvoyReinforcements,
  canEnemyReachConvoy,
  hasBlockingTroop,
  updateConvoyThreat,
  damageConvoy,
  getPersistentBiteMultiplier,
  commitPersistentBite,
  resetPersistentBite,
  updateSaltadorAlado,
  updateSporeField,
  repositionConvoyTroop,
  calculateConvoyStars,
  updateConvoyAnimation,
  CONVOY_DEFEAT_RESULT_DELAY_MS,
  getVertebralToxinAttackSpeedFactor,
  generateForestObstacles,
  damageForestObstacle,
  destroyForestObstacle,
  getBlockingForestObstacle,
  getForestObstacleAt,
  getForestObstacleHitPoint,
  getNearestTargetableForestObstacle,
  resolveForestCombatTarget,
  findFirstForestObstacleCollision,
});
