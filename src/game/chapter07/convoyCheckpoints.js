
export const hasCombatRelevantEnemies = (session) => session.enemies.some((enemy) => !enemy.dead
  && enemy.countsAsCombatThreat !== false && !enemy.decorative && !enemy.removeRequested);

export function clearCheckpointTransientState(session) {
  session.mines = [];
  session.projectiles = session.projectiles.filter((projectile) => projectile.kind !== "mine");
  session.mineReservations = [];
  session.effects = session.effects.filter((effect) => !effect.transientSector);
}

export function enterCheckpointPreparation(session, events = []) {
  if (session.convoyFlow.state !== "checkpointDecision" || !session.convoyFlow.checkpointOptionChosen) return false;
  clearCheckpointTransientState(session);
  session.convoyFlow.state = "checkpointPreparation";
  session.convoyFlow.checkpointBriefingPending = false;
  session.convoyFlow.lastTransitionAt = session.elapsed;
  session.convoy.invulnerable = true;
  session.waveActive = false;
  session.preparing = true;
  session.convoyFlow.checkpointDecisionPending = false;
  events.push({ type: "checkpointPreparation", checkpointIndex: session.convoyFlow.reachedCheckpointCount - 1 });
  return true;
}

export function acknowledgeConvoyCheckpoint(session) {
  if (!session?.convoyFlow || session.convoyFlow.state !== "checkpointDecision") return false;
  session.convoyFlow.checkpointBriefingPending = false;
  return enterCheckpointPreparation(session, []);
}
