import { useEffect, useRef } from "react";

export const BATTLE_HOTKEY_SLOT_COUNT = 8;

const EDITABLE_TAGS = new Set([
  "INPUT",
  "TEXTAREA",
  "SELECT",
]);

const GLOBAL_HOTKEY_BUTTON_SELECTOR = [
  ".troop-slot",
  ".battle-actions button",
  ".remove-button",
  ".start-wave",
  ".pause-overlay button",
].join(", ");

export function isEditableKeyboardTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return Boolean(target.closest?.("[contenteditable='true'], [role='textbox']"));
}

export function getLoadoutIndexFromKeyboardEvent(event) {
  const match = /^(?:Digit|Numpad)([1-8])$/.exec(event?.code || "");
  return match ? Number(match[1]) - 1 : null;
}

export function resolveBattleHotkey(event) {
  if (!event || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  if (isEditableKeyboardTarget(event.target)) return null;

  const nativeActivationKey = ["Space", "Enter", "NumpadEnter"].includes(event.code);
  const nativeControl = ["BUTTON", "A"].includes(event.target?.tagName);
  const allowedGameControl = Boolean(event.target?.closest?.(GLOBAL_HOTKEY_BUTTON_SELECTOR));
  if (nativeActivationKey && nativeControl && !allowedGameControl) return null;

  const loadoutIndex = getLoadoutIndexFromKeyboardEvent(event);
  if (loadoutIndex !== null) return { type: "selectTroop", loadoutIndex };

  if (event.code === "Space") return { type: "togglePause" };
  if (event.code === "Escape") return { type: "cancelTool" };
  if (event.code === "KeyR") return { type: "toggleRemove" };
  if (event.code === "Enter" || event.code === "NumpadEnter") return { type: "startWave" };
  if (event.code === "Equal" || event.code === "NumpadAdd") return { type: "adjustSpeed", direction: 1 };
  if (event.code === "Minus" || event.code === "NumpadSubtract") return { type: "adjustSpeed", direction: -1 };

  return null;
}

export function getNextBattleSpeed(currentSpeed, sandbox, direction) {
  const speeds = sandbox ? [0.5, 1, 2, 4] : [1, 2];
  const currentIndex = speeds.indexOf(currentSpeed);
  const normalizedIndex = currentIndex >= 0 ? currentIndex : speeds.indexOf(1);
  const nextIndex = Math.max(0, Math.min(speeds.length - 1, normalizedIndex + Math.sign(direction || 0)));
  return speeds[nextIndex];
}

export function getTroopSlotAvailability({
  troopId,
  troop,
  snapshot,
  sandbox = false,
  sandboxSettings = {},
  positionalTargeting = false,
}) {
  if (!troopId || !troop || !snapshot) {
    return { available: false, reason: "invalid", message: "Unidade indisponível." };
  }

  if (positionalTargeting) {
    return { available: false, reason: "interactionLocked", message: "Conclua ou cancele a seleção de alvo atual." };
  }

  const deployment = snapshot.deploymentStats?.[troopId] || {};
  const cooldown = Number(snapshot.cooldowns?.[troopId] || 0);
  const freeMode = Boolean(sandbox && sandboxSettings.rulesMode === "free");
  const price = Number(deployment.price ?? troop.price ?? 0);
  const supply = Number(troop.supply || 0);
  const limitReached = Boolean(deployment.limitReached && troopId !== "droneSentinela");

  if (freeMode) return { available: true, reason: null, message: "" };

  if (Number(snapshot.energy || 0) < price) {
    return {
      available: false,
      reason: "energy",
      message: `${troop.label} indisponível: energia insuficiente.`,
    };
  }

  if (Number(snapshot.supply || 0) < supply) {
    return {
      available: false,
      reason: "supply",
      message: `${troop.label} indisponível: supply insuficiente.`,
    };
  }

  if (cooldown > 0) {
    return {
      available: false,
      reason: "cooldown",
      message: `${troop.label} em recarga: ${(cooldown / 1000).toFixed(1)}s.`,
    };
  }

  if (limitReached) {
    return {
      available: false,
      reason: "limit",
      message: `${troop.label} atingiu o limite de unidades implantadas.`,
    };
  }

  return { available: true, reason: null, message: "" };
}

export function useBattleHotkeys(handler, enabled = true) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (event) => handlerRef.current?.(event);
    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}
