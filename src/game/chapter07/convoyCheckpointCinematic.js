export const CONVOY_CHECKPOINT_CINEMATIC_MS = 2300;

export function createCheckpointCinematicState() {
  return { status: "idle", elapsedMs: 0, checkpointIndex: null, lastKill: null };
}

export function startCheckpointCinematic(session, checkpointIndex, events = []) {
  const flow = session?.convoyFlow;
  if (!flow || flow.state !== "checkpointClearing") return false;
  flow.state = "checkpointCinematic";
  flow.checkpointCinematic = {
    status: "checkpointCinematic", elapsedMs: 0, checkpointIndex, lastKill: flow.checkpointCinematic?.lastKill || null,
  };
  session.convoy.invulnerable = true;
  session.waveActive = false;
  events.push({ type: "checkpointCinematicStarted", checkpointIndex, lastKill: flow.checkpointCinematic.lastKill });
  return true;
}

export function advanceCheckpointCinematic(session, dt, events = []) {
  const flow = session?.convoyFlow;
  const cinematic = flow?.checkpointCinematic;
  if (!flow || flow.state !== "checkpointCinematic" || !cinematic) return false;
  cinematic.elapsedMs = Math.min(CONVOY_CHECKPOINT_CINEMATIC_MS, cinematic.elapsedMs + Math.max(0, dt));
  if (cinematic.elapsedMs < CONVOY_CHECKPOINT_CINEMATIC_MS) return false;
  cinematic.status = "complete";
  return true;
}
