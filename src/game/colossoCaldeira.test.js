import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { ENEMIES } from "./content.js";
import { createBattleSession, debugColosso, forceColossoAttack, placeTroop, startWave, stepBattle } from "./battleModel.js";
import { enemyOccupiesTargetRow } from "./battle/queries.js";
import { getColossoAnimation, getColossoCoreHitMetadata, getColossoDamageFactor } from "./colossoCaldeira.js";
import { getColossoSpriteLayout } from "./colossoCaldeiraRenderer.js";
import manifest from "./assets/enemy/colossoCaldeira/manifest.json";

const phase48 = () => CHAPTER_SIX_PHASES.find((phase) => phase.id === "fase_48");

function encounter() {
  const session = createBattleSession(phase48(), ["marine"], 48048, { sandbox: true });
  session.waveIndex = 5; expect(startWave(session)).toBe(true);
  const entry = session.queue.find((item) => item.packetId === "boss_encounter");
  session.queue = [entry]; session.nextSpawnAt = session.waveStartedAt + entry.spawnAtMs;
  stepBattle(session, entry.spawnAtMs);
  const boss = session.enemies.find((enemy) => enemy.type === "colossoCaldeira");
  stepBattle(session, ENEMIES.colossoCaldeira.spawnDurationMs);
  return { session, boss };
}

function execute(session, attack) {
  const forced = forceColossoAttack(session, attack); expect(forced.ok).toBe(true);
  stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs[attack][session.enemies.find((entry) => entry.type === "colossoCaldeira").colossoPhase] + 1);
  return stepBattle(session, ENEMIES.colossoCaldeira.attackImpactMs[attack] + 2);
}

describe("Colosso da Caldeira", () => {
  it("usa riftAttack como asset de execução e mantém a lane física fixa", () => {
    expect(ENEMIES.colossoCaldeira.assetStates).toContain("riftAttack");
    expect(ENEMIES.colossoCaldeira.assetStates).not.toContain("riftCast");
    const { session, boss } = encounter();
    const root = { x: boss.x, y: boss.y, row: boss.row };
    expect(forceColossoAttack(session, "rift").ok).toBe(true);
    stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.rift[1] + 1);
    expect(boss.colossoState).toBe("riftAttack");
    stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs.rift + 1);
    expect({ x: boss.x, y: boss.y, row: boss.row }).toEqual(root);
  });

  it("declara frames de impacto dentro da animação de cada ataque", () => {
    expect(ENEMIES.colossoCaldeira.attackImpactFrame).toEqual({ rift: 3, slam: 4, fracture: 4, seismic: 3 });
    for (const attack of ["rift", "slam", "fracture", "seismic"]) {
      expect(ENEMIES.colossoCaldeira.attackImpactMs[attack]).toBeLessThan(ENEMIES.colossoCaldeira.attackExecutionMs[attack]);
    }
  });

  it("fixa o ponto raiz mesmo quando um frame possui anchor específico", () => {
    const layout = getColossoSpriteLayout(
      { x: 320, y: 288 },
      { state: "slamAttack", frame: 4 },
      { anchor: { x: .68, y: .72 }, frameAnchors: { slamAttack: Array.from({ length: 8 }, () => ({ x: .5, y: .8, scale: 1.1 })) } },
    );
    expect(layout.rootX).toBe(320); expect(layout.rootY).toBe(288);
    expect(layout.left + layout.width * layout.anchor.x).toBeCloseTo(layout.rootX);
    expect(layout.top + layout.height * layout.anchor.y).toBeCloseTo(layout.rootY);
  });

  it("usa somente visualRootOffset do manifest para a raiz visual", () => {
    const layout = getColossoSpriteLayout(
      { x: 320, y: 288 },
      { state: "idle", frame: 0 },
      {
        anchor: { x: .5, y: .86 },
        visualRootOffset: { x: -42, y: 190 },
        visualOffsetX: 999,
        visualOffsetY: 999,
      },
    );
    expect(layout.rootX).toBe(278);
    expect(layout.rootY).toBe(478);
    expect(ENEMIES.colossoCaldeira).not.toHaveProperty("visualOffsetY");
  });

  it("declara raízes de pés curadas e escala unitária em todos os 132 frames", () => {
    expect(manifest.frameAnchorStrategy).toBe("curated-feet-v7");
    for (const [state, frames] of Object.entries(manifest.frameAnchors)) {
      expect(manifest.curation.states[state].root).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
      expect(frames).toHaveLength(manifest.animations[state].frames);
      for (const anchor of frames) expect(anchor).toEqual({ x: .5, y: .86, scale: 1 });
    }
  });

  it("normaliza Rift e Slam na altura corporal canônica do Idle", () => {
    const canonicalHeight = manifest.curation.canonicalBodyHeightPx;
    for (const state of ["idle", "riftTelegraph", "riftAttack", "slamTelegraph", "slamAttack"]) {
      const source = manifest.curation.states[state];
      const projection = manifest.curation.rootProjection[state][0];
      const sourceHeight = (source.root.y - source.headTop) * 768;
      expect(sourceHeight * projection.scale).toBeCloseTo(canonicalHeight, 6);
    }
  });

  it("desperta aos 15 segundos e fica alvo em todas as rotas", () => {
    const { session, boss } = encounter();
    expect(session.bossEncounter.spawned).toBe(true); expect(boss.colossoState).toBe("idle");
    expect(boss.targetableRows).toEqual([0, 1, 2, 3, 4]);
  });

  it("guarda a célula da fissura no telegraph e a abre no mesmo lugar durante a execução", () => {
    const { session, boss } = encounter();
    expect(forceColossoAttack(session, "rift").ok).toBe(true);
    const target = { ...boss.colossoRiftTarget };
    expect(target).toMatchObject({ row: expect.any(Number), col: expect.any(Number) });
    expect(boss.colossoState).toBe("riftTelegraph");
    stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.rift[1] + 1);
    expect(boss.colossoState).toBe("riftAttack");
    const impact = stepBattle(session, ENEMIES.colossoCaldeira.attackImpactMs.rift + 2);
    expect(impact).toContainEqual(expect.objectContaining({ type: "colossoRiftOpened", row: target.row, col: target.col }));
    const rift = boss.colossoRifts[0];
    expect(session.temporaryMagmaHazards.some((hazard) => hazard.row === target.row && hazard.col === target.col)).toBe(true);
    const spawned = stepBattle(session, ENEMIES.colossoCaldeira.rift.spawnDelayMs + 1);
    expect(spawned.some((event) => event.type === "colossoRiftSpawn" && event.row === rift.row && event.col === rift.col)).toBe(true);
  });

  it("separa telegraph, execução e impacto único do Punho", () => {
    const { session, boss } = encounter();
    expect(forceColossoAttack(session, "slam").ok).toBe(true);
    const cells = boss.colossoTargetCells.map((cell) => ({ ...cell }));
    expect(cells).toHaveLength(3);
    const placed = placeTroop(session, "marine", cells[0].row, cells[0].col); expect(placed.ok).toBe(true);
    const troop = placed.troop;
    stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.slam[1] + 1);
    expect(boss.colossoState).toBe("slamAttack"); expect(troop.hp).toBe(troop.maxHp);
    const impact = stepBattle(session, ENEMIES.colossoCaldeira.attackImpactMs.slam + 2);
    expect(impact.filter((event) => event.type === "colossoAttackImpact" && event.attack === "slam")).toHaveLength(1);
    expect(troop.hp).toBeLessThan(troop.maxHp);
  });

  it("escolhe a rota ocupada para o Slam quando existe uma tropa viva", () => {
    const { session, boss } = encounter();
    expect(placeTroop(session, "marine", 4, 2).ok).toBe(true);
    expect(forceColossoAttack(session, "slam").ok).toBe(true);
    expect(boss.colossoTargetRows).toEqual([4]);
    expect(boss.colossoTargetCells.every((cell) => cell.row === 4)).toBe(true);
  });

  it("adianta a fase pendente imediatamente após concluir o Slam", () => {
    const { session, boss } = encounter();
    expect(forceColossoAttack(session, "slam").ok).toBe(true);
    boss.hp = boss.maxHp * .6;
    stepBattle(session, 1);
    expect(boss).toMatchObject({ colossoState: "slamTelegraph", colossoPhase: 1, colossoPendingPhase: 2, colossoTargetable: true });

    stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.slam[1] + 1);
    expect(boss.colossoState).toBe("slamAttack");
    stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs.slam + 1);
    expect(boss).toMatchObject({ colossoState: "phaseTransition2", colossoPhase: 2, colossoPendingPhase: null, colossoTargetable: false });
    expect(forceColossoAttack(session, "slam")).toMatchObject({ ok: false });
  });

  it("conclui impactos enfileirados antes de transicionar para a fase pendente", () => {
    const { session, boss } = encounter();
    boss.colossoPhase = 2;
    expect(forceColossoAttack(session, "fracture").ok).toBe(true);
    stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.fracture[2] + 1);
    boss.hp = boss.maxHp * .3;
    const firstImpact = stepBattle(session, ENEMIES.colossoCaldeira.attackImpactMs.fracture + 2);
    expect(firstImpact).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "fracture" }));
    expect(boss).toMatchObject({ colossoState: "fractureAttack", colossoPhase: 2, colossoPendingPhase: 3 });
    stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs.fracture);
    expect(boss.colossoState).toBe("phaseTransition3");
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id)).toHaveLength(10);
  });

  it("progride Fratura por célula e Sísmico por rota", () => {
    const { session, boss } = encounter();
    boss.colossoAttackReadyAt = session.elapsed;
    boss.hp = boss.maxHp * .6; stepBattle(session, 1); stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1);
    execute(session, "fracture");
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id)).toHaveLength(1);
    for (let index = 0; index < 10; index += 1) stepBattle(session, ENEMIES.colossoCaldeira.fracture.cellIntervalMs);
    const fractureCells = session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).map((hazard) => `${hazard.row}:${hazard.col}`);
    expect(new Set(fractureCells)).toHaveLength(10);
    boss.hp = boss.maxHp * .3; stepBattle(session, 1);
    stepBattle(session, ENEMIES.colossoCaldeira.attackCooldownMs[2] + 1); stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1);
    expect(forceColossoAttack(session, "seismic").ok).toBe(true);
    const rows = [...boss.colossoTargetRows]; stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.seismic[3] + ENEMIES.colossoCaldeira.attackExecutionMs.seismic * .45 + 2);
    expect(boss.colossoImpactQueue.length).toBeLessThan(rows.length);
  });

  it("mantém transições invulneráveis e dá prioridade inequívoca ao núcleo", () => {
    const { session, boss } = encounter();
    expect([0, 1, 2, 3, 4].every((row) => enemyOccupiesTargetRow(boss, row))).toBe(true);
    expect(getColossoDamageFactor(boss, 2)).toBeCloseTo(.35);
    boss.colossoAttackReadyAt = session.elapsed;
    boss.hp = boss.maxHp * .6; stepBattle(session, 1);
    expect(boss.colossoTargetable).toBe(false); expect(boss.targetableRows).toEqual([]);
    stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1); expect(boss.colossoTargetable).toBe(true);
    boss.colossoState = "coreExposed"; stepBattle(session, 1); expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
  });

  it("publica metadados de impacto coerentes com núcleo fechado e exposto", () => {
    const { boss } = encounter();
    expect(getColossoCoreHitMetadata(boss, 2)).toMatchObject({
      bossPart: "core", damageFactor: .35, coreExposed: false, resisted: true,
    });
    boss.colossoState = "coreExposed";
    boss.hitZones[2].damageFactor = 1.6;
    expect(getColossoCoreHitMetadata(boss, 3)).toMatchObject({
      bossPart: "core", damageFactor: 1.6, coreExposed: true, resisted: false,
    });
  });

  it("resolve animações por tempo de sessão, congela em pausa e segura o último frame", () => {
    const { session, boss } = encounter();
    const counts = { idle: 8, death: 14, slamAttack: 8 };
    const first = getColossoAnimation(boss, session.elapsed, counts); const later = getColossoAnimation(boss, session.elapsed + 360, counts);
    expect(later.frame).not.toBe(first.frame);
    expect(getColossoAnimation(boss, session.elapsed + 360, counts, true).frame).toBe(0);
    boss.colossoState = "slamAttack"; boss.colossoStateStartedAt = 1000; boss.colossoStateEndsAt = 1850;
    expect(getColossoAnimation(boss, 1600, counts)).toMatchObject({ state: "slamAttack", frame: 4 });
    boss.colossoState = "death"; boss.colossoStateStartedAt = 1000; boss.colossoStateEndsAt = 5600;
    expect(getColossoAnimation(boss, 9999, counts).frame).toBe(13);
  });

  it("usa marcos não lineares e faz a transição visual de ataque para idle", () => {
    const { boss } = encounter();
    const counts = { idle: 8, fractureAttack: 8, slamAttack: 8 };
    boss.colossoState = "fractureAttack"; boss.colossoStateStartedAt = 1000; boss.colossoStateEndsAt = 2900;
    expect(getColossoAnimation(boss, 1798, counts).frame).toBe(4);
    boss.colossoPreviousState = "slamAttack"; boss.colossoState = "idle"; boss.colossoStateStartedAt = 3000; boss.colossoStateEndsAt = Infinity;
    expect(getColossoAnimation(boss, 3040, counts)).toMatchObject({ previousState: "slamAttack", previousFrame: 7 });
    expect(getColossoAnimation(boss, 3120, counts).previousState).toBeNull();
  });

  it("entra em death a partir do último frame realmente exibido", () => {
    const { boss } = encounter();
    boss.colossoPreviousState = "seismicAttack";
    boss.colossoPreviousFrame = 3;
    boss.colossoState = "death";
    boss.colossoStateStartedAt = 1000;
    boss.colossoStateEndsAt = 5600;
    expect(getColossoAnimation(boss, 1020, { death: 14, seismicAttack: 8 })).toMatchObject({
      previousState: "seismicAttack",
      previousFrame: 3,
      transitionProgress: .5,
    });
  });

  it("cancela fissuras, magma e summons pendentes ao morrer", () => {
    const { session, boss } = encounter(); execute(session, "rift");
    boss.hp = 0; stepBattle(session, 1);
    expect(boss.colossoDying).toBe(true);
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).every((hazard) => !hazard.active)).toBe(true);
    expect(session.queue.some((entry) => ["boss_rift", "boss_reinforcement"].includes(entry.block))).toBe(false);
    expect(session.permanentThermalHazards[0]).toMatchObject({ active: true, gameplayActive: false, thermalState: "active" });
    stepBattle(session, 1601);
    expect(session.permanentThermalHazards).toHaveLength(0);
  });

  it("dispara o Colapso Final uma única vez e abre o núcleo", () => {
    const { session, boss } = encounter(); boss.colossoPhase = 3; boss.hp = boss.maxHp * .14;
    const started = stepBattle(session, 1); expect(started.some((event) => event.type === "colossoFinalCollapse")).toBe(true);
    const resolved = stepBattle(session, ENEMIES.colossoCaldeira.finalCollapse.telegraphMs + 1);
    expect(resolved).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "finalCollapse", rows: [0] }));
    stepBattle(session, 900); expect(boss.colossoState).toBe("coreExposed"); expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
  });

  it("separa o relógio visual dos impactos do Colapso Final", () => {
    const { session, boss } = encounter(); boss.colossoPhase = 3; boss.hp = boss.maxHp * .14;
    stepBattle(session, 1);
    const visualEnd = boss.colossoStateEndsAt;
    expect(boss.colossoNextCollapseImpactAt).toBe(visualEnd);
    const first = stepBattle(session, ENEMIES.colossoCaldeira.finalCollapse.telegraphMs + 1);
    expect(first).toContainEqual(expect.objectContaining({ attack: "finalCollapse", rows: [0] }));
    expect(boss.colossoStateEndsAt).toBe(visualEnd);
    expect(boss.colossoNextCollapseImpactAt).toBe(visualEnd + 300);
    expect(getColossoAnimation(boss, visualEnd + 1, { finalCollapse: 12 }).frame).toBe(11);
    const second = stepBattle(session, 300);
    expect(second).toContainEqual(expect.objectContaining({ attack: "finalCollapse", rows: [4] }));
    expect(boss.colossoStateEndsAt).toBe(visualEnd);
    expect(boss.colossoNextCollapseImpactAt).toBe(visualEnd + 600);
    const third = stepBattle(session, 300);
    expect(third).toContainEqual(expect.objectContaining({ attack: "finalCollapse", rows: [2] }));
    expect(boss.colossoState).toBe("coreExposed");
    expect(getColossoAnimation(boss, session.elapsed + 100, { coreExposed: 8 }).state).toBe("coreExposed");
  });

  it("expõe controles de laboratório", () => {
    const { session, boss } = encounter(); const forced = forceColossoAttack(session, "rift"); expect(forced.ok).toBe(true);
    boss.colossoState = "idle"; expect(debugColosso(session, "exposeCore").ok).toBe(true);
  });
});
