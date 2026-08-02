import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import { createBattleSession, forceLeviathanAttack, spawnEnemy, stepBattle } from "./battleModel.js";
import { startLeviathanMovement, updateLeviathanMovement } from "./leviathanNereida.js";
import { getEnemyAnimation } from "./visualGeometry.js";

describe("Leviatã de Nereida", () => {
  const sandbox = () => createBattleSession(PHASES.find((phase) => phase.chapterId === "chapter_05") || PHASES[0], [], 947, {
    sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 },
  });

  it("é um chefe de teste, sem entrada em ondas ou variantes", () => {
    const boss = ENEMIES.leviathanNereida;
    expect(boss).toMatchObject({ boss: true, debugOnly: true, testOnly: true, allowWaveSpawn: false, allowRandomSpawn: false, allowAlphaVariant: false });
    expect(PHASES.flatMap((phase) => phase.waves.flatMap((wave) => wave.enemies)).some((entry) => entry.type === boss.id)).toBe(false);
  });

  it("declara animações de locomoção, oito frames por estado e nenhuma reação hit", () => {
    const states = ENEMIES.leviathanNereida.assetStates;
    expect(states).toHaveLength(17);
    expect(states).not.toContain("hit");
    expect(states).toEqual(expect.arrayContaining(["surfaceSwim", "biteRecover", "delugeCharge", "delugeRelease", "exposedGills"]));
  });

  it("nasce somente no Campo de Provas e preserva a animação ao receber dano", () => {
    const session = sandbox();
    const result = spawnEnemy(session, { type: "leviathanNereida", row: 0 });
    expect(result.ok).toBe(true);
    const boss = result.enemies[0];
    const state = boss.leviathanState;
    const stateStartedAt = boss.leviathanStateStartedAt;
    boss.hp -= 25; // Damage must not force a hit state nor restart its current animation.
    expect(boss.leviathanState).toBe(state);
    expect(boss.leviathanStateStartedAt).toBe(stateStartedAt);
    stepBattle(session, ENEMIES.leviathanNereida.spawnDurationMs + 1);
    expect(boss.leviathanState).toBe("idleSurface");
  });

  it("muda fases nos limiares sem cura e só libera Dilúvio na fase 3", () => {
    const session = sandbox();
    const boss = spawnEnemy(session, { type: "leviathanNereida" }).enemies[0];
    boss.hp = boss.maxHp * .70;
    stepBattle(session, 1);
    expect(boss.leviathanPhase).toBe(2);
    boss.hp = boss.maxHp * .35;
    stepBattle(session, 1);
    expect(boss.leviathanPhase).toBe(3);
    expect(boss.leviathanDelugeUsed).toBe(false);
  });

  it("nada entre rotas com interpolação, sem teleporte", () => {
    const session = sandbox();
    const boss = spawnEnemy(session, { type: "leviathanNereida" }).enemies[0];
    const start = { x: boss.x, y: boss.y };
    startLeviathanMovement(session, boss, { x: 940, y: 540, durationMs: 1000, state: "surfaceSwim", targetRow: 4 });
    session.elapsed = 500;
    expect(updateLeviathanMovement(session, boss)).toBe(false);
    expect(boss.x).toBeGreaterThan(940);
    expect(boss.x).toBeLessThan(start.x);
    expect(boss.y).toBeGreaterThan(start.y);
    expect(boss.previousRenderX).toBe(start.x);
    session.elapsed = 1000;
    expect(updateLeviathanMovement(session, boss)).toBe(true);
    expect(boss).toMatchObject({ x: 940, y: 540, row: 4, moving: false });
  });

  it("aceita ataques forçados somente no Campo de Provas e na fase correta", () => {
    const session = sandbox();
    const boss = spawnEnemy(session, { type: "leviathanNereida" }).enemies[0];
    boss.leviathanState = "idleSurface";
    boss.leviathanTargetable = true;
    expect(forceLeviathanAttack(session, "brineJet")).toMatchObject({ ok: true, attack: "brineJet" });
    expect(boss.leviathanQueuedAttack).toBe("brineJet");
    boss.leviathanQueuedAttack = null;
    boss.leviathanState = "idleSurface";
    expect(forceLeviathanAttack(session, "deluge")).toMatchObject({ ok: false });
  });

  it("keeps the bite separate from devastating dive after a visible submerged travel", () => {
    const session = sandbox();
    const boss = spawnEnemy(session, { type: "leviathanNereida" }).enemies[0];
    boss.leviathanState = "idleSurface";
    boss.leviathanTargetable = true;
    expect(forceLeviathanAttack(session, "biteAbyss")).toMatchObject({ ok: true });

    stepBattle(session, ENEMIES.leviathanNereida.devastatingDive.submergeDurationMs + 80);
    expect(boss).toMatchObject({ leviathanState: "submergedTravel", moving: true });
    stepBattle(session, 1100);
    expect(boss.leviathanState).toBe("biteAbyss");
    expect(boss.leviathanTelegraphEndsAt).toBeGreaterThan(session.elapsed);
    expect(getEnemyAnimation(boss, ENEMIES.leviathanNereida, session.elapsed, { biteAbyss: 8 }).frame).toBe(0);
    stepBattle(session, ENEMIES.leviathanNereida.biteAbyss.telegraphMs + ENEMIES.leviathanNereida.biteAbyss.durationMs * 5 / 8 + 20);
    expect(boss.leviathanImpactApplied).toBe(true);
    stepBattle(session, ENEMIES.leviathanNereida.biteAbyss.durationMs * 3 / 8 + 40);
    expect(boss.leviathanState).toBe("biteRecover");
  });
});
