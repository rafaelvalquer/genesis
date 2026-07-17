import { describe, expect, it } from "vitest";
import { ARENAS, PHASES, TROOPS } from "./content.js";
import { getArenaUrl, getEnemyPreviewUrl, getTroopPreviewUrl, loadBattleAssets } from "./assetCatalog.js";
import { createBattleSession, placeTroop } from "./battleModel.js";
import {
  getArenaIntensity,
  getBattlefieldBlueprint,
  getBattlefieldCacheKey,
  getGridCellState,
  getPlacementPreviewGeometry,
  getQualityProfile,
  shouldShowGrid,
} from "./arenaRenderer.js";

describe("arenas cinematograficas", () => {
  it("atribui uma arena exclusiva e carregavel a cada fase", () => {
    const arenaIds = PHASES.map((phase) => phase.arenaId);
    expect(new Set(arenaIds).size).toBe(16);
    expect(Object.keys(ARENAS)).toHaveLength(16);
    for (const phase of PHASES) {
      expect(getArenaUrl(phase.arenaId)).toMatch(/fase_\d{2}.*\.webp/i);
      expect(phase.ambientEffects.length).toBeGreaterThan(0);
      expect(phase.waveIntensity).toHaveLength(phase.waves.length);
      expect(phase.battlefieldTheme.seed).toBeTypeOf("number");
    }
  });

  it("usa sprites exclusivos para as especializacoes", () => {
    expect(new Set(["krio", "caçador", "bombardeiro", "incinerador", "demolidora"].map((id) => TROOPS[id].spriteKey)).size).toBe(5);
    expect(TROOPS.krio.spriteKey).toBe("krio");
    expect(TROOPS["caçador"].spriteKey).toBe("cacador");
    expect(TROOPS.bombardeiro.spriteKey).toBe("bombardeiro");
    expect(TROOPS.incinerador.spriteKey).toBe("incinerador");
    expect(TROOPS.demolidora.spriteKey).toBe("demolidora");
    for (const id of ["krio", "caçador", "bombardeiro", "incinerador", "demolidora"]) expect(getTroopPreviewUrl(id)).toMatch(/frame0.*\.png/i);
  });

  it("carrega oito quadros de idle e quatro de ataque do colono", () => {
    const idle = import.meta.glob("./assets/troop/colono/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/colono/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(4);
  });

  it("carrega oito quadros exclusivos de idle e ataque do ranger", () => {
    const idle = import.meta.glob("./assets/troop/ranger/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/ranger/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
  });

  it("carrega oito quadros exclusivos de idle e ataque do cacador", () => {
    const idle = import.meta.glob("./assets/troop/cacador/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/cacador/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
  });

  it("carrega oito quadros exclusivos de idle e ataque do bombardeiro", () => {
    const idle = import.meta.glob("./assets/troop/bombardeiro/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/bombardeiro/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
  });

  it("carrega oito quadros exclusivos de idle e ataque do incinerador", () => {
    const idle = import.meta.glob("./assets/troop/incinerador/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/incinerador/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
  });

  it("carrega oito quadros exclusivos de idle e ataque do krio", () => {
    const idle = import.meta.glob("./assets/troop/krio/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/krio/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
  });

  it("carrega os três estados e a mina da Demolidora", () => {
    const idle = import.meta.glob("./assets/troop/demolidora/idle/frame*.png");
    const mineAttack = import.meta.glob("./assets/troop/demolidora/attackMine/frame*.png");
    const gunAttack = import.meta.glob("./assets/troop/demolidora/attackGun/frame*.png");
    const mine = import.meta.glob("./assets/troop/demolidora/mine/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(mineAttack)).toHaveLength(8);
    expect(Object.keys(gunAttack)).toHaveLength(8);
    expect(Object.keys(mine)).toHaveLength(1);
  });

  it("carrega 12 quadros nos quatro estados do Parasita Saltador", () => {
    for (const state of ["idle", "walking", "attack", "jump"]) {
      const frames = import.meta.glob("./assets/enemy/parasitaSaltador/*/frame*.png");
      const matching = Object.keys(frames).filter((key) => key.includes(`/parasitaSaltador/${state}/`));
      expect(matching).toHaveLength(12);
    }
    expect(getEnemyPreviewUrl("parasitaSaltador")).toMatch(/frame0.*\.png/i);
  });

  it("carrega os oito quadros de carga e descarga do reator", () => {
    const idle = import.meta.glob("./assets/troop/reator/idle/frame*.png");
    const attack = import.meta.glob("./assets/troop/reator/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(8);
    expect(getTroopPreviewUrl("reator")).toMatch(/frame0.*\.png/i);
  });

  it("inclui animações completas para as oito variantes inimigas", () => {
    const enemyFrames = import.meta.glob("./assets/enemy/{vexar,silex,neurax,oculis,brakor,aurakh,myrkon,zhyra}/{idle,walking,attack}/frame*.png");
    const keys = Object.keys(enemyFrames);
    for (const id of ["vexar", "silex", "neurax", "oculis", "brakor", "aurakh", "myrkon", "zhyra"]) {
      for (const state of ["idle", "walking", "attack"]) {
        expect(keys.some((key) => key.includes(`/${id}/${state}/frame0.png`))).toBe(true);
      }
    }
  });

  it("carrega os 28 quadros do Mago Abissal", () => {
    const idle = import.meta.glob("./assets/enemy/magoAbissal/idle/frame*.png");
    const walking = import.meta.glob("./assets/enemy/magoAbissal/walking/frame*.png");
    const attack = import.meta.glob("./assets/enemy/magoAbissal/attack/frame*.png");
    expect(Object.keys(idle)).toHaveLength(8);
    expect(Object.keys(walking)).toHaveLength(8);
    expect(Object.keys(attack)).toHaveLength(12);
  });

  it("gera dezesseis campos procedurais deterministas com cinco rotas", () => {
    const themeIds = PHASES.map((phase) => phase.battlefieldTheme.id);
    expect(new Set(themeIds).size).toBe(16);
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

  it("encaixa a previa no centro da celula e usa o alcance real da unidade", () => {
    const session = createBattleSession(PHASES[0], ["colono", "marine", "sniper"], 1);
    expect(getPlacementPreviewGeometry(session, "colono", { row: 0, col: 0 })).toMatchObject({
      x: 50, y: 60, valid: true, range: { x0: 50, y0: 60, x1: 140, y1: 60 },
    });
    expect(getPlacementPreviewGeometry(session, "marine", { row: 2, col: 1 })).toMatchObject({
      x: 150, y: 300, valid: true, range: { x0: 150, y0: 300, x1: 700, y1: 300 },
    });
    expect(getPlacementPreviewGeometry(session, "sniper", { row: 4, col: 8 }).range.x1).toBe(1000);
  });

  it("mostra as três colunas e todas as linhas na prévia da Demolidora", () => {
    const session = createBattleSession(PHASES[5], ["demolidora"], 7);
    expect(getPlacementPreviewGeometry(session, "demolidora", { row: 2, col: 1 }).range).toEqual({
      kind: "mine", x0: 200, y0: 0, x1: 500, y1: 600,
    });
  });

  it("marca a previa invalida e omite alcance de unidades sem ataque", () => {
    const session = createBattleSession(PHASES[0], ["marine", "reator", "muralhaReforcada"], 1);
    placeTroop(session, "marine", 1, 1);
    expect(getPlacementPreviewGeometry(session, "marine", { row: 1, col: 1 })).toMatchObject({
      valid: false, color: "#fb7185",
    });
    expect(getPlacementPreviewGeometry(session, "reator", { row: 2, col: 2 }).range).toBeNull();
    expect(getPlacementPreviewGeometry(session, "muralhaReforcada", { row: 3, col: 3 }).range).toBeNull();
  });

  it("oculta a previa sem hover, no modo de remocao e apos o resultado", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 1);
    expect(getPlacementPreviewGeometry(session, "marine", null)).toBeNull();
    expect(getPlacementPreviewGeometry(session, "marine", { row: 0, col: 1 }, true)).toBeNull();
    session.outcome = "victory";
    expect(getPlacementPreviewGeometry(session, "marine", { row: 0, col: 1 })).toBeNull();
  });

  it("reduz efeitos nos perfis de qualidade inferiores", () => {
    expect(getQualityProfile({ quality: "low" }).particles).toBeLessThan(getQualityProfile({ quality: "medium" }).particles);
    expect(getQualityProfile({ quality: "medium" }).particles).toBeLessThan(getQualityProfile({ quality: "high" }).particles);
    expect(getQualityProfile({ quality: "low" }).parallax).toBe(0);
  });
});
