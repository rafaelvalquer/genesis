import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import { createBattleSession, spawnEnemy, stepBattle } from "./battleModel.js";

describe("Leviatã de Nereida", () => {
  const sandbox = () => createBattleSession(PHASES.find((phase) => phase.chapterId === "chapter_05") || PHASES[0], [], 947, {
    sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 },
  });

  it("é um chefe de teste, sem entrada em ondas ou variantes", () => {
    const boss = ENEMIES.leviathanNereida;
    expect(boss).toMatchObject({ boss: true, debugOnly: true, testOnly: true, allowWaveSpawn: false, allowRandomSpawn: false, allowAlphaVariant: false });
    expect(PHASES.flatMap((phase) => phase.waves.flatMap((wave) => wave.enemies)).some((entry) => entry.type === boss.id)).toBe(false);
  });

  it("declara 15 animações de oito frames e nenhuma reação hit", () => {
    const states = ENEMIES.leviathanNereida.assetStates;
    expect(states).toHaveLength(15);
    expect(states).not.toContain("hit");
    expect(states).toEqual(expect.arrayContaining(["delugeCharge", "delugeRelease", "exposedGills"]));
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
});
