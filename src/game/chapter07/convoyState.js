import { CELL } from "../visualGeometry.js";
import { getConvoyDestinationX, getConvoyEntryX, getConvoyRouteStartX, getConvoySpeed } from "./convoyGeometry.js";
import { createCheckpointCinematicState } from "./convoyCheckpointCinematic.js";

export function createConvoyState(phase) {
  const entryX = getConvoyEntryX();
  const routeStartX = getConvoyRouteStartX();
  return {
    id: "convoy", row: phase.convoy.row ?? 2, x: entryX, previousX: entryX,
    y: (phase.convoy.row ?? 2) * CELL.height + CELL.height / 2,
    entryX, routeStartX, startX: routeStartX, destinationX: getConvoyDestinationX(), progress: 0,
    entryState: "offscreen", entrySpeedPxPerSecond: phase.convoy.entrySpeedPxPerSecond || 120,
    hp: phase.convoy.maxHp, maxHp: phase.convoy.maxHp,
    speedPxPerSecond: getConvoySpeed(phase), escorted: false, escortTroopIds: [],
    underAttack: false, attackerIds: [], invulnerable: false,
    reserve: phase.convoy.reserveInitial, reserveMax: phase.convoy.reserveMax,
    nextEnergyPulseAt: phase.convoy.energyPulseEveryMs || 5000,
    refillAppliedForCheckpoint: [], reserveEmptyEmitted: false, damageState: "normal",
    animation: { state: "idle", startedAt: 0, previousState: null },
    lastHitAt: -Infinity, destroyedAt: null,
  };
}

export function createConvoyFlow() {
  return { state: "initialPreparation", sectorIndex: 0, reachedCheckpointCount: 0,
    sectorStartedAt: null, checkpointStartedAt: null, lastTransitionAt: 0,
    checkpointBriefingPending: false,
    checkpointCinematic: createCheckpointCinematicState(),
    destroyingStartedAt: null,
    reinforcementLevel: 0, spawnDirector: { generationId: 0, sectorId: null, nextReinforcementAt: Infinity, warningEmitted: false } };
}
