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

function initializeSession(session) {
  const phase = session?.phase;
  if (!phase) return session;

  // Preserve the exact legacy guards from createBattleSession. Convoy setup
  // remains tied to progressionMode, while forest setup remains Chapter 7-only.
  if (phase.progressionMode === "convoy") {
    session.convoy = createConvoyState(phase);
    session.convoyFlow = createConvoyFlow();
    session.convoySectorQueue = session.queue;
  }

  if (phase.chapterId === "chapter_07" && phase.forestObstacles?.enabled) {
    session.forestObstacles = generateForestObstacles(phase, session.seed);
    session.chapterSevenMetrics.forestTreesSpawned = session.forestObstacles.length;
  }

  return session;
}

/**
 * Chapter 7 battle integration boundary.
 *
 * Existing runtime functions remain the exact functions previously consumed by
 * engine.js. initializeSession only relocates the session setup that already
 * lived in createBattleSession, preserving the same guards and constructors.
 */
export const chapter07Plugin = Object.freeze({
  chapterId: "chapter_07",
  initializeSession,
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