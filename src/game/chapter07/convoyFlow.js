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
  const enteringField = session.convoy.entryState === "offscreen";
  session.convoy.entryState = enteringField ? "entering" : "active";
  session.convoy.invulnerable = enteringField;
  session.convoy.nextEnergyPulseAt = session.elapsed + session.phase.convoy.energyPulseEveryMs;
  return true;
}

export const CONVOY_SECTOR_COUNTDOWN_MS = 2400;

export function startConvoySectorCountdown(session) {
  const flow = session?.convoyFlow;
  if (!flow || session.outcome || !["initialPreparation", "checkpointPreparation"].includes(flow.state)) return false;
  flow.countdownResumeState = flow.state;
  flow.state = "sectorCountdown";
  flow.countdownStartedAt = session.elapsed;
  flow.countdownElapsedMs = 0;
  flow.countdownDurationMs = CONVOY_SECTOR_COUNTDOWN_MS;
  session.preparing = false;
  session.queue = [];
  session.waveActive = false;
  return true;
}

export function advanceConvoySectorCountdown(session, visualDt, events = []) {
  const flow = session?.convoyFlow;
  if (!flow || flow.state !== "sectorCountdown") return false;
  flow.countdownElapsedMs = Math.min(flow.countdownDurationMs, (flow.countdownElapsedMs || 0) + Math.max(0, visualDt));
  if (flow.countdownElapsedMs < flow.countdownDurationMs) return false;
  flow.state = flow.countdownResumeState || "initialPreparation";
  const started = startConvoySector(session);
  if (started) events.push({ type: "convoyCountdownGo", sector: flow.sectorIndex + 1 });
  return started;
}

export function advanceConvoyMovement(session, dt, events = []) {
  const convoy = session.convoy;
  if (!convoy || session.convoyFlow.state !== "sectorActive") return null;
  if (convoy.entryState === "offscreen" && convoy.x >= convoy.routeStartX) {
    convoy.entryState = "active";
    convoy.invulnerable = false;
  }
  convoy.previousX = convoy.x;
  if (convoy.entryState === "entering") {
    convoy.x = Math.min(convoy.routeStartX, convoy.x + convoy.entrySpeedPxPerSecond * dt / 1000);
    convoy.progress = 0;
    if (convoy.x >= convoy.routeStartX) {
      convoy.x = convoy.routeStartX;
      convoy.previousX = convoy.x;
      convoy.entryState = "active";
      convoy.invulnerable = false;
      events.push({ type: "convoyEnteredField", x: convoy.x, y: convoy.y });
    }
    return null;
  }
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
