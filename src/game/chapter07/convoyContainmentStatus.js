import { getTransportRow } from "../phaseRules.js";

export function getConvoyContainmentStatus(session) {
  const convoy = session?.convoy;
  const phase = session?.phase;
  if (!convoy || phase?.progressionMode !== "convoy") return null;
  const flow = session.convoyFlow || {};
  const sectors = phase.sectors?.length || 4;
  const sector = Math.min(sectors, (flow.sectorIndex ?? 0) + 1);
  let status = "ready";
  if (convoy.hp <= 0) status = "destroyed";
  else if (convoy.underAttack) status = "underAttack";
  else if (flow.state === "checkpointCinematic" || flow.state === "checkpointClearing") status = "checkpoint";
  else if (flow.state === "checkpointPreparation") status = "preparation";
  else if (flow.state === "sectorCountdown") status = "starting";
  else if (convoy.entryState === "entering") status = "entering";
  else if (flow.state === "sectorActive" && !convoy.escorted) status = "unescorted";
  else if (flow.state === "sectorActive") status = "moving";
  return {
    row: getTransportRow(phase) ?? convoy.row ?? 2,
    progress: Math.max(0, Math.min(1, convoy.progress || 0)),
    progressPercent: Math.round((convoy.progress || 0) * 100),
    hp: convoy.hp, hpMax: convoy.maxHp ?? convoy.hpMax, hpPercent: Math.round(convoy.hp / Math.max(1, convoy.maxHp ?? convoy.hpMax) * 100),
    sector, sectorTotal: sectors, checkpointsReached: flow.reachedCheckpointCount ?? convoy.checkpointsReached ?? 0,
    checkpointsTotal: phase.convoy?.checkpointProgress?.length || 3,
    status, escorted: Boolean(convoy.escorted), underAttack: Boolean(convoy.underAttack), critical: convoy.hp / Math.max(1, convoy.maxHp ?? convoy.hpMax) <= .2,
    checkpointProgress: phase.convoy?.checkpointProgress || [.25, .5, .75],
  };
}
