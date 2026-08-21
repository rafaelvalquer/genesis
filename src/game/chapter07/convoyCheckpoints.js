import { getConvoyXForProgress } from "./convoyGeometry.js";
import { refillConvoyReserve } from "./convoyEnergy.js";
import { cancelConvoySectorSpawns } from "./convoySpawnDirector.js";

export const hasCombatRelevantEnemies = (session) => session.enemies.some((enemy) => !enemy.dead
  && enemy.countsAsCombatThreat !== false && !enemy.decorative && !enemy.removeRequested);

export function enterCheckpointClearing(session, checkpointIndex, events = []) {
  if (checkpointIndex < session.convoyFlow.reachedCheckpointCount) return false;
  session.convoyFlow.state = "checkpointClearing";
  session.convoyFlow.reachedCheckpointCount = checkpointIndex + 1;
  session.convoyFlow.checkpointStartedAt = session.elapsed;
  session.convoyFlow.lastTransitionAt = session.elapsed;
  session.convoy.x = getConvoyXForProgress(session.phase.convoy.checkpointProgress[checkpointIndex]);
  session.convoy.progress = session.phase.convoy.checkpointProgress[checkpointIndex];
  session.convoy.invulnerable = true;
  session.convoy.underAttack = false;
  session.convoy.attackerIds = [];
  cancelConvoySectorSpawns(session);
  events.push({ type: "checkpointReached", checkpointIndex, x: session.convoy.x });
  return true;
}

export function clearCheckpointTransientState(session) {
  session.mines = [];
  session.projectiles = session.projectiles.filter((projectile) => projectile.kind !== "mine");
  session.mineReservations = [];
  session.effects = session.effects.filter((effect) => !effect.transientSector);
}

export function enterCheckpointPreparation(session, events = []) {
  if (session.convoyFlow.state !== "checkpointClearing" || hasCombatRelevantEnemies(session)) return false;
  clearCheckpointTransientState(session);
  refillConvoyReserve(session, session.convoyFlow.reachedCheckpointCount - 1, events);
  session.convoyFlow.state = "checkpointPreparation";
  session.convoyFlow.lastTransitionAt = session.elapsed;
  session.convoy.invulnerable = true;
  session.waveActive = false;
  session.preparing = true;
  events.push({ type: "checkpointPreparation", checkpointIndex: session.convoyFlow.reachedCheckpointCount - 1 });
  return true;
}
