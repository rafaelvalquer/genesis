import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createGenesisChapterEffects, updateGenesisChapterEffects } from "./createGenesisChapterEffects.js";

function countNamed(root, name) {
  let count = 0;
  root.traverse((object) => { if (object.name === name) count += 1; });
  return count;
}

describe("efeitos 3D próximos às rotas", () => {
  it("cria cinco kits e ativa somente o capítulo selecionado", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({ THREE, parent, quality: { quality: "medium" }, chapterId: "chapter_01" });
    expect(Object.keys(runtime.groups)).toHaveLength(6);
    expect(runtime.groups.chapter_01.visible).toBe(true);
    expect(runtime.groups.chapter_05.visible).toBe(false);
  });

  it("usa os modelos reconhecíveis pedidos para cada capítulo", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({ THREE, parent, quality: { quality: "low" }, chapterId: "chapter_01" });
    expect(countNamed(parent, "HiveRouteRocks")).toBe(1);
    expect(countNamed(parent, "GlassRouteCrystals")).toBe(1);
    expect(countNamed(parent, "ChitinRouteDunes")).toBe(1);
    expect(countNamed(parent, "StormRouteMountains")).toBe(1);
    expect(countNamed(parent, "StormRouteWinds")).toBe(1);
    expect(countNamed(parent, "OceanRouteCurrent")).toBe(1);
    expect(countNamed(parent, "OceanRouteRipples")).toBe(1);
    expect(countNamed(parent, "Chapter06_MagmaEffects")).toBe(1);
  });

  it("troca para o oceano por crossfade", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({ THREE, parent, quality: { quality: "low" }, chapterId: "chapter_01" });
    runtime.setChapter("chapter_05");
    for (let index = 0; index < 180; index += 1) updateGenesisChapterEffects(runtime, 1 / 60, index / 60, false);
    expect(runtime.activeChapterId).toBe("chapter_05");
    expect(runtime.groups.chapter_05.visible).toBe(true);
    expect(runtime.groups.chapter_01.visible).toBe(false);
  });

  it("nÃ£o atualiza efeitos completamente invisÃ­veis", () => {
    const parent = new THREE.Group();
    const runtime = createGenesisChapterEffects({ THREE, parent, quality: { quality: "low" }, chapterId: "chapter_01" });
    const hiddenUpdate = vi.fn();
    runtime.groups.chapter_02.userData.update = hiddenUpdate;

    updateGenesisChapterEffects(runtime, 1 / 60, 1 / 60, false);

    expect(hiddenUpdate).not.toHaveBeenCalled();
  });
});
