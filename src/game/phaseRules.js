import { DEFAULT_MAX_DEPLOYED_PER_TROOP, TROOPS, getUnlockedTroops } from "./content.js";

const DEFAULT_COMBAT_ROWS = Object.freeze([0, 1, 2, 3, 4]);

export const getProgressionMode = (phase) => phase?.progressionMode || "waves";
export const getCombatRows = (phase) => [...(phase?.rules?.combatRows || DEFAULT_COMBAT_ROWS)];
export const getTransportRow = (phase) => Number.isInteger(phase?.rules?.transportRow) ? phase.rules.transportRow : null;
export const getPhaseBlockedTroopIds = (phase) => [...(phase?.rules?.blockedTroopIds || [])];
export const isTroopAllowedForPhase = (phase, troopId) => Boolean(TROOPS[troopId])
  && !getPhaseBlockedTroopIds(phase).includes(troopId);
export const getDefaultTroopDeploymentLimit = (phase) => Number.isFinite(phase?.rules?.defaultTroopDeploymentLimit)
  ? Math.max(0, Math.floor(phase.rules.defaultTroopDeploymentLimit))
  : DEFAULT_MAX_DEPLOYED_PER_TROOP;
export const isSystemEnabledForPhase = (phase, systemId) => !(phase?.rules?.disabledSystems || []).includes(systemId)
  && !((systemId === "reactor" || systemId === "thermalPlatform")
    && getPhaseBlockedTroopIds(phase).includes(systemId === "reactor" ? "reator" : "thermalPlatform"));
export const isCombatRow = (phase, row) => getCombatRows(phase).includes(row);
export const isTransportRow = (phase, row) => getTransportRow(phase) === row;

export function getAvailableTroopsForPhase(phase, phaseIndex) {
  return getUnlockedTroops(phaseIndex).filter((troop) => isTroopAllowedForPhase(phase, troop.id));
}

export function getPlacementBlockReasonForPhase(phase, row, _col, troopId) {
  if (!isTroopAllowedForPhase(phase, troopId)) return "Tropa indisponível nesta missão.";
  if (isTransportRow(phase, row)) return "Rota exclusiva do transporte.";
  if (!isCombatRow(phase, row)) return "Posição fora da zona de combate.";
  return null;
}

export function sanitizeLoadoutForPhase(phase, loadout = []) {
  const limit = phase?.loadoutLimit ?? 6;
  return [...new Set(loadout)].filter((id) => isTroopAllowedForPhase(phase, id)).slice(0, limit);
}
