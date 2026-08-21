import { getConvoyProgress } from "./convoyGeometry.js";
import { enterCheckpointClearing } from "./convoyCheckpoints.js";
import { buildSectorQueue } from "./convoySpawnDirector.js";

export function startConvoySector(session) {
  const flow = session.convoyFlow;
  if (!flow || session.outcome || !["initialPreparation", "checkpointPreparation"].includes(flow.state)) return false;
  if (flow.state === "checkpointPreparation") flow.sectorIndex += 1;
  if (flow.sectorIndex >= session.phase.sectors.length) return false;
  flow.state = "sectorActive";
  flow.sectorStartedAt = session.elapsed;
  flow.lastTransitionAt = session.elapsed;
  flow.spawnDirector = { generationId: flow.spawnDirector.generationId + 1,
    sectorId: session.phase.sectors[flow.sectorIndex].id,
    nextReinforcementAt: session.elapsed + session.phase.sectors[flow.sectorIndex].reinforcement.startsAtMs,
    warningEmitted: false };
  session.queue = buildSectorQueue(session.phase, flow.sectorIndex, session.seed);
  session.waveStartedAt = session.elapsed;
  session.nextSpawnAt = session.elapsed + (session.queue[0]?.spawnAtMs || 0);
  session.waveActive = true;
  session.preparing = false;
  session.convoy.invulnerable = false;
  session.convoy.nextEnergyPulseAt = session.elapsed + session.phase.convoy.energyPulseEveryMs;
  return true;
}

export function advanceConvoyMovement(session, dt, events = []) {
  const convoy = session.convoy;
  if (!convoy || session.convoyFlow.state !== "sectorActive") return null;
  convoy.previousX = convoy.x;
  if (convoy.escorted && !convoy.underAttack) convoy.x = Math.min(convoy.destinationX, convoy.x + convoy.speedPxPerSecond * dt / 1000);
  convoy.progress = Math.max(convoy.progress, getConvoyProgress(convoy.x));
  if (convoy.progress >= (session.phase.convoy.destinationProgress || 1)) {
    session.convoyFlow.state = "victory";
    convoy.invulnerable = true;
    session.queue = [];
    events.push({ type: "convoyEvacuated", x: convoy.x, progress: convoy.progress });
    return "victory";
  }
  const checkpointIndex = session.convoyFlow.reachedCheckpointCount;
  const checkpoint = session.phase.convoy.checkpointProgress[checkpointIndex];
  if (Number.isFinite(checkpoint) && convoy.progress >= checkpoint) enterCheckpointClearing(session, checkpointIndex, events);
  return null;
}
