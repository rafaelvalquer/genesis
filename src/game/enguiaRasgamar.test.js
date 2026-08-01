import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import { CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { getEnemyAnimation } from "./visualGeometry.js";

const assetPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const states = ["spawnSubmerged", "swimSubmerged", "tideEscape", "rangedEmerge", "rangedCharge", "rangedAttack", "surfaceRecovery", "coilEmerge", "coilAttack", "coilRelease", "dive", "hitSurface", "deathSurface", "deathSubmerged"];

function tideSandbox() {
  return createBattleSession(CHAPTER_FIVE_PHASES[6], ["medicaNanites", "reator"], 3001, { sandbox: true });
}

function advance(session, milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 32) stepBattle(session, 32);
}

describe("Enguia Rasgamar", () => {
  it("fica disponível somente no Campo de Provas, sem alterar ondas do Capítulo 5", () => {
    expect(ENEMIES.enguiaRasgamar).toMatchObject({ hp: 40, speed: 39, baseDamage: 0, allowAlphaVariant: false });
    expect(PHASES.flatMap((phase) => phase.waves.flatMap((wave) => wave.enemies)).some((entry) => entry.type === "enguiaRasgamar")).toBe(false);
    const session = tideSandbox();
    expect(spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).ok).toBe(true);
  });

  it("embosca uma tropa alagada, aplica pulsos e a libera", () => {
    const session = tideSandbox();
    expect(placeTroop(session, "medicaNanites", 0, 4).ok).toBe(true);
    session.tideCycle.currentLevel = 2;
    const troop = session.troops[0];
    const enemy = spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).enemies[0];
    enemy.x = troop.x + 28;
    enemy.rasgamarState = "submergedApproach";
    enemy.rasgamarStateStartedAt = session.elapsed;
    advance(session, 520);
    expect(enemy.rasgamarState).toBe("coilAttack");
    expect(troop.rasgamarCoiledBy).toBe(enemy.id);
    const hp = troop.hp;
    advance(session, 1500);
    expect(troop.hp).toBeLessThan(hp);
    expect(troop.rasgamarCoiledBy).toBeNull();
    expect(troop.rasgamarAttackSlowUntil).toBeGreaterThan(session.elapsed);
  });

  it("não recebe dano direto enquanto submersa e volta à água quando a maré seca", () => {
    const session = tideSandbox();
    const enemy = spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).enemies[0];
    const hp = enemy.hp;
    const troop = { ...session.troops[0] };
    enemy.rasgamarSubmerged = true;
    stepBattle(session, 1);
    expect(enemy.hp).toBe(hp);
    session.tideCycle.currentLevel = 0;
    enemy.x = 4.5 * CELL.width;
    enemy.rasgamarState = "surfaceRecovery";
    stepBattle(session, 1);
    expect(enemy.rasgamarState).toBe("tideEscape");
    expect(troop).toBeTruthy();
  });

  it("entrega 14 animações completas, manifest e frames transparentes", async () => {
    const manifest = JSON.parse(readFileSync(assetPath("./assets/enemy/enguiaRasgamar/enguia_rasgamar.json"), "utf8"));
    expect(Object.keys(manifest.animations)).toEqual(states);
    for (const state of states) {
      expect(manifest.animations[state].frames).toBe(8);
      for (let frame = 0; frame < 8; frame += 1) {
        const file = assetPath(`./assets/enemy/enguiaRasgamar/${state}/frame${frame}.png`);
        expect(existsSync(file)).toBe(true);
        expect(await sharp(file).metadata()).toMatchObject({ width: 256, height: 256, hasAlpha: true });
      }
    }
    expect(getEnemyAnimation({ type: "enguiaRasgamar", rasgamarState: "rangedCharge", rasgamarStateStartedAt: 0, rasgamarStateEndsAt: 650 }, ENEMIES.enguiaRasgamar, 400, { rangedCharge: 8 })).toEqual({ state: "rangedCharge", frame: 4 });
  });
});
