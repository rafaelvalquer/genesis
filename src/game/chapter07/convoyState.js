import { CELL } from "../visualGeometry.js";
import { getConvoyDestinationX, getConvoySpeed, getConvoyStartX } from "./convoyGeometry.js";

export function createConvoyState(phase) {
  const startX = getConvoyStartX();
  return {
    id: "convoy", row: phase.convoy.row ?? 2, x: startX, previousX: startX,
    y: (phase.convoy.row ?? 2) * CELL.height + CELL.height / 2,
    startX, destinationX: getConvoyDestinationX(), progress: 0,
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
    destroyingStartedAt: null,
    reinforcementLevel: 0, spawnDirector: { generationId: 0, sectorId: null, nextReinforcementAt: Infinity, warningEmitted: false } };
}
