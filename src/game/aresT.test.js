import { describe, expect, it } from "vitest";
import { ENEMIES, TROOPS } from "./content.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { canPlaceTroop, createBattleSession, createTroopEntity, damageTroop, spawnEnemy, stepBattle } from "./battle/engine.js";

describe("ARES-T Bastilha Cerâmica", () => {
  it("expõe o contrato térmico e os estados de sprite", () => {
    expect(TROOPS.aresT).toMatchObject({
      price: 22, supply: 6, deployCooldownMs: 7000, maxDeployed: 5, hp: 88,
      thermalTerrainCompatible: true, thermalBurnDamageFactor: 0,
      fireDamageTakenFactor: 0.35, fireEnemyDamageFactor: 1.2,
      thermalShield: { maxHp: 18, gainHp: 6, pulseEveryMs: 5000 },
      assetStates: ["idle", "attack", "death"],
    });
  });

  it("entra diretamente no magma e bloqueia a plataforma sob seu chassi", () => {
    const phase = { ...CHAPTER_SIX_PHASES[0], waves: [] };
    const session = createBattleSession(phase, ["aresT", "thermalPlatform"], 3, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = phase.magmaTerrain.cells[0];
    expect(canPlaceTroop(session, "aresT", row, col)).toBeNull();
    const troop = createTroopEntity(session, "aresT", row, col);
    session.troops.push(troop);
    expect(canPlaceTroop(session, "thermalPlatform", row, col)).toBe("ARES-T já possui proteção térmica própria.");
  });

  it("reduz fogo, não recebe queimadura e recarrega o escudo no magma", () => {
    const phase = { ...CHAPTER_SIX_PHASES[0], waves: [] };
    const session = createBattleSession(phase, ["aresT"], 4, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = phase.magmaTerrain.cells[0];
    const troop = createTroopEntity(session, "aresT", row, col);
    session.troops.push(troop);
    const events = [];
    damageTroop(session, troop, 20, events, { damageType: "fire" });
    expect(troop.thermalShieldHp).toBe(0);
    expect(troop.hp).toBe(81);
    expect(troop.emberBurnUntil).toBe(0);
    stepBattle(session, 5000);
    expect(troop.thermalShieldHp).toBe(6);
  });

  it("aplica o soco no impacto e recebe bônus contra o Cuspidor", () => {
    const phase = { ...CHAPTER_SIX_PHASES[0], waves: [] };
    const session = createBattleSession(phase, ["aresT"], 5, { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } });
    const troop = createTroopEntity(session, "aresT", 0, 6);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "cuspidorBrasa", row: 0 }).enemies[0];
    enemy.x = troop.x + 20;
    stepBattle(session, 1);
    const hpBefore = enemy.hp;
    stepBattle(session, ENEMIES.cuspidorBrasa.attackVisual?.impactMs ? 469 : 469);
    expect(enemy.hp).toBe(hpBefore);
    stepBattle(session, 1);
    expect(enemy.hp).toBe(hpBefore - 9.6);
  });
});
