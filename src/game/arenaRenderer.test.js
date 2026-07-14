import { describe, expect, it } from "vitest";
import { ARENAS, PHASES } from "./content.js";
import { getArenaUrl, loadBattleAssets } from "./assetCatalog.js";
import { createBattleSession, placeTroop } from "./battleModel.js";
import {
  getArenaIntensity,
  getBattlefieldBlueprint,
  getBattlefieldCacheKey,
  getGridCellState,
  getQualityProfile,
  shouldShowGrid,
} from "./arenaRenderer.js";

describe("arenas cinematograficas", () => {
  it("atribui uma arena exclusiva e carregavel a cada fase", () => {
    const arenaIds = PHASES.map((phase) => phase.arenaId);
    expect(new Set(arenaIds).size).toBe(8);
    expect(Object.keys(ARENAS)).toHaveLength(8);
    for (const phase of PHASES) {
      expect(getArenaUrl(phase.arenaId)).toMatch(/fase_\d{2}.*\.webp/i);
      expect(phase.ambientEffects.length).toBeGreaterThan(0);
      expect(phase.waveIntensity).toHaveLength(4);
      expect(phase.battlefieldTheme.seed).toBeTypeOf("number");
    }
  });

  it("gera oito campos procedurais deterministas com cinco rotas", () => {
    const themeIds = PHASES.map((phase) => phase.battlefieldTheme.id);
    expect(new Set(themeIds).size).toBe(8);
    for (const phase of PHASES) {
      const first = getBattlefieldBlueprint(phase);
      const second = getBattlefieldBlueprint(phase);
      expect(first).toEqual(second);
      expect(first.lanes).toHaveLength(5);
      expect(first.features).toHaveLength(48);
      expect(new Set(first.lanes.map((lane) => lane.center)).size).toBe(5);
    }
  });

  it("separa o cache estatico por fase e perfil de qualidade", () => {
    expect(getBattlefieldCacheKey(PHASES[0], { quality: "low" })).not.toBe(getBattlefieldCacheKey(PHASES[0], { quality: "high" }));
    expect(getBattlefieldCacheKey(PHASES[0], { quality: "high" })).not.toBe(getBattlefieldCacheKey(PHASES[1], { quality: "high" }));
  });

  it("nao carrega a arte panoramica no pacote da batalha", async () => {
    const assets = await loadBattleAssets({ ...PHASES[0], waves: [] }, []);
    expect(assets).not.toHaveProperty("arenaImage");
    expect(assets).toHaveProperty("troops");
    expect(assets).toHaveProperty("enemies");
  });

  it("escala a intensidade visual por onda sem ultrapassar os limites", () => {
    const phase = PHASES[7];
    expect(getArenaIntensity(phase, 0)).toBeLessThan(getArenaIntensity(phase, 3));
    expect(getArenaIntensity(phase, 99)).toBe(1);
  });

  it("exibe a grade apenas durante uma interacao tatica", () => {
    expect(shouldShowGrid({ selectedTroop: null, removeMode: false, hoveredCell: null })).toBe(false);
    expect(shouldShowGrid({ selectedTroop: "marine", removeMode: false, hoveredCell: null })).toBe(true);
    expect(shouldShowGrid({ selectedTroop: null, removeMode: false, hoveredCell: { row: 1, col: 2 } })).toBe(true);
  });

  it("diferencia celulas validas, ocupadas e fora da zona de implantacao", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 1);
    expect(getGridCellState(session, 0, 1, "marine", false, null).state).toBe("valid");
    placeTroop(session, "marine", 0, 1);
    expect(getGridCellState(session, 0, 1, "marine", false, null).state).toBe("invalid");
    expect(getGridCellState(session, 0, 1, null, true, null).state).toBe("removable");
    expect(getGridCellState(session, 0, 9, "marine", false, null).state).toBe("invalid");
  });

  it("reduz efeitos nos perfis de qualidade inferiores", () => {
    expect(getQualityProfile({ quality: "low" }).particles).toBeLessThan(getQualityProfile({ quality: "medium" }).particles);
    expect(getQualityProfile({ quality: "medium" }).particles).toBeLessThan(getQualityProfile({ quality: "high" }).particles);
    expect(getQualityProfile({ quality: "low" }).parallax).toBe(0);
  });
});
