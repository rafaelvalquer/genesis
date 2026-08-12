import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAMAGE_TYPES, ENEMIES, TROOPS } from "./content.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import {
  canPlaceTroop,
  createBattleSession,
  placeTroop,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battle/engine.js";
import { getThermalPlatformAt } from "./thermalTerrain.js";
import { isEnemyFrozen } from "./visualGeometry.js";

function sessionWithCryo(loadout = ["cryo7", "thermalPlatform"]) {
  return createBattleSession(
    { ...CHAPTER_SIX_PHASES[0], waves: [] },
    loadout,
    41,
    { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } },
  );
}

function deployAndTarget(type = "cuspidorBrasa", row = 0, col = 6) {
  const session = sessionWithCryo(["cryo7"]);
  const deployment = placeTroop(session, "cryo7", row, col);
  const troop = deployment.troop;
  const enemy = spawnEnemy(session, { type, row }).enemies[0];
  enemy.x = troop.x + 220;
  enemy.previousRenderX = enemy.x;
  return { session, troop, enemy };
}

function runUntil(session, predicate, limit = 80) {
  for (let index = 0; index < limit; index += 1) {
    const events = stepBattle(session, 32);
    if (predicate(events)) return events;
  }
  return [];
}

describe("CRYO-7 Operador Criogênico", () => {
  it("registra o contrato de gameplay e exatamente 24 sprites", () => {
    expect(TROOPS.cryo7).toMatchObject({
      price: 20, supply: 5, deployCooldownMs: 6000, maxDeployed: 5, hp: 28,
      range: 5.5, attackEveryMs: 2600, damage: 6, projectileSpeed: 540,
      straightLaneProjectile: true, canTargetGround: true, canTargetAir: false,
      cryoDamageFactor: 1.35, cryoShockMs: 1000, fireCryoShockMs: 2000,
      cryoShockRecoveryMs: 4000, platformCoolingPercentPerShot: 0.04,
      thermalTerrainCompatible: false, fireDamageTakenFactor: 0.6, emberBurnDurationFactor: 0.5,
      spriteScale: 0.92,
      assetStates: ["idle", "attack", "death"],
    });
    const root = path.join(process.cwd(), "src", "game", "assets", "troop", "cryo7");
    expect(Object.values(TROOPS.cryo7.assetStates).flatMap((state) => (
      fs.readdirSync(path.join(root, state)).filter((file) => file.endsWith(".png"))
    ))).toHaveLength(24);
    expect(fs.existsSync(path.join(root, "hit"))).toBe(false);
  });

  it("exige Plataforma Térmica para operar sobre magma", () => {
    const session = sessionWithCryo();
    const [row, col] = session.phase.magmaTerrain.cells[0];
    expect(canPlaceTroop(session, "cryo7", row, col)).toContain("Magma exige");
    expect(placeTroop(session, "thermalPlatform", row, col).ok).toBe(true);
    expect(canPlaceTroop(session, "cryo7", row, col)).toBeNull();
  });

  it("prioriza fogo, depois alvos térmicos, e mantém projétil em linha reta", () => {
    const session = sessionWithCryo(["cryo7"]);
    const troop = placeTroop(session, "cryo7", 0, 6).troop;
    const normal = spawnEnemy(session, { type: "krakhul", row: 0 }).enemies[0];
    const thermal = spawnEnemy(session, { type: "salamandraCinerea", row: 0 }).enemies[0];
    const fire = spawnEnemy(session, { type: "cuspidorBrasa", row: 0 }).enemies[0];
    [normal, thermal, fire].forEach((enemy, index) => {
      enemy.x = troop.x + 160 + index * 120;
      enemy.previousRenderX = enemy.x;
    });
    stepBattle(session, 32);
    const projectile = session.projectiles.find((entry) => entry.troopType === "cryo7");
    expect(projectile).toMatchObject({ kind: "cryoJet", visualKind: "cryoJet", straightLane: true });
    expect(projectile.targetId).toBe(fire.id);
  });

  it("não adquire o Rasga-Céus enquanto ele está em altitude alta", () => {
    const session = sessionWithCryo(["cryo7"]);
    const troop = placeTroop(session, "cryo7", 0, 6).troop;
    const enemy = spawnEnemy(session, { type: "rasgaCeusCinereo", row: 0 }).enemies[0];
    enemy.x = troop.x + 220;
    enemy.previousRenderX = enemy.x;
    enemy.flightAltitude = ENEMIES.rasgaCeusCinereo.maximumFlightAltitude;
    enemy.groundRangedTargetable = false;
    stepBattle(session, 32);
    expect(session.projectiles.filter((entry) => entry.troopType === "cryo7")).toHaveLength(0);
  });

  it("causa 8,1 contra fogo e aplica choque de 2 segundos", () => {
    const { session, enemy } = deployAndTarget();
    const hpBefore = enemy.hp;
    runUntil(session, (events) => events.some((event) => event.type === "cryoShock"));
    expect(enemy.hp).toBe(hpBefore - 8.1);
    expect(enemy.stunnedUntil).toBe(2768);
    expect(session.metrics).toMatchObject({ cryo7Shots: 1, cryo7FireHits: 1, cryo7FireFreezeMs: 2000 });
  });

  it("causa dano base contra inimigo comum e não recebe bônus indevido", () => {
    const { session, enemy } = deployAndTarget("krakhul");
    const hpBefore = enemy.hp;
    runUntil(session, (events) => events.some((event) => event.type === "cryoShock"));
    expect(enemy.hp).toBe(hpBefore - 6);
    expect(session.metrics.cryo7ThermalHits).toBe(0);
    expect(session.metrics.cryo7BonusDamage).toBe(0);
  });

  it("impede stacking durante a recuperação, mas continua causando dano", () => {
    const { session, enemy } = deployAndTarget();
    runUntil(session, (events) => events.some((event) => event.type === "cryoShock"));
    const firstStun = enemy.stunnedUntil;
    runUntil(session, (events) => events.some((event) => event.type === "cryoShock"), 100);
    expect(session.metrics.cryo7ShockBlockedByRecovery).toBeGreaterThanOrEqual(1);
    expect(enemy.stunnedUntil).toBe(firstStun);
    expect(session.metrics.cryo7Hits).toBeGreaterThanOrEqual(2);
  });

  it("resfria somente a Plataforma sob a tropa no momento do disparo", () => {
    const session = sessionWithCryo();
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col);
    const troop = placeTroop(session, "cryo7", row, col).troop;
    const platform = getThermalPlatformAt(session, row, col);
    platform.heat = 50;
    const enemy = spawnEnemy(session, { type: "cuspidorBrasa", row }).enemies[0];
    enemy.x = troop.x + 220;
    enemy.previousRenderX = enemy.x;
    runUntil(session, (events) => events.some((event) => event.type === "thermalPlatformCooled"));
    expect(session.metrics.cryo7PlatformHeatRemoved).toBe(4);
    expect(platform.heat).toBeLessThan(50);
  });

  it("fica exposto e queimando quando a Plataforma é destruída", () => {
    const session = sessionWithCryo();
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col);
    const troop = placeTroop(session, "cryo7", row, col).troop;
    const platform = getThermalPlatformAt(session, row, col);
    platform.destroyed = true;
    platform.destroyedAt = session.elapsed;
    stepBattle(session, 32);
    expect(troop.thermalExposed).toBe(true);
    expect(troop.thermalBurning).toBe(true);
  });

  it("mantém histerese de superaquecimento até o calor ficar abaixo de 95%", () => {
    const session = sessionWithCryo();
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col);
    const platform = getThermalPlatformAt(session, row, col);
    platform.overheated = true;
    platform.heat = 95;
    stepBattle(session, 32);
    expect(platform.overheated).toBe(true);
    platform.heat = 94;
    stepBattle(session, 32);
    expect(platform.overheated).toBe(false);
  });

  it("não aplica choque a alvo controlImmune", () => {
    const session = sessionWithCryo();
    const enemy = { type: "workerQueenEgg", dead: false, stunnedUntil: 0, cryoShockRecoveryUntil: 0 };
    stunEnemy(session, enemy, 1000);
    expect(enemy.stunnedUntil).toBe(0);
    expect(ENEMIES.workerQueenEgg.controlImmune).toBe(true);
  });

  it("pausa os timers dos comportamentos térmicos durante o stun", () => {
    const session = sessionWithCryo();
    session.elapsed = 500;
    const enemy = {
      type: "cuspidorBrasa", dead: false, stunnedUntil: 0,
      cuspidorStateStartedAt: 100, cuspidorStateEndsAt: 900,
    };
    stunEnemy(session, enemy, 1000);
    enemy.cryoFrozenUntil = enemy.stunnedUntil;
    expect(enemy.cuspidorStateStartedAt).toBe(1100);
    expect(enemy.cuspidorStateEndsAt).toBe(1900);
    expect(isEnemyFrozen(enemy, 1000)).toBe(true);
  });

  it("mantém o slow da Krio independente do cryoJet", () => {
    expect(TROOPS.krio.attack).toBe("ice");
    expect(TROOPS.krio.slowMs).toBe(1800);
    expect(TROOPS.krio.stunMs).toBeUndefined();
    expect(DAMAGE_TYPES.FIRE).toBe("fire");
  });
});
