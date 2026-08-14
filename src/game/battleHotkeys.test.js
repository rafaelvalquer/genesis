import { describe, expect, it } from "vitest";
import {
  getLoadoutIndexFromKeyboardEvent,
  getNextBattleSpeed,
  getTroopSlotAvailability,
  isEditableKeyboardTarget,
  resolveBattleHotkey,
} from "./battleHotkeys.js";

const keyboardEvent = (code, overrides = {}) => ({
  code,
  repeat: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: { tagName: "BODY", isContentEditable: false, closest: () => null },
  ...overrides,
});

describe("atalhos de batalha", () => {
  it("mapeia as teclas numéricas e o teclado numérico para os slots do loadout", () => {
    expect(getLoadoutIndexFromKeyboardEvent(keyboardEvent("Digit1"))).toBe(0);
    expect(getLoadoutIndexFromKeyboardEvent(keyboardEvent("Digit8"))).toBe(7);
    expect(getLoadoutIndexFromKeyboardEvent(keyboardEvent("Digit9"))).toBe(8);
    expect(getLoadoutIndexFromKeyboardEvent(keyboardEvent("Numpad3"))).toBe(2);
    expect(getLoadoutIndexFromKeyboardEvent(keyboardEvent("Numpad9"))).toBe(8);
  });

  it("resolve pausa, remoção, início de onda, cancelamento e velocidade", () => {
    expect(resolveBattleHotkey(keyboardEvent("Space"))).toEqual({ type: "togglePause" });
    expect(resolveBattleHotkey(keyboardEvent("KeyR"))).toEqual({ type: "toggleRemove" });
    expect(resolveBattleHotkey(keyboardEvent("KeyF"))).toEqual({ type: "toggleFullscreen" });
    expect(resolveBattleHotkey(keyboardEvent("Enter"))).toEqual({ type: "startWave" });
    expect(resolveBattleHotkey(keyboardEvent("Escape"))).toEqual({ type: "cancelTool" });
    expect(resolveBattleHotkey(keyboardEvent("Equal"))).toEqual({ type: "adjustSpeed", direction: 1 });
    expect(resolveBattleHotkey(keyboardEvent("Minus"))).toEqual({ type: "adjustSpeed", direction: -1 });
  });

  it("ignora repetição, modificadores e controles interativos", () => {
    expect(resolveBattleHotkey(keyboardEvent("Space", { repeat: true }))).toBeNull();
    expect(resolveBattleHotkey(keyboardEvent("Digit1", { ctrlKey: true }))).toBeNull();
    expect(resolveBattleHotkey(keyboardEvent("Digit1", { target: { tagName: "INPUT" } }))).toBeNull();
    expect(resolveBattleHotkey(keyboardEvent("Enter", { target: { tagName: "BUTTON" } }))).toBeNull();
    expect(resolveBattleHotkey(keyboardEvent("Digit2", { target: { tagName: "BUTTON" } }))).toEqual({ type: "selectTroop", loadoutIndex: 1 });
    expect(resolveBattleHotkey(keyboardEvent("Space", {
      target: { tagName: "BUTTON", closest: () => ({ className: "troop-slot" }) },
    }))).toEqual({ type: "togglePause" });
    expect(isEditableKeyboardTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
});

describe("disponibilidade do slot por hotkey", () => {
  const troop = { label: "Marine", price: 10, supply: 3 };
  const availableSnapshot = {
    energy: 50,
    supply: 20,
    cooldowns: { marine: 0 },
    deploymentStats: { marine: { price: 10, limitReached: false } },
  };

  it("mantém as mesmas restrições de energia, supply, cooldown e limite", () => {
    expect(getTroopSlotAvailability({ troopId: "marine", troop, snapshot: availableSnapshot }).available).toBe(true);
    expect(getTroopSlotAvailability({ troopId: "marine", troop, snapshot: { ...availableSnapshot, energy: 9 } }).reason).toBe("energy");
    expect(getTroopSlotAvailability({ troopId: "marine", troop, snapshot: { ...availableSnapshot, supply: 2 } }).reason).toBe("supply");
    expect(getTroopSlotAvailability({ troopId: "marine", troop, snapshot: { ...availableSnapshot, cooldowns: { marine: 1500 } } }).reason).toBe("cooldown");
    expect(getTroopSlotAvailability({ troopId: "marine", troop, snapshot: { ...availableSnapshot, deploymentStats: { marine: { price: 10, limitReached: true } } } }).reason).toBe("limit");
  });

  it("permite qualquer slot no modo livre do laboratório", () => {
    const result = getTroopSlotAvailability({
      troopId: "marine",
      troop,
      snapshot: { ...availableSnapshot, energy: 0, supply: 0, cooldowns: { marine: 9999 } },
      sandbox: true,
      sandboxSettings: { rulesMode: "free" },
    });
    expect(result.available).toBe(true);
  });
});

describe("velocidade por teclado", () => {
  it("limita a campanha a 1x e 2x", () => {
    expect(getNextBattleSpeed(1, false, 1)).toBe(2);
    expect(getNextBattleSpeed(2, false, 1)).toBe(2);
    expect(getNextBattleSpeed(2, false, -1)).toBe(1);
  });

  it("mantém as quatro velocidades do laboratório", () => {
    expect(getNextBattleSpeed(1, true, -1)).toBe(0.5);
    expect(getNextBattleSpeed(1, true, 1)).toBe(2);
    expect(getNextBattleSpeed(4, true, 1)).toBe(4);
  });
});
