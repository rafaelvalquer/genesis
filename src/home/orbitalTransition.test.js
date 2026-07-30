import { describe, expect, it, vi } from "vitest";
import {
  consumeOrbitalTransition,
  ORBITAL_TRANSITION_KEY,
  saveOrbitalTransition,
} from "./orbitalTransition.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) || null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

describe("continuidade orbital", () => {
  it("salva e consome rotação e câmera", () => {
    const storage = memoryStorage();
    vi.spyOn(Date, "now").mockReturnValue(1000);
    expect(saveOrbitalTransition({
      planetGroup: { rotation: { x: 1, y: 2, z: 3 } },
      camera: { position: { z: 4.2 } },
    }, "chapter_01", "fase_01", storage)).toBe(true);
    expect(consumeOrbitalTransition("chapter_01", "fase_01", storage, 2000)).toMatchObject({
      planetRotation: { x: 1, y: 2, z: 3 }, cameraDistance: 4.2,
    });
    expect(storage.removeItem).toHaveBeenCalledWith(ORBITAL_TRANSITION_KEY);
    vi.restoreAllMocks();
  });

  it("descarta contexto expirado", () => {
    const storage = memoryStorage();
    storage.setItem(ORBITAL_TRANSITION_KEY, JSON.stringify({
      chapterId: "chapter_01", phaseId: "fase_01", planetRotation: {}, cameraDistance: 4, createdAt: 0,
    }));
    expect(consumeOrbitalTransition("chapter_01", "fase_01", storage, 5001)).toBeNull();
  });

  it("descarta contexto destinado a outra fase", () => {
    const storage = memoryStorage();
    storage.setItem(ORBITAL_TRANSITION_KEY, JSON.stringify({
      chapterId: "chapter_01", phaseId: "fase_02", planetRotation: {}, cameraDistance: 4, createdAt: 100,
    }));
    expect(consumeOrbitalTransition("chapter_01", "fase_01", storage, 200)).toBeNull();
  });

  it("continua funcionando quando o storage lança erro", () => {
    const storage = { setItem: () => { throw new Error("blocked"); }, getItem: () => { throw new Error("blocked"); } };
    expect(saveOrbitalTransition(null, "chapter_01", "fase_01", storage)).toBe(false);
    expect(consumeOrbitalTransition("chapter_01", "fase_01", storage)).toBeNull();
  });
});
