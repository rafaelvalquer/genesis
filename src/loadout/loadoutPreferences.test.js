import { describe, expect, it } from "vitest";
import { loadLoadoutPreferences, resetLoadoutPreferences, resolveLoadoutForPhase, restoreLoadoutForPhase, saveLoadoutPreferences } from "./loadoutPreferences.js";

const troops = [{ id: "colono" }, { id: "sniper" }, { id: "cryo7" }];

describe("preferências de loadout", () => {
  it("usa fallback novo e persiste a preferência", () => {
    const storage = new MapStorage();
    expect(resolveLoadoutForPhase({ preference: loadLoadoutPreferences(storage), availableTroops: troops, loadoutLimit: 2 })).toEqual(["colono", "sniper", "cryo7"]);
    saveLoadoutPreferences({ troopIds: ["sniper", "cryo7"], lastSelectedTroopId: "cryo7" }, storage);
    expect(loadLoadoutPreferences(storage)).toEqual({ troopIds: ["sniper", "cryo7"], lastSelectedTroopId: "cryo7" });
  });
  it("filtra indisponíveis e respeita o limite sem destruir o preset", () => {
    const preference = { troopIds: ["cryo7", "sniper", "missing"], lastSelectedTroopId: "cryo7" };
    expect(restoreLoadoutForPhase({ preference, availableTroops: troops.slice(0, 2), loadoutLimit: 1 })).toEqual(["sniper"]);
    expect(preference.troopIds).toHaveLength(3);
  });
  it("limpa a preferência", () => {
    const storage = new MapStorage();
    saveLoadoutPreferences({ troopIds: ["colono"] }, storage);
    resetLoadoutPreferences(storage);
    expect(loadLoadoutPreferences(storage).troopIds).toEqual([]);
  });
});

class MapStorage {
  map = new Map();
  getItem(key) { return this.map.get(key) || null; }
  setItem(key, value) { this.map.set(key, value); }
  removeItem(key) { this.map.delete(key); }
}
