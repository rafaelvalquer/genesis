import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  canPlaceTroop,
  createBattleSession,
  eliminateTroop,
  fireDroneSentinela,
  getDroneSentinelaTileCount,
  getTotalDroneSentinelaCount,
  placeTroop,
  removeTroop,
} from "./battleModel.js";
import { getDroneSentinelaLayout, getMuzzleWorldPosition, getTroopAnimation } from "./visualGeometry.js";

const config = TROOPS.droneSentinela;

function session() {
  const battle = createBattleSession(PHASES[0], ["droneSentinela", "colono"], 1907, {
    sandbox: true,
    sandboxSettings: { rulesMode: "standard" },
  });
  battle.energy = 200;
  battle.energyMax = 200;
  battle.supply = 30;
  battle.supplyMax = 30;
  return battle;
}

function resetDeployCooldown(battle) {
  battle.deployCooldowns.droneSentinela = 0;
}

function deployStack(battle, row = 2, col = 2, count = 1) {
  let result;
  for (let index = 0; index < count; index += 1) {
    resetDeployCooldown(battle);
    result = placeTroop(battle, "droneSentinela", row, col);
    expect(result.ok).toBe(true);
  }
  return result.troop;
}

describe("Drone Sentinela", () => {
  it("expõe a configuração inicial e os três estados unitários", () => {
    expect(config).toMatchObject({
      price: 5, supply: 1, deployCooldownMs: 1800, hp: 15, damage: 2,
      range: 4.5, attackEveryMs: 1300, projectileSpeed: 360,
      maxDeployed: 5, maxDronesPerTile: 3, maxTotalDrones: 15, unlockAt: 0,
    });
    expect(config.assetStates).toEqual(["idle", "attack", "death"]);
  });

  it("cria a primeira formação consumindo recursos e iniciando cooldown", () => {
    const battle = session();
    const result = placeTroop(battle, "droneSentinela", 2, 2);
    expect(result.ok).toBe(true);
    expect(battle.troops).toHaveLength(1);
    expect(result.troop).toMatchObject({
      droneCount: 1, maxHp: 15, hp: 15, energyCost: 5, supplyCost: 1,
    });
    expect(battle.energy).toBe(195);
    expect(battle.supply).toBe(29);
    expect(battle.deployCooldowns.droneSentinela).toBe(1800);
    expect(result.event.type).toBe("droneStackCreated");
  });

  it("adiciona o segundo drone na mesma entidade sem curar dano antigo", () => {
    const battle = session();
    const troop = deployStack(battle);
    const originalId = troop.id;
    troop.hp = 8;
    resetDeployCooldown(battle);
    const result = placeTroop(battle, "droneSentinela", 2, 2);
    expect(battle.troops).toHaveLength(1);
    expect(result.troop).toMatchObject({
      id: originalId, droneCount: 2, maxHp: 30, hp: 23, energyCost: 10, supplyCost: 2,
    });
    expect(result.event.type).toBe("droneStackAdded");
  });

  it("completa três drones e rejeita o quarto sem consumir recursos", () => {
    const battle = session();
    const troop = deployStack(battle, 2, 2, 3);
    expect(troop).toMatchObject({ droneCount: 3, maxHp: 45, energyCost: 15, supplyCost: 3 });
    resetDeployCooldown(battle);
    const before = { energy: battle.energy, supply: battle.supply };
    const result = placeTroop(battle, "droneSentinela", 2, 2);
    expect(result).toEqual({
      ok: false,
      reason: "Esta formação já possui o máximo de 3 drones.",
    });
    expect(troop.droneCount).toBe(3);
    expect({ energy: battle.energy, supply: battle.supply }).toEqual(before);
  });

  it("não empilha sobre outra tropa", () => {
    const battle = session();
    expect(placeTroop(battle, "colono", 1, 2).ok).toBe(true);
    expect(canPlaceTroop(battle, "droneSentinela", 1, 2)).toBe("Célula ocupada por outra tropa.");
  });

  it("limita novas formações a cinco células, mas permite completar a quinta", () => {
    const battle = session();
    for (let row = 0; row < 5; row += 1) deployStack(battle, row, 2, row === 4 ? 2 : 1);
    expect(getDroneSentinelaTileCount(battle)).toBe(5);
    resetDeployCooldown(battle);
    expect(canPlaceTroop(battle, "droneSentinela", 0, 3))
      .toBe("Limite de 5 células com Drone Sentinela no campo.");
    expect(placeTroop(battle, "droneSentinela", 4, 2).ok).toBe(true);
    expect(getDroneSentinelaTileCount(battle)).toBe(5);
  });

  it("limita o total agregado a quinze drones", () => {
    const battle = session();
    for (let row = 0; row < 5; row += 1) deployStack(battle, row, 2, 3);
    expect(battle.troops).toHaveLength(5);
    expect(getTotalDroneSentinelaCount(battle)).toBe(15);
    resetDeployCooldown(battle);
    expect(canPlaceTroop(battle, "droneSentinela", 0, 3))
      .toBe("Limite de 5 células com Drone Sentinela no campo.");
  });

  it("valida energia, supply e cooldown a cada adição", () => {
    const battle = session();
    deployStack(battle);
    expect(canPlaceTroop(battle, "droneSentinela", 2, 2)).toBe("Implantação recarregando.");
    resetDeployCooldown(battle);
    battle.energy = 4;
    expect(canPlaceTroop(battle, "droneSentinela", 2, 2)).toBe("Energia insuficiente: requer 5.");
    battle.energy = 5;
    battle.supply = 0;
    expect(canPlaceTroop(battle, "droneSentinela", 2, 2)).toBe("Supply insuficiente: requer 1.");
  });

  it.each([
    [1, [240]],
    [2, [160, 400]],
    [3, [80, 240, 400]],
  ])("dispara %i projétil(is) independentes com o mesmo alvo", (count, timings) => {
    const battle = session();
    const troop = deployStack(battle, 2, 2, count);
    battle.elapsed = 500;
    const target = {
      id: "enemy_target", type: "medu", row: 2, x: troop.x + 250, y: troop.y,
      hp: 50, maxHp: 50, dead: false,
    };
    battle.enemies.push(target);
    const events = [];
    fireDroneSentinela(battle, troop, config, target, events);
    expect(battle.projectiles).toHaveLength(count);
    expect(battle.projectiles.map((projectile) => projectile.damage)).toEqual(Array(count).fill(2));
    expect(battle.projectiles.map((projectile) => projectile.shotIndex)).toEqual(
      Array.from({ length: count }, (_, index) => index),
    );
    expect(battle.projectiles.map((projectile) => projectile.launchAt - battle.elapsed)).toEqual(timings);
    expect(new Set(battle.projectiles.map((projectile) => projectile.targetId))).toEqual(new Set([target.id]));
    expect(troop.attackReadyAt).toBe(1800);
    expect(events[0]).toMatchObject({ type: "droneVolley", shots: count });
  });

  it("mapeia idle, ataque e morte para o nível preservado", () => {
    for (let level = 1; level <= 3; level += 1) {
      expect(getTroopAnimation(
        { type: config.id, droneCount: level, state: "idle", stateStartedAt: 0 },
        config, 0, {},
      ).state).toBe("idle");
      expect(getTroopAnimation(
        { type: config.id, droneCount: level, state: "attack", stateStartedAt: 0 },
        config, 0, {},
      ).state).toBe("attack");
      expect(getTroopAnimation(
        { type: config.id, droneCount: level, droneDeathLevel: level, state: "dead", stateStartedAt: 0 },
        config, 0, {},
      ).state).toBe("death");
    }
  });

  it("usa layouts congelados e um ponto de disparo distinto por drone", () => {
    expect(getDroneSentinelaLayout(1)[0].scale).toBe(0.78);
    expect(getDroneSentinelaLayout(2).every(({ scale }) => scale === 0.78)).toBe(true);
    expect(getDroneSentinelaLayout(3).every(({ scale }) => scale === 0.72)).toBe(true);
    for (let count = 1; count <= 3; count += 1) {
      const layout = getDroneSentinelaLayout(count);
      expect(Object.isFrozen(layout)).toBe(true);
      expect(layout).toHaveLength(count);
      expect(layout.every(Object.isFrozen)).toBe(true);
      const troop = { type: config.id, droneCount: count, state: "attack", x: 250, y: 300 };
      const muzzles = layout.map((_, index) => getMuzzleWorldPosition(troop, config, index));
      expect(new Set(muzzles.map(({ x, y }) => `${x}:${y}`)).size).toBe(count);
    }
  });

  it("remove a formação inteira, devolve supply acumulado e reembolsa o custo total", () => {
    const battle = session();
    const troop = deployStack(battle, 2, 2, 3);
    battle.modifiers.refundRate = 0.5;
    battle.energy = 0;
    const result = removeTroop(battle, 2, 2);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(7);
    expect(result.troop).toBe(troop);
    expect(battle.troops).toHaveLength(0);
    expect(battle.supply).toBe(30);
  });

  it("preserva o nível no snapshot de morte", () => {
    const battle = session();
    const troop = deployStack(battle, 2, 2, 3);
    const events = [];
    eliminateTroop(battle, troop, events);
    expect(events[0].entity).toMatchObject({ droneCount: 3, droneDeathLevel: 3, dead: true });
  });

  it("entrega três sheets 2048×768 e oito frames transparentes por estado", async () => {
    for (const state of config.assetStates) {
      const sheetPath = path.join(process.cwd(), "art", "spritesheets", "droneSentinela", `${state}.png`);
      const metadata = await sharp(sheetPath).metadata();
      expect(metadata).toMatchObject({
        width: 2048, height: 768, channels: 4, hasAlpha: true, isPalette: false,
      });
      const frameDir = path.join(process.cwd(), "src", "game", "assets", "troop", "droneSentinela", state);
      expect(fs.readdirSync(frameDir).filter((file) => file.endsWith(".png"))).toHaveLength(8);
    }
    expect(ENEMIES.medu).toBeTruthy();
  });
});
