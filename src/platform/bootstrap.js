import { applyPlatformClasses, Platform } from "./platform.js";
import { installHapticDelegation } from "./haptics.js";

let cleanupHaptics = null;
let cleanupViewport = null;

function installViewportMetrics() {
  if (typeof window === "undefined") return () => {};

  const update = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const width = viewport?.width || window.innerWidth;
    document.documentElement.style.setProperty("--genesis-vh", `${height}px`);
    document.documentElement.style.setProperty("--genesis-vw", `${width}px`);
  };

  update();
  window.addEventListener("resize", update, { passive: true });
  window.visualViewport?.addEventListener("resize", update, { passive: true });

  return () => {
    window.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("resize", update);
  };
}

export function initializePlatform() {
  if (typeof document === "undefined") return;

  applyPlatformClasses();
  cleanupHaptics?.();
  cleanupViewport?.();
  cleanupHaptics = installHapticDelegation();
  cleanupViewport = installViewportMetrics();

  if (Platform.isTouch) {
    document.documentElement.style.setProperty("--touch-target", "48px");
  }
}
