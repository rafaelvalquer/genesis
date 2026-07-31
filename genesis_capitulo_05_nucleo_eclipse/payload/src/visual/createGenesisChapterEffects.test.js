import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createGenesisChapterEffects,
  getGenesisChapterEffectProfile,
  updateGenesisChapterEffects,
} from "./createGenesisChapterEffects.js";

describe("kits 3D dos capítulos", () => {
  it("cria os cinco kits uma única vez", () => {
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
    expect(Object.keys(runtime.groups)).toHaveLength(5);
    expect(runtime.groups.chapter_01.visible).toBe(true);
    expect(runtime.groups.chapter_05.visible).toBe(false);
  });

  it("ativa o Eclipse por crossfade", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({
      THREE,
      parent,
      quality: { quality: "low" },
      chapterId: "chapter_01",
    });

    runtime.setChapter("chapter_05");

    for (let index = 0; index < 180; index += 1) {
      updateGenesisChapterEffects(
        runtime,
        1 / 60,
        index / 60,
        false,
      );
    }

    expect(runtime.activeChapterId).toBe("chapter_05");
    expect(runtime.groups.chapter_05.visible).toBe(true);
    expect(runtime.groups.chapter_01.visible).toBe(false);
    expect(
      runtime.groups.chapter_05.userData.opacity,
    ).toBeCloseTo(1, 2);
    expect(
      parent.getObjectByName("EclipseCoreBeacon"),
    ).toBeTruthy();
  });

  it("reduz o perfil na qualidade low", () => {
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
