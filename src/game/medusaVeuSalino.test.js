import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import { CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

function setup() {
  const session = createBattleSession({ ...PHASES[32], id: "medusa-test", waves: [] }, Object.keys(TROOPS), 42,
    { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } });
  const medusa = spawnEnemy(session, { type: "medusaVeuSalino", row: 1 }).enemies[0];
  const cover = spawnEnemy(session, { type: "carapacaNereida", row: 1, x: medusa.x - 100 }).enemies[0];
  cover.x = medusa.x - 100;
  cover.nereidaState = "idle";
  return { session, medusa, cover };
}

describe("Medusa Véu-Salino", () => {
  it("registra somente os oito estados esperados", () => {
    expect(ENEMIES.medusaVeuSalino.assetStates).toEqual(["idle", "moveFloat", "retreat", "healPulse", "attackCast", "attackRelease", "death", "spawnRise"]);
    expect(ENEMIES.medusaVeuSalino.assetStates).not.toContain("hit");
  });

  it("exporta oito poses transparentes e visualmente distintas por estado", async () => {
    const root = path.join(process.cwd(), "src", "game", "assets", "enemy", "medusaVeuSalino");
    for (const state of ENEMIES.medusaVeuSalino.assetStates) {
      const files = (await fs.readdir(path.join(root, state))).filter((file) => /^frame[0-7]\.png$/.test(file)).sort();
      expect(files).toHaveLength(8);
      const frames = [];
      for (const file of files) {
        const result = await sharp(path.join(root, state, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(result.info).toMatchObject({ width: 256, height: 256, channels: 4 });
        expect([result.data[3], result.data[(255 * 4) + 3], result.data[(255 * 256 * 4) + 3], result.data[(256 * 256 - 1) * 4 + 3]]).toEqual([0, 0, 0, 0]);
        frames.push(result.data);
      }
      const signatures = new Set(frames.map((frame) => frame.toString("base64")));
      expect(signatures.size).toBeGreaterThanOrEqual(7);
      const changed = (left, right) => {
        let pixels = 0;
        for (let index = 0; index < left.length; index += 4) {
          if (Math.abs(left[index] - right[index]) + Math.abs(left[index + 1] - right[index + 1])
            + Math.abs(left[index + 2] - right[index + 2]) + Math.abs(left[index + 3] - right[index + 3]) > 60) pixels += 1;
        }
        return pixels / (256 * 256);
      };
      expect(changed(frames[0], frames[3])).toBeGreaterThanOrEqual(0.025);
    }
  });

  it("cura no sexto frame apenas os quatro aliados vivos mais feridos", () => {
    const { session, medusa } = setup();
    const allies = Array.from({ length: 5 }, (_, index) => spawnEnemy(session, {
      type: "mordelume", row: 1, x: medusa.x - (index + 1) * 30,
    }).enemies[0]);
    allies.forEach((ally, index) => { ally.hp = ally.maxHp * (0.1 + index * 0.1); ally.mordelumeState = "idle"; });
    stepBattle(session, 800);
    medusa.veuSalinoState = "idle"; medusa.veuSalinoNextHealAt = 0;
    stepBattle(session, 1);
    expect(medusa.veuSalinoState).toBe("healPulse");
    stepBattle(session, 549);
    expect(allies[0].hp / allies[0].maxHp).toBeCloseTo(0.1);
    stepBattle(session, 1);
    expect(allies.slice(0, 4).every((ally, index) => ally.hp / ally.maxHp > 0.1 + index * 0.1)).toBe(true);
    expect(allies[4].hp / allies[4].maxHp).toBeCloseTo(0.5);
    expect(getEnemyAnimation(medusa, ENEMIES.medusaVeuSalino, session.elapsed, { healPulse: 8 }).frame).toBe(5);
  });

  it("cura mais dentro da água, não revive mortos e bloqueia pulso simultâneo", () => {
    const { session, medusa, cover } = setup();
    const second = spawnEnemy(session, { type: "medusaVeuSalino", row: 1, x: medusa.x + 40 }).enemies[0];
    const ally = spawnEnemy(session, { type: "mordelume", row: 1, x: medusa.x - 80 }).enemies[0];
    ally.hp = ally.maxHp * 0.5; ally.mordelumeState = "idle";
    const dead = spawnEnemy(session, { type: "mordelume", row: 1, x: medusa.x - 100 }).enemies[0];
    dead.hp = 0; dead.dead = true;
    cover.x = medusa.x - 100;
    second.veuSalinoState = "idle"; second.veuSalinoNextHealAt = 0;
    medusa.veuSalinoNextHealAt = 0; medusa.veuSalinoState = "idle";
    stepBattle(session, 1);
    stepBattle(session, 550);
    expect(ally.hp).toBeCloseTo(ally.maxHp * 0.63);
    expect(dead.dead).toBe(true);
    expect(second.veuSalinoState).not.toBe("healPulse");
  });

  it("prioriza alta cadência, aplica 0.75 sem multiplicar e expira em quatro segundos", () => {
    const { session, medusa, cover } = setup();
    const slow = placeTroop(session, "muralhaReforcada", 1, 5).troop;
    const fast = placeTroop(session, "colono", 1, 6).troop;
    medusa.x = fast.x + 260; cover.x = medusa.x - 100;
    stepBattle(session, 800);
    stepBattle(session, 1);
    expect(medusa.veuSalinoAttackTargetId).toBe(fast.id);
    medusa.veuSalinoState = "attackRelease";
    medusa.veuSalinoStateStartedAt = session.elapsed - ENEMIES.medusaVeuSalino.attackReleaseVisual.projectileAtMs;
    medusa.veuSalinoStateEndsAt = session.elapsed + 1000;
    medusa.veuSalinoProjectileReleased = false;
    stepBattle(session, 1);
    stepBattle(session, 1100);
    expect(fast.veuSalinoAttackSlowFactor).toBe(0.75);
    expect(fast.attackSpeedFactor).toBe(0.75);
    expect(slow.veuSalinoAttackSlowFactor || 1).toBe(1);
    fast.veuSalinoAttackSlowUntil = session.elapsed + 4000;
    fast.veuSalinoAttackSlowFactor = 0.75;
    stepBattle(session, 4001);
    expect(fast.attackSpeedFactor).toBe(1);
  });

  it("recua para trás da cobertura sem reiniciar a animação de loop", () => {
    const { session, medusa, cover } = setup();
    const troop = placeTroop(session, "colono", 1, 7).troop;
    medusa.x = troop.x + CELL.width;
    cover.x = medusa.x - 100;
    stepBattle(session, 800);
    stepBattle(session, 1);
    expect(medusa.veuSalinoState).toBe("retreat");
    const startedAt = medusa.veuSalinoStateStartedAt;
    const x = medusa.x;
    stepBattle(session, 50);
    expect(medusa.x).toBeGreaterThan(x);
    expect(medusa.veuSalinoStateStartedAt).toBe(startedAt);
  });
});
