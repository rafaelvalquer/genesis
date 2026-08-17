import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { ENEMIES } from "./content.js";
import { createBattleSession, debugColosso, forceColossoAttack, placeTroop, startWave, stepBattle } from "./battleModel.js";
import { enemyOccupiesTargetRow } from "./battle/queries.js";
import { getColossoDamageFactor } from "./colossoCaldeira.js";

const phase48 = () => CHAPTER_SIX_PHASES.find((phase) => phase.id === "fase_48");

function encounter() {
  const session = createBattleSession(phase48(), ["marine"], 48048);
  session.waveIndex = 5;
  expect(startWave(session)).toBe(true);
  const entry = session.queue.find((item) => item.packetId === "boss_encounter");
  session.queue = [entry]; session.nextSpawnAt = session.waveStartedAt + entry.spawnAtMs;
  stepBattle(session, entry.spawnAtMs);
  const boss = session.enemies.find((enemy) => enemy.type === "colossoCaldeira");
  stepBattle(session, ENEMIES.colossoCaldeira.spawnDurationMs);
  return { session, boss };
}

describe("Colosso da Caldeira", () => {
  it("desperta aos 15 segundos e fica alvo em todas as rotas", () => {
    const { session, boss } = encounter();
    expect(session.bossEncounter.spawned).toBe(true);
    expect(boss.colossoState).toBe("idle");
    expect(boss.targetableRows).toEqual([0, 1, 2, 3, 4]);
  });

  it("abre uma fissura, cria magma e invoca na própria célula", () => {
    const { session, boss } = encounter();
    boss.colossoQueuedAttack = "rift"; boss.colossoState = "riftTelegraph";
    boss.colossoStateEndsAt = session.elapsed;
    const impact = stepBattle(session, 1);
    expect(impact.some((event) => event.type === "colossoRiftOpened")).toBe(true);
    const rift = boss.colossoRifts[0];
    expect(session.temporaryMagmaHazards.some((hazard) => hazard.row === rift.row && hazard.col === rift.col)).toBe(true);
    const spawned = stepBattle(session, ENEMIES.colossoCaldeira.rift.spawnDelayMs + 1);
    expect(spawned.some((event) => event.type === "colossoRiftSpawn")).toBe(true);
    stepBattle(session, 1);
    expect(session.enemies.some((enemy) => enemy.spawnSource === "bossRift" && enemy.row === rift.row)).toBe(true);
  });

  it("muda de fase nos limiares e encerra com a animação de morte", () => {
    const { session, boss } = encounter();
    boss.hp = boss.maxHp * .70;
    stepBattle(session, 1);
    expect(boss.colossoPhase).toBe(2);
    boss.colossoStateEndsAt = session.elapsed;
    boss.hp = boss.maxHp * .35;
    stepBattle(session, 1);
    expect(boss.colossoPhase).toBe(3);
    boss.hp = 0;
    stepBattle(session, 1);
    expect(boss.dead).toBe(false);
    expect(boss.colossoState).toBe("death");
    stepBattle(session, ENEMIES.colossoCaldeira.deathDurationMs + 1);
    expect(boss.dead).toBe(true);
  });

  it("usa targeting multi-rota e expõe o núcleo apenas na janela final", () => {
    const { session, boss } = encounter();
    expect([0, 1, 2, 3, 4].every((row) => enemyOccupiesTargetRow(boss, row))).toBe(true);
    expect(getColossoDamageFactor(boss, 2)).toBeCloseTo(.7);
    boss.colossoState = "coreExposed";
    stepBattle(session, 1);
    expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
  });

  it("executa Fratura e Ruptura Sísmica sem dano instantâneo letal", () => {
    const { session, boss } = encounter();
    boss.colossoPhase = 2; boss.hp = boss.maxHp * .6;
    boss.colossoQueuedAttack = "fracture"; boss.colossoTargetRows = [1, 3];
    boss.colossoState = "fractureTelegraph"; boss.colossoStateEndsAt = session.elapsed;
    stepBattle(session, 1);
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id)).toHaveLength(10);
    const placed = placeTroop(session, "marine", 0, 1);
    expect(placed.ok).toBe(true);
    const troop = placed.troop;
    boss.colossoPhase = 3; boss.hp = boss.maxHp * .3;
    boss.colossoQueuedAttack = "seismic"; boss.colossoTargetRows = [0];
    boss.colossoState = "seismicTelegraph"; boss.colossoStateEndsAt = session.elapsed;
    stepBattle(session, 1);
    expect(troop.hp).toBeGreaterThan(0);
    expect(troop.hp).toBeLessThan(troop.maxHp);
    expect(troop.stunnedUntil).toBeGreaterThan(session.elapsed);
  });

  it("cancela fissuras, magma e summons pendentes ao morrer", () => {
    const { session, boss } = encounter();
    boss.colossoQueuedAttack = "rift"; boss.colossoState = "riftTelegraph"; boss.colossoStateEndsAt = session.elapsed;
    stepBattle(session, 1);
    boss.colossoRifts[0].spawned = false;
    boss.hp = 0;
    stepBattle(session, 1);
    expect(boss.colossoDying).toBe(true);
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).every((hazard) => !hazard.active)).toBe(true);
    expect(session.queue.some((entry) => ["boss_rift", "boss_reinforcement"].includes(entry.block))).toBe(false);
  });

  it("expõe controles de laboratório para forçar ataques e janelas do núcleo", () => {
    const { session, boss } = encounter();
    session.sandbox = true;
    const forced = forceColossoAttack(session, "rift");
    expect(forced).toMatchObject({ ok: true, attack: "rift" });
    expect(boss.colossoState).toBe("riftTelegraph");
    boss.colossoState = "idle";
    const debugged = debugColosso(session, "exposeCore");
    expect(debugged.ok).toBe(true);
    expect(boss.colossoState).toBe("coreExposed");
  });

  it("dispara o Colapso Final uma única vez e abre o núcleo", () => {
    const { session, boss } = encounter();
    boss.colossoPhase = 3;
    boss.hp = boss.maxHp * .14;
    const started = stepBattle(session, 1);
    expect(started.some((event) => event.type === "colossoFinalCollapse")).toBe(true);
    expect(boss.colossoState).toBe("finalCollapse");
    const resolved = stepBattle(session, ENEMIES.colossoCaldeira.finalCollapse.telegraphMs + 1);
    expect(resolved).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "finalCollapse", rows: [0] }));
    const second = stepBattle(session, 300);
    expect(second).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "finalCollapse", rows: [4] }));
    const third = stepBattle(session, 300);
    expect(third).toContainEqual(expect.objectContaining({ type: "colossoAttackImpact", attack: "finalCollapse", rows: [2] }));
    stepBattle(session, 300);
    expect(boss.colossoState).toBe("coreExposed");
    expect(getColossoDamageFactor(boss, 3)).toBe(1.6);
    expect(boss.colossoFinalCollapseUsed).toBe(true);
  });
});
