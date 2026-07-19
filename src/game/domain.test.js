import { describe, expect, it } from "vitest";
import { CHAPTERS, DECISIONS, DECISION_LEVELS, ENEMIES, getChapterForPhase, getUnlockedTroops, PHASES } from "./content.js";
import {
  buildSpawnQueue,
  calculateStars,
  decisionIsEligible,
  getDecisionOptions,
  isGroundTrapEligible,
  phaseBudget,
  validateCampaignBalance,
  waveBudget,
} from "./domain.js";

describe("campanha e ondas", () => {
  it("remove offsets terrestres da familia Crix", () => {
    expect([ENEMIES.crix, ENEMIES.vexar, ENEMIES.silex].map((enemy) => enemy.spriteOffsetY))
      .toEqual([undefined, undefined, undefined]);
  });

  it("remove offsets terrestres da familia Krulax", () => {
    expect([ENEMIES.krulax, ENEMIES.myrkon, ENEMIES.zhyra].map((enemy) => enemy.spriteOffsetY))
      .toEqual([undefined, undefined, undefined]);
  });

  it("libera os defensores na nova ordem da campanha", () => {
    const expectedByPhase = [
      ["reator", "colono", "medicaNanites", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "sniper", "incinerador", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "sniper", "incinerador", "ranger", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "sniper", "incinerador", "ranger", "demolidora", "caçador", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "sniper", "incinerador", "ranger", "demolidora", "caçador", "bombardeiro", "muralhaReforcada"],
      ["reator", "colono", "medicaNanites", "guarda", "marine", "sniper", "incinerador", "ranger", "demolidora", "caçador", "bombardeiro", "krio", "muralhaReforcada"],
    ];
    expectedByPhase.forEach((expected, phaseIndex) => {
      expect(getUnlockedTroops(phaseIndex).map((troop) => troop.id)).toEqual(expected);
    });
  });

  it("mantém orçamento crescente em todas as dezesseis fases", () => {
    expect(validateCampaignBalance()).toEqual([]);
    for (let index = 1; index < PHASES.length; index += 1) {
      expect(phaseBudget(PHASES[index])).toBeGreaterThanOrEqual(phaseBudget(PHASES[index - 1]) * 1.1);
      expect(waveBudget(PHASES[index].waves.at(-1))).toBeGreaterThanOrEqual(waveBudget(PHASES[index - 1].waves.at(-1)) * 1.1);
    }
  });

  it("organiza dezesseis fases em dois capítulos de oito operações", () => {
    expect(CHAPTERS).toHaveLength(2);
    expect(PHASES).toHaveLength(16);
    expect(CHAPTERS.map((chapter) => chapter.phaseIds.length)).toEqual([8, 8]);
    expect(getChapterForPhase("fase_08")?.id).toBe("chapter_01");
    expect(getChapterForPhase("fase_09")?.id).toBe("chapter_02");
    expect(PHASES.slice(0, 8).every((phase) => phase.waves.length === 4)).toBe(true);
    expect(PHASES.slice(8).every((phase) => phase.waves.length === 5)).toBe(true);
  });

  it("inicia a fase 14 com 200 de energia", () => {
    expect(PHASES.find((phase) => phase.id === "fase_14")?.energy).toBe(200);
  });

  it("limita a quatro Magos Abissais por onda em todo o capítulo 2", () => {
    const chapterTwoWaves = PHASES.slice(8).flatMap((phase) => phase.waves);
    const magoCount = (wave) => wave.enemies
      .filter((entry) => entry.type === "magoAbissal")
      .reduce((sum, entry) => sum + entry.count, 0);

    expect(magoCount(PHASES[8].waves[1])).toBe(4);
    expect(chapterTwoWaves.every((wave) => magoCount(wave) <= 4)).toBe(true);
  });

  it("equilibra as primeiras ondas com Refratores usando mais inimigos frágeis", () => {
    const lateChapterOpenings = PHASES.slice(12, 16).map((phase) => phase.waves[0]);
    const count = (wave, type) => wave.enemies
      .filter((entry) => entry.type === type)
      .reduce((sum, entry) => sum + entry.count, 0);

    expect(lateChapterOpenings.map((wave) => count(wave, "refrator"))).toEqual([6, 7, 8, 9]);
    expect(lateChapterOpenings.every((wave) => count(wave, "estilha") >= count(wave, "refrator") * 5)).toBe(true);
  });

  it("gera a quantidade exata por tipo e uma ordem reproduzível", () => {
    const balancedPhase = PHASES.find((entry) => entry.id === "fase_11");
    const balancedCounts = Object.fromEntries(balancedPhase.waves[1].enemies.map((entry) => [entry.type, entry.count]));
    expect(balancedCounts).toEqual({ vitrarca: 18, obsidonte: 6, neurax: 50 });
    expect(waveBudget(balancedPhase.waves[1])).toBe(1004);

    const phase = PHASES[2];
    const first = buildSpawnQueue(phase, 2, 1234);
    const second = buildSpawnQueue(phase, 2, 1234);
    expect(first).toEqual(second);
    expect(first.filter((entry) => entry.type === "crix")).toHaveLength(4);
    expect(first.filter((entry) => entry.type === "vexar")).toHaveLength(2);
    expect(first.filter((entry) => entry.type === "silex")).toHaveLength(2);
    expect(first.filter((entry) => entry.type === "medu")).toHaveLength(4);
    expect(first.filter((entry) => entry.type === "neurax")).toHaveLength(1);
    expect(first.filter((entry) => entry.type === "oculis")).toHaveLength(1);
  });

  it("registra as oito variantes com atributos e ameaça equivalentes às famílias", () => {
    const families = {
      crix: ["vexar", "silex"], medu: ["neurax", "oculis"],
      krakhul: ["brakor", "aurakh"], krulax: ["myrkon", "zhyra"],
    };
    for (const [base, variants] of Object.entries(families)) {
      for (const id of variants) {
        expect(ENEMIES[id]).toMatchObject({ id, threat: ENEMIES[base].threat });
        expect(ENEMIES[id].speed).not.toBe(ENEMIES[base].speed);
        expect(ENEMIES[id].damage).toBeTypeOf("number");
      }
    }
    expect(ENEMIES.vexar).toMatchObject({ label: "Vexar", hp: 30, speed: 39, damage: 6, attackEveryMs: 1150 });
    expect(ENEMIES.aurakh).toMatchObject({ label: "Aurakh", hp: 95, speed: 21, damage: 13, attackEveryMs: 1450 });
  });

  it("registra o Mago Abissal como suporte arcano flutuante", () => {
    expect(ENEMIES.magoAbissal).toMatchObject({
      id: "magoAbissal", label: "Mago Abissal", hp: 52, speed: 18, damage: 18,
      attack: "arcane", range: 4.5, chargeMs: 900, projectileSpeed: 130,
      attackEveryMs: 3200, baseDamage: 18, threat: 18, scale: 1.18, airborne: true,
    });
    expect(isGroundTrapEligible({ type: "magoAbissal" })).toBe(false);
    expect(isGroundTrapEligible({ type: "crix" })).toBe(true);
  });

  it("registra cinco predadores exclusivos do Mar de Vidro", () => {
    expect(CHAPTERS[1].exclusiveEnemyIds).toEqual(["estilha", "vitrarca", "obsidonte", "refrator", "crisalio"]);
    expect(ENEMIES.estilha).toMatchObject({
      chapterId: "chapter_02", hp: 18, speed: 58, damage: 5, proceduralKind: "estilha",
    });
    expect(ENEMIES.vitrarca).toMatchObject({
      chapterId: "chapter_02", hp: 62, speed: 26, damage: 11, proceduralKind: "vitrarca",
    });
    expect(ENEMIES.obsidonte).toMatchObject({
      chapterId: "chapter_02", hp: 180, speed: 10, damage: 24, proceduralKind: "obsidonte",
    });
    expect(ENEMIES.refrator).toMatchObject({
      chapterId: "chapter_02", hp: 60, speed: 19, damage: 14, attack: "arcane",
      range: 4, projectileSpeed: 170, proceduralKind: "refrator", airborne: true,
    });
    expect(ENEMIES.crisalio).toMatchObject({
      chapterId: "chapter_02", hp: 105, speed: 7, damage: 4, attackEveryMs: 2500,
      baseDamage: 20, threat: 30, scale: 1.42, shieldPulseEveryMs: 7000,
      shieldBase: 18, shieldMaxHpFactor: 0.12, shieldCap: 42,
      assetStates: ["walking", "attack", "idle", "pulse"],
    });
    expect(ENEMIES.vitrarca.spriteOffsetY).toBeUndefined();
    expect(ENEMIES.obsidonte.spriteOffsetY).toBeUndefined();
    expect(isGroundTrapEligible({ type: "refrator" })).toBe(false);
    const chapterOneTypes = new Set(PHASES.slice(0, 8).flatMap((phase) => phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type))));
    CHAPTERS[1].exclusiveEnemyIds.forEach((enemyId) => expect(chapterOneTypes.has(enemyId)).toBe(false));
    PHASES.slice(8).forEach((phase) => {
      const types = new Set(phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type)));
      expect(CHAPTERS[1].exclusiveEnemyIds.some((enemyId) => types.has(enemyId))).toBe(true);
    });
  });

  it("distribui o Crisálio nas ondas finais sem alterar os orçamentos de ameaça", () => {
    const counts = PHASES.slice(12, 16).map((phase) => phase.waves.map((wave) => (
      wave.enemies.find((entry) => entry.type === "crisalio")?.count || 0
    )));
    expect(counts).toEqual([
      [0, 0, 1, 0, 1],
      [0, 1, 0, 1, 1],
      [0, 1, 1, 1, 2],
      [1, 1, 1, 2, 2],
    ]);
    const expectedThreat = [1120, 1250, 1300, 1510, 1660, 1250, 1390, 1530, 1670, 1850, 1400, 1550, 1700, 1850, 2040, 1550, 1720, 1890, 2070, 2260];
    const actualThreat = PHASES.slice(12, 16).flatMap((phase) => phase.waves.map((wave) => wave.enemies.reduce((sum, entry) => (
      sum + ENEMIES[entry.type].threat * entry.count * (entry.variant === "alpha" ? 8 : 1)
    ), 0)));
    actualThreat.forEach((value, index) => expect(value).toBeGreaterThanOrEqual(expectedThreat[index]));
  });

  it("registra e distribui o Parasita Saltador a partir da fase 3", () => {
    expect(ENEMIES.parasitaSaltador).toMatchObject({
      id: "parasitaSaltador", label: "Parasita Saltador", hp: 16, speed: 42, damage: 2,
      attackEveryMs: 450, baseDamage: 7, threat: 16, scale: 0.72,
      jumpDurationMs: 720, jumpArcHeight: 96, attackSlowFactor: 0.65,
      assetStates: ["idle", "walking", "attack", "jump"],
    });
    expect(isGroundTrapEligible({ type: "parasitaSaltador" })).toBe(true);
    PHASES.slice(2, 8).forEach((phase, index) => {
      const expectedCount = index + 2;
      expect(phase.waves[1].enemies).toContainEqual({ type: "parasitaSaltador", count: expectedCount });
      expect(phase.waves[3].enemies).toContainEqual({ type: "parasitaSaltador", count: expectedCount });
      expect(phase.waves[0].enemies.some((entry) => entry.type === "parasitaSaltador")).toBe(false);
      expect(phase.waves[2].enemies.some((entry) => entry.type === "parasitaSaltador")).toBe(false);
    });
    PHASES.slice(8).forEach((phase) => {
      expect(phase.waves.some((wave) => wave.enemies.some((entry) => entry.type === "parasitaSaltador"))).toBe(true);
    });
  });

  it("reserva os Magos para depois da primeira onda sem alterar os orçamentos", () => {
    const appearances = [[6, 1, 4]];
    appearances.forEach(([phaseIndex, waveIndex, count]) => {
      const wave = PHASES[phaseIndex].waves[waveIndex];
      expect(wave.enemies.find((entry) => entry.type === "magoAbissal")).toEqual({ type: "magoAbissal", count });
      expect(wave.enemies.find((entry) => entry.type === "vexar")).toBeTruthy();
      expect(wave.enemies.find((entry) => entry.type === "silex")).toBeTruthy();
      expect(buildSpawnQueue(PHASES[phaseIndex], waveIndex, 77).filter((entry) => entry.type === "magoAbissal")).toHaveLength(count);
    });
    expect(PHASES.every((phase) => phase.waves[0].enemies.every((entry) => entry.type !== "magoAbissal"))).toBe(true);
    expect(PHASES[5].waves[0].enemies).toEqual([
      { type: "crix", count: 12 }, { type: "vexar", count: 6 }, { type: "silex", count: 6 },
    ]);
    expect(PHASES.slice(4, 8).map(phaseBudget)).toEqual([1614, 2124, 2728, 3592]);
    expect(PHASES.slice(4, 8).map((phase) => waveBudget(phase.waves.at(-1)))).toEqual([472, 632, 792, 1004]);
    expect(PHASES.slice(4, 8).flatMap((phase) => phase.waves.at(-1).enemies).some((entry) => entry.type === "magoAbissal")).toBe(false);
    expect(PHASES.slice(8).every((phase) => phase.waves.some((wave) => wave.enemies.some((entry) => entry.type === "magoAbissal")))).toBe(true);
  });

  it("introduz famílias em 50/25/25 e mantém os Alphas finais planejados", () => {
    expect(PHASES[1].waves[0].enemies).toEqual([
      { type: "crix", count: 4 }, { type: "vexar", count: 1 }, { type: "silex", count: 1 },
    ]);
    expect(PHASES[2].waves[1].enemies).toEqual([
      { type: "krulax", count: 6 }, { type: "myrkon", count: 3 }, { type: "zhyra", count: 3 },
      { type: "parasitaSaltador", count: 2 },
    ]);
    expect(PHASES[3].waves[0].enemies).toEqual([
      { type: "crix", count: 4 }, { type: "vexar", count: 1 }, { type: "silex", count: 1 },
      { type: "krulax", count: 2 },
      { type: "medu", count: 4 }, { type: "neurax", count: 1 }, { type: "oculis", count: 1 },
    ]);
    expect(waveBudget(PHASES[3].waves[0])).toBe(196);

    const eliteFamily = new Set(["krakhul", "brakor", "aurakh"]);
    PHASES.forEach((phase) => {
      expect(phase.waves[0].enemies.some((enemy) => eliteFamily.has(enemy.type))).toBe(false);
    });

    const expectedAlphas = ["vexar", "oculis", "zhyra", "brakor", "aurakh"];
    const expectedFinalBudgets = [348, 472, 632, 792, 1004];
    PHASES.slice(3, 8).forEach((phase, index) => {
      expect(phase.boss).toBe(true);
      expect(phase.waves.at(-1).enemies.filter((entry) => entry.variant === "alpha"))
        .toEqual([{ type: expectedAlphas[index], variant: "alpha", count: 1 }]);
      expect(waveBudget(phase.waves.at(-1))).toBe(expectedFinalBudgets[index]);
    });
    const chapterTwoAlphas = ["vexar", "oculis", "myrkon", "zhyra", "krakhul", "brakor", "aurakh", "magoAbissal"];
    PHASES.slice(8).forEach((phase, index) => {
      expect(phase.boss).toBe(true);
      expect(phase.waves.at(-1).enemies.filter((entry) => entry.variant === "alpha"))
        .toEqual([{ type: chapterTwoAlphas[index], variant: "alpha", count: 1 }]);
      expect(phase.chapterMechanic).toMatchObject({ id: "glass_echoes", maxAlive: 12 });
    });
  });

  it("calcula estrelas apenas para vitórias", () => {
    expect(calculateStars({ outcome: "defeat", integrity: 100, durationMs: 1, targetDurationMs: 100 })).toBe(0);
    expect(calculateStars({ outcome: "victory", integrity: 80, durationMs: 50, targetDurationMs: 100 })).toBe(3);
    expect(calculateStars({ outcome: "victory", integrity: 50, durationMs: 200, targetDurationMs: 100 })).toBe(1);
    expect(calculateStars({ outcome: "victory", integrity: 72, integrityMax: 120, durationMs: 200, targetDurationMs: 100 })).toBe(1);
  });

  it("aumenta cada grupo da onda com arredondamento para cima", () => {
    const phase = { waves: [{ enemies: [{ type: "medu", count: 2 }, { type: "crix", count: 1 }] }] };
    expect(buildSpawnQueue(phase, 0, 1, 1.2)).toHaveLength(5);
  });
});

describe("decisões entre ondas", () => {
  it("registra os pools dos quatro níveis e reutiliza somente as decisões previstas", () => {
    expect(DECISION_LEVELS[1]).toHaveLength(8);
    expect(DECISION_LEVELS[2]).toHaveLength(8);
    expect(DECISION_LEVELS[3]).toHaveLength(12);
    expect(DECISION_LEVELS[4]).toHaveLength(15);
    expect(DECISION_LEVELS[2]).toContain("strategic_reserve");
    expect(DECISION_LEVELS[3]).toContain("strategic_reserve");
    Object.values(DECISION_LEVELS).flat().forEach((id) => expect(DECISIONS[id]).toMatchObject({ id }));
  });

  it("sorteia duas opções determinísticas sem repetir uma escolha anterior", () => {
    const context = { level: 3, integrity: 50, loadout: ["marine", "bombardeiro", "ranger"], seed: 71 };
    const first = getDecisionOptions(context);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((option) => option.id)).size).toBe(2);
    expect(getDecisionOptions(context)).toEqual(first);
    expect(getDecisionOptions({ ...context, decisions: [{ id: first[0].id }] }).map((option) => option.id)).not.toContain(first[0].id);
    const variations = new Set(Array.from({ length: 8 }, (_, seed) => getDecisionOptions({ ...context, seed }).map((option) => option.id).join(",")));
    expect(variations.size).toBeGreaterThan(1);
  });

  it("filtra reparo por integridade e especializações pelo loadout", () => {
    expect(decisionIsEligible({ id: "repair_core", integrity: 90, integrityMax: 100 })).toBe(false);
    expect(decisionIsEligible({ id: "repair_core", integrity: 89, integrityMax: 100 })).toBe(true);
    expect(decisionIsEligible({ id: "ballistic_specialization", integrity: 100, loadout: ["colono"] })).toBe(false);
    expect(decisionIsEligible({ id: "ballistic_specialization", integrity: 100, loadout: ["marine"] })).toBe(true);
    expect(decisionIsEligible({ id: "explosive_specialization", integrity: 100, loadout: ["demolidora"] })).toBe(true);
    expect(decisionIsEligible({ id: "energy_specialization", integrity: 100, loadout: ["krio"] })).toBe(true);
  });
});
