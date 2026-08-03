import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import { CELL, createBattleSession, enemyOccupiesTargetRow, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { getEnemyPreviewUrl } from "./assetCatalog.js";
import { getEnemyAnimation } from "./visualGeometry.js";
import { getBattleIndex, rebuildBattleIndex } from "./battleIndex.js";
import { isEnemyTargetable } from "./enemyTargeting.js";
import { isRasgamarShadowOnly } from "./GameCanvas.jsx";

const assetPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const states = ["spawnSubmerged", "swimSubmerged", "tideEscape", "rangedEmerge", "rangedCharge", "rangedAttack", "surfaceRecovery", "coilEmerge", "coilAttack", "coilRelease", "dive", "deathSurface", "deathSubmerged"];

function tideSandbox() {
  return createBattleSession(CHAPTER_FIVE_PHASES[6], ["medicaNanites", "reator"], 3001, { sandbox: true });
}

function advance(session, milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 32) stepBattle(session, 32);
}

describe("Enguia Rasgamar", () => {
  it("está disponível no Campo de Provas e integra as ondas do Capítulo 5", () => {
    expect(ENEMIES.enguiaRasgamar).toMatchObject({ hp: 60, speed: 39, baseDamage: 0, rangedRange: 5, allowAlphaVariant: false });
    expect(PHASES.flatMap((phase) => phase.waves.flatMap((wave) => wave.enemies)).some((entry) => entry.type === "enguiaRasgamar")).toBe(true);
    const session = tideSandbox();
    expect(spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).ok).toBe(true);
    expect(getEnemyPreviewUrl("enguiaRasgamar")).toMatch(/enguiaRasgamar.*surfaceRecovery.*frame0\.png/i);
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
    expect(enemyOccupiesTargetRow(enemy, enemy.row)).toBe(false);
    session.tideCycle.currentLevel = 0;
    enemy.x = 4.5 * CELL.width;
    enemy.rasgamarState = "surfaceRecovery";
    stepBattle(session, 1);
    expect(enemy.rasgamarState).toBe("tideEscape");
    expect(troop).toBeTruthy();
  });

  it("does not index or fire at submerged Rasgamar", () => {
    const session = tideSandbox();
    expect(placeTroop(session, "medicaNanites", 0, 4).ok).toBe(true);
    const troop = session.troops.at(-1);
    const enemy = spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).enemies[0];
    enemy.x = troop.x + CELL.width;
    enemy.rasgamarSubmerged = true;
    rebuildBattleIndex(session);
    const index = getBattleIndex(session);
    expect(index.enemiesByRow[0]).toContain(enemy);
    expect(index.targetableEnemiesByRow[0]).not.toContain(enemy);
    const events = stepBattle(session, 32);
    expect(events.some((event) => event.type === "shoot" && event.targetId === enemy.id)).toBe(false);
    expect(session.projectiles.some((projectile) => projectile.targetId === enemy.id)).toBe(false);
  });

  it("permanece submersa durante rangedPositioning", () => {
    const session = tideSandbox();
    const enemy = spawnEnemy(session, { type: "enguiaRasgamar", row: 0 }).enemies[0];
    enemy.rasgamarState = "rangedPositioning";
    enemy.rasgamarSubmerged = false;

    rebuildBattleIndex(session);

    expect(isEnemyTargetable(enemy)).toBe(false);
    expect(isRasgamarShadowOnly(enemy)).toBe(true);
    expect(getBattleIndex(session).targetableEnemiesByRow[0]).not.toContain(enemy);
    expect(getEnemyAnimation(enemy, ENEMIES.enguiaRasgamar, session.elapsed, { swimSubmerged: 8 }).state)
      .toBe("swimSubmerged");
  });

  it("keeps a submerged Rasgamar shadow-only", () => {
    expect(isRasgamarShadowOnly({ type: "enguiaRasgamar", rasgamarSubmerged: true })).toBe(true);
    expect(isRasgamarShadowOnly({ type: "enguiaRasgamar", rasgamarSubmerged: false })).toBe(false);
  });

  it("exibe os trÃªs primeiros frames do mergulho antes da sombra submersa", () => {
    const enemy = {
      type: "enguiaRasgamar",
      rasgamarSubmerged: true,
      rasgamarState: "dive",
      rasgamarStateStartedAt: 0,
      rasgamarStateEndsAt: 480,
    };

    expect(getEnemyAnimation(enemy, ENEMIES.enguiaRasgamar, 0, { dive: 4 })).toEqual({ state: "dive", frame: 0 });
    expect(getEnemyAnimation(enemy, ENEMIES.enguiaRasgamar, 120, { dive: 4 })).toEqual({ state: "dive", frame: 1 });
    expect(getEnemyAnimation(enemy, ENEMIES.enguiaRasgamar, 240, { dive: 4 })).toEqual({ state: "dive", frame: 2 });
    expect(getEnemyAnimation(enemy, ENEMIES.enguiaRasgamar, 360, { dive: 4 })).toEqual({ state: "dive", frame: 3 });
    expect(isRasgamarShadowOnly(enemy, 359)).toBe(false);
    expect(isRasgamarShadowOnly(enemy, 360)).toBe(true);
  });

  it("entrega 13 animações completas sem animação de hit", async () => {
    const manifest = JSON.parse(readFileSync(assetPath("./assets/enemy/enguiaRasgamar/enguia_rasgamar.json"), "utf8"));
    expect(Object.keys(manifest.animations)).toEqual(states);
    expect(manifest.animations.hitSurface).toBeUndefined();
    expect(existsSync(assetPath("./assets/enemy/enguiaRasgamar/hitSurface/frame0.png"))).toBe(false);
    for (const state of states) {
      const frames = manifest.animations[state].frames;
      expect(frames).toBe(state === "dive" ? 4 : 8);
      for (let frame = 0; frame < frames; frame += 1) {
        const file = assetPath(`./assets/enemy/enguiaRasgamar/${state}/frame${frame}.png`);
        expect(existsSync(file)).toBe(true);
        expect(await sharp(file).metadata()).toMatchObject({ width: 256, height: 256, hasAlpha: true });
      }
    }
    expect(manifest.animations.dive).toMatchObject({ frames: 4, frameMs: 120, loop: false });
    expect(existsSync(assetPath("./assets/enemy/enguiaRasgamar/dive/frame4.png"))).toBe(false);
    expect(getEnemyAnimation({ type: "enguiaRasgamar", rasgamarState: "rangedCharge", rasgamarStateStartedAt: 0, rasgamarStateEndsAt: 650 }, ENEMIES.enguiaRasgamar, 400, { rangedCharge: 8 })).toEqual({ state: "rangedCharge", frame: 4 });
  });
});
