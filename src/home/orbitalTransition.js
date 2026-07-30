export const ORBITAL_TRANSITION_KEY = "genesis:orbital-transition";
const MAX_AGE_MS = 5000;

export function saveOrbitalTransition(runtime, chapterId, phaseId, storage) {
  try {
    const targetStorage = storage || globalThis.sessionStorage;
    const rotation = runtime?.planetGroup?.rotation;
    targetStorage.setItem(ORBITAL_TRANSITION_KEY, JSON.stringify({
      chapterId,
      phaseId,
      planetRotation: {
        x: Number(rotation?.x || 0),
        y: Number(rotation?.y || 0),
        z: Number(rotation?.z || 0),
      },
      cameraDistance: Number(runtime?.camera?.position?.z || 4.5),
      createdAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeOrbitalTransition(chapterId, phaseId, storage, now = Date.now()) {
  try {
    const targetStorage = storage || globalThis.sessionStorage;
    const raw = targetStorage.getItem(ORBITAL_TRANSITION_KEY);
    targetStorage.removeItem(ORBITAL_TRANSITION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (now - Number(value.createdAt) > MAX_AGE_MS) return null;
    if (value.chapterId !== chapterId || value.phaseId !== phaseId) return null;
    if (!value.planetRotation || !Number.isFinite(value.cameraDistance)) return null;
    return value;
  } catch {
    return null;
  }
}
