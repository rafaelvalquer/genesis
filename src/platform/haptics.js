import { Platform } from "./platform.js";

function vibrate(pattern) {
  if (!Platform.isTouch || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

export const haptics = {
  selection() { vibrate(12); },
  deploy() { vibrate(24); },
  important() { vibrate([28, 18, 34]); },
  warning() { vibrate([18, 18, 18]); },
};

export function installHapticDelegation() {
  if (!Platform.isTouch || typeof document === "undefined") return () => {};

  const onClick = (event) => {
    const target = event.target?.closest?.("button");
    if (!target || target.disabled) return;

    if (target.matches(".troop-slot")) haptics.selection();
    else if (target.matches(".start-wave, .containment-start-wave, .pause-primary")) haptics.important();
    else if (target.matches(".remove-button, .release-tool-button, .pause-restart")) haptics.warning();
    else if (target.matches(".battle-control-button, .speed-button, .primary-button")) haptics.selection();
  };

  document.addEventListener("click", onClick, { passive: true });
  return () => document.removeEventListener("click", onClick);
}
