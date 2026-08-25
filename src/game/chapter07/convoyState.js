import { CELL } from "../visualGeometry.js";
import { getConvoyDestinationX, getConvoyEntryX, getConvoyRouteStartX } from "./convoyGeometry.js";

export function createConvoyState(phase) {
  const entryX = getConvoyEntryX();
  const routeStartX = getConvoyRouteStartX();
  return {
    id: "convoy", row: phase.convoy.row ?? 2, x: entryX, previousX: entryX,
    y: (phase.convoy.row ?? 2) * CELL.height + CELL.height / 2,
    entryX, routeStartX, startX: routeStartX, destinationX: getConvoyDestinationX(), progress: 0,
    entryState: "offscreen", entryDurationMs: phase.convoy.entryDurationMs || 2200, entry: null,
    hp: phase.convoy.maxHp, maxHp: phase.convoy.maxHp,
    underAttack: false, underAttackHoldUntil: -Infinity, attackerIds: [], invulnerable: false,
    grappledByEnemyId: null, grappleReservationEnemyId: null, grappledSince: null,
    reserve: phase.convoy.reserveInitial, reserveMax: phase.convoy.reserveMax,
    nextEnergyPulseAt: phase.convoy.energyPulseEveryMs || 5000,
    reserveEmptyEmitted: false, damageState: "normal",
    animation: { state: "idle", startedAt: 0, previousState: null },
    lastHitAt: -Infinity, destroyedAt: null,
  };
}

export function createConvoyFlow() {
  return { state: "initialPreparation", sectorIndex: 0, reachedCheckpointCount: 0,
    sectorStartedAt: null, checkpointStartedAt: null, lastTransitionAt: 0,
    checkpointBriefingPending: false, checkpointDecisionPending: false, checkpointOptionChosen: false,
    destroyingStartedAt: null,
    reinforcementLevel: 0, spawnDirector: { generationId: 0, sectorId: null, nextReinforcementAt: Infinity, warningEmitted: false } };
}
