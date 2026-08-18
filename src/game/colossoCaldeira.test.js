import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { ENEMIES } from "./content.js";
import { createBattleSession, debugColosso, forceColossoAttack, placeTroop, startWave, stepBattle } from "./battleModel.js";
import { enemyOccupiesTargetRow } from "./battle/queries.js";
import { getColossoAnimation, getColossoDamageFactor } from "./colossoCaldeira.js";

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
  return stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs[attack] * ENEMIES.colossoCaldeira.attackImpactProgress[attack] + 2);
}

describe("Colosso da Caldeira", () => {
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
    const impact = stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs.rift * .58 + 2);
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
    const impact = stepBattle(session, ENEMIES.colossoCaldeira.attackExecutionMs.slam * .62 + 2);
    expect(impact.filter((event) => event.type === "colossoAttackImpact" && event.attack === "slam")).toHaveLength(1);
    expect(troop.hp).toBeLessThan(troop.maxHp);
  });

  it("progride Fratura por célula e Sísmico por rota", () => {
    const { session, boss } = encounter();
    boss.hp = boss.maxHp * .6; stepBattle(session, 1); stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1);
    execute(session, "fracture");
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id)).toHaveLength(1);
    for (let index = 0; index < 10; index += 1) stepBattle(session, ENEMIES.colossoCaldeira.fracture.cellIntervalMs);
    const fractureCells = session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).map((hazard) => `${hazard.row}:${hazard.col}`);
    expect(new Set(fractureCells)).toHaveLength(10);
    boss.hp = boss.maxHp * .3; stepBattle(session, 1); stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1);
    expect(forceColossoAttack(session, "seismic").ok).toBe(true);
    const rows = [...boss.colossoTargetRows]; stepBattle(session, ENEMIES.colossoCaldeira.attackTelegraphMs.seismic[3] + ENEMIES.colossoCaldeira.attackExecutionMs.seismic * .45 + 2);
    expect(boss.colossoImpactQueue.length).toBeLessThan(rows.length);
  });

  it("mantém transições invulneráveis e dá prioridade inequívoca ao núcleo", () => {
    const { session, boss } = encounter();
    expect([0, 1, 2, 3, 4].every((row) => enemyOccupiesTargetRow(boss, row))).toBe(true);
    expect(getColossoDamageFactor(boss, 2)).toBeCloseTo(.35);
    boss.hp = boss.maxHp * .6; stepBattle(session, 1);
    expect(boss.colossoTargetable).toBe(false); expect(boss.targetableRows).toEqual([]);
    stepBattle(session, ENEMIES.colossoCaldeira.transitionMs + 1); expect(boss.colossoTargetable).toBe(true);
    boss.colossoState = "coreExposed"; stepBattle(session, 1); expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
  });

  it("resolve animações por tempo de sessão, congela em pausa e segura o último frame", () => {
    const { session, boss } = encounter();
    const counts = { idle: 8, death: 14, slamAttack: 8 };
    const first = getColossoAnimation(boss, session.elapsed, counts); const later = getColossoAnimation(boss, session.elapsed + 360, counts);
    expect(later.frame).not.toBe(first.frame);
    expect(getColossoAnimation(boss, session.elapsed + 360, counts, true).frame).toBe(0);
    boss.colossoState = "slamAttack"; boss.colossoStateStartedAt = 1000; boss.colossoStateEndsAt = 1850;
    expect(getColossoAnimation(boss, 1600, counts)).toMatchObject({ state: "slamAttack", frame: 5 });
    boss.colossoState = "death"; boss.colossoStateStartedAt = 1000; boss.colossoStateEndsAt = 5600;
    expect(getColossoAnimation(boss, 9999, counts).frame).toBe(13);
  });

  it("cancela fissuras, magma e summons pendentes ao morrer", () => {
    const { session, boss } = encounter(); execute(session, "rift");
    boss.hp = 0; stepBattle(session, 1);
    expect(boss.colossoDying).toBe(true);
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).every((hazard) => !hazard.active)).toBe(true);
    expect(session.queue.some((entry) => ["boss_rift", "boss_reinforcement"].includes(entry.block))).toBe(false);
  });

  it("dispara o Colapso Final uma única vez e abre o núcleo", () => {
    const { session, boss } = encounter(); boss.colossoPhase = 3; boss.hp = boss.maxHp * .14;
    const started = stepBattle(session, 1); expect(started.some((event) => event.type === "colossoFinalCollapse")).toBe(true);
    const resolved = stepBattle(session, ENEMIES.colossoCaldeira.finalCollapse.telegraphMs + 1);
    expect(resolved).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "finalCollapse", rows: [0] }));
    stepBattle(session, 900); expect(boss.colossoState).toBe("coreExposed"); expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
  });

  it("expõe controles de laboratório", () => {
    const { session, boss } = encounter(); const forced = forceColossoAttack(session, "rift"); expect(forced.ok).toBe(true);
    boss.colossoState = "idle"; expect(debugColosso(session, "exposeCore").ok).toBe(true);
  });
});
