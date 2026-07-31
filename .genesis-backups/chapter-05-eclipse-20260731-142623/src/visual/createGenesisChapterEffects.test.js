import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createGenesisChapterEffects,
  getGenesisChapterEffectProfile,
  updateGenesisChapterEffects,
} from "./createGenesisChapterEffects.js";

describe("kits 3D dos capítulos", () => {
  it("cria os quatro kits uma única vez", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({
      THREE,
      parent,
      quality: { quality: "medium" },
      chapterId: "chapter_01",
    });

    expect(parent.getObjectByName(
      "GenesisChapterEffectsRoot",
    )).toBeTruthy();
    expect(Object.keys(runtime.groups)).toHaveLength(4);
    expect(runtime.groups.chapter_01.visible).toBe(true);
    expect(runtime.groups.chapter_02.visible).toBe(false);
  });

  it("troca capítulo por crossfade e mantém apenas o ativo ao final", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({
      THREE,
      parent,
      quality: { quality: "low" },
      chapterId: "chapter_01",
    });

    runtime.setChapter("chapter_03");

    for (let index = 0; index < 160; index += 1) {
      updateGenesisChapterEffects(
        runtime,
        1 / 60,
        index / 60,
        false,
      );
    }

    expect(runtime.activeChapterId).toBe("chapter_03");
    expect(runtime.groups.chapter_03.visible).toBe(true);
    expect(runtime.groups.chapter_01.visible).toBe(false);
    expect(
      runtime.groups.chapter_03.userData.opacity,
    ).toBeCloseTo(1, 2);
  });

  it("reduz estruturas e partículas no perfil low", () => {
    const low = getGenesisChapterEffectProfile({
      quality: "low",
    });
    const high = getGenesisChapterEffectProfile({
      quality: "high",
    });

    expect(low.structures).toBeLessThan(high.structures);
    expect(low.particles).toBeLessThan(high.particles);
  });
});
