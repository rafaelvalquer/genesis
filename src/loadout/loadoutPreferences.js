export const LOADOUT_PREFERENCES_KEY = "genesis-defense:loadout:v1";

const DEFAULT_LOADOUT_PREFERENCES = Object.freeze({ troopIds: [], lastSelectedTroopId: null });

function sanitizePreference(value) {
  const troopIds = Array.isArray(value?.troopIds)
    ? [...new Set(value.troopIds.filter((id) => typeof id === "string" && id))]
    : [];
  const lastSelectedTroopId = typeof value?.lastSelectedTroopId === "string" && value.lastSelectedTroopId
    ? value.lastSelectedTroopId
    : troopIds.at(-1) || null;
  return { troopIds, lastSelectedTroopId };
}

export function loadLoadoutPreferences(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(LOADOUT_PREFERENCES_KEY);
    return raw ? sanitizePreference(JSON.parse(raw)) : { ...DEFAULT_LOADOUT_PREFERENCES };
  } catch {
    return { ...DEFAULT_LOADOUT_PREFERENCES };
  }
}

export function saveLoadoutPreferences(preference, storage = globalThis.localStorage) {
  const next = sanitizePreference(preference);
  try { storage?.setItem(LOADOUT_PREFERENCES_KEY, JSON.stringify(next)); } catch { /* storage indisponível */ }
  return next;
}

export function resetLoadoutPreferences(storage = globalThis.localStorage) {
  try { storage?.removeItem(LOADOUT_PREFERENCES_KEY); } catch { /* storage indisponível */ }
  return { ...DEFAULT_LOADOUT_PREFERENCES };
}

export function restoreLoadoutForPhase({ preference, availableTroops, loadoutLimit }) {
  const availableIds = new Set(availableTroops.map((troop) => troop.id));
  return sanitizePreference(preference).troopIds
    .filter((id) => availableIds.has(id))
    .slice(0, Math.max(0, loadoutLimit));
}

export function resolveLoadoutForPhase({ preference, availableTroops, loadoutLimit }) {
  const restored = restoreLoadoutForPhase({ preference, availableTroops, loadoutLimit });
  return restored.length ? restored : availableTroops.slice(0, 3).map((troop) => troop.id);
}

export function getValidLastSelectedTroopId(preference, availableTroops, selected = []) {
  const availableIds = new Set(availableTroops.map((troop) => troop.id));
  const candidate = preference?.lastSelectedTroopId;
  return candidate && availableIds.has(candidate) ? candidate : selected.at(-1) || availableTroops[0]?.id || null;
}
