import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  createBattleSession,
  createTroopEntity,
  getSnapshot,
  placeTroop,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";
import {
  isIcaroAirTarget,
  selectIcaroInterceptionTargets,
  selectIcaroTarget,
} from "./interceptadorIcaro.js";
import {
  resetWindCurrentForWave,
  updateWindCurrent,
} from "./windCurrent.js";
import { CELL } from "./visualGeometry.js";

const config = TROOPS.interceptadorIcaro;

function sandbox() {
  return createBattleSession(PHASES[24], ["interceptadorIcaro"], 7401, {
    sandbox: true,
    sandboxSettings: { rulesMode: "free" },
  });
}

function deploy(session, row = 2, col = 2) {
  return placeTroop(session, "interceptadorIcaro", row, col).troop;
}

function addEnemy(session, type, troop, {
  row = troop.row,
  distance = 300,
  variant = null,
  packetId = null,
} = {}) {
  const enemy = spawnEnemy(session, { type, row, variant }).enemies[0];
  enemy.x = troop.x + distance;
  enemy.y = row * CELL.height + CELL.height / 2;
  enemy.previousX = enemy.x;
  enemy.previousRenderX = enemy.x;
  enemy.speed = 0;
  enemy.stunnedUntil = Infinity;
  enemy.packetId = packetId;
  return enemy;
}

function advanceUntil(session, predicate, limitMs = 4000) {
  const events = [];
  for (let elapsed = 0; elapsed < limitMs && !predicate(events); elapsed += 32) {
    events.push(...stepBattle(session, 32));
  }
  return events;
}

describe("Interceptador Ícaro", () => {
  it("centraliza a identidade, atributos e estados sem animação hit", () => {
    expect(config).toMatchObject({
      id: "interceptadorIcaro",
      price: 24,
      supply: 6,
      hp: 30,
      range: 6.5,
      burstCount: 4,
      interceptionMaxTargets: 3,
      windClass: "light",
      ionicImmune: false,
    });
    expect(config.assetStates).not.toContain("hit");
  });

  it("prioriza Nimbarca, Alfa, suporte aéreo e mantém aterrados como aéreos", () => {
    const troop = { row: 2, x: 200, y: 300 };
    const session = {
      enemies: [
        { id: "ground", type: "medu", row: 2, x: 230, hp: 10 },
        { id: "air", type: "voltriz", row: 2, x: 250, hp: 10 },
        { id: "alpha", type: "voltriz", variant: "alpha", row: 2, x: 400, hp: 10 },
        { id: "nim", type: "nimbarca", row: 2, x: 500, hp: 10, temporarilyGrounded: true },
      ],
    };
    expect(selectIcaroTarget(session, troop, config).id).toBe("nim");
    expect(isIcaroAirTarget(session.enemies.at(-1))).toBe(true);
  });

  it("prioriza qualquer voador antes do terrestre e só usa o terrestre sem alvo aéreo", () => {
    const troop = { row: 1, x: 200, y: 180 };
    const ground = { id: "ground", type: "medu", row: 1, x: 220, hp: 10 };
    const air = { id: "air", type: "voltriz", row: 1, x: 500, hp: 10 };
    expect(selectIcaroTarget({ enemies: [ground, air] }, troop, config)).toBe(air);
    expect(selectIcaroTarget({ enemies: [ground] }, troop, config)).toBe(ground);
  });

  it("dispara exatamente quatro tiros nos intervalos configurados e não sobrepõe rajadas", () => {
    const session = sandbox();
    const troop = deploy(session);
    addEnemy(session, "voltriz", troop);
    stepBattle(session, 32);
    const burst = session.projectiles.filter((projectile) => projectile.kind === "icaroBullet");
    expect(burst).toHaveLength(4);
    expect(burst.map((projectile) => projectile.launchAt)).toEqual([32, 132, 232, 332]);
    stepBattle(session, 100);
    expect(session.projectiles.filter((projectile) => projectile.kind === "icaroBullet")).toHaveLength(4);
    expect(troop.attackReadyAt).toBe(2032);
  });

  it.each([
    ["voltriz", 1.3],
    ["medu", 0.5],
  ])("aplica o fator de dano previsto contra %s", (type, factor) => {
    const session = sandbox();
    const troop = deploy(session);
    troop.interceptionReadyAt = Infinity;
    const target = addEnemy(session, type, troop);
    const initialHp = target.hp;
    const events = advanceUntil(
      session,
      (entries) => entries.some((event) => event.type === "icaroBulletImpact"),
    );
    expect(events.filter((event) => event.type === "icaroBulletImpact")).toHaveLength(1);
    expect(initialHp - target.hp).toBeCloseTo(config.damage * factor);
  });

  it("ignora metade da redução do Manto de Tempestade", () => {
    const session = sandbox();
    const troop = deploy(session);
    troop.interceptionReadyAt = Infinity;
    const target = addEnemy(session, "voltriz", troop, { distance: 600, packetId: "p1" });
    addEnemy(session, "nimbarca", troop, { distance: 850, packetId: "p1" });
    const initialHp = target.hp;
    advanceUntil(session, (events) =>
      events.some((event) => event.type === "icaroBulletImpact"), 2500);
    expect(initialHp - target.hp).toBeCloseTo(
      config.damage * config.airborneDamageFactor * 0.9,
    );
  });

  it("retargeteia somente outro voador da mesma rota durante a rajada", () => {
    const session = sandbox();
    const troop = deploy(session);
    troop.interceptionReadyAt = Infinity;
    const first = addEnemy(session, "voltriz", troop, { distance: 260 });
    const sameRoute = addEnemy(session, "voltriz", troop, { distance: 380 });
    addEnemy(session, "nimbarca", troop, { row: 1, distance: 200 });
    stepBattle(session, 32);
    first.dead = true;
    stepBattle(session, 400);
    expect(session.projectiles.filter((projectile) => projectile.kind === "icaroBullet")
      .every((projectile) => !projectile.targetId || projectile.targetId === sameRoute.id)).toBe(true);
  });

  it("Salva trava no máximo três alvos únicos e nunca inclui terrestre", () => {
    const session = sandbox();
    const troop = deploy(session);
    const air = [
      addEnemy(session, "voltriz", troop, { row: 0, distance: 260 }),
      addEnemy(session, "nimbarca", troop, { row: 1, distance: 320 }),
      addEnemy(session, "voltriz", troop, { row: 3, distance: 280, variant: "alpha" }),
      addEnemy(session, "voltriz", troop, { row: 4, distance: 300 }),
    ];
    const ground = addEnemy(session, "medu", troop, { distance: 180 });
    const targets = selectIcaroInterceptionTargets(session, troop, config);
    expect(targets).toHaveLength(1);
    expect(new Set(targets.map((target) => target.id)).size).toBe(1);
    expect(targets).not.toContain(ground);
    expect(targets.every((target) => air.includes(target))).toBe(true);

    troop.attackReadyAt = Infinity;
    stepBattle(session, config.interceptionCooldownMs);
    expect(troop.state).toBe("interceptionLock");
    const fireEvents = [
      ...stepBattle(session, config.interceptionLockVisual.durationMs),
      ...stepBattle(session, config.interceptionShotIntervalMs),
      ...stepBattle(session, config.interceptionShotIntervalMs),
    ];
    const shots = fireEvents.filter((event) =>
      event.type === "shoot" && event.weapon === "icaroInterceptionShot");
    expect(shots).toHaveLength(1);
    expect(new Set(shots.map((event) => event.shotIndex)).size).toBe(1);
  });

  it("paralisia impede o início de novos ataques", () => {
    const session = sandbox();
    const troop = deploy(session);
    addEnemy(session, "voltriz", troop);
    troop.electricParalyzedUntil = 5000;
    stepBattle(session, 1000);
    expect(session.projectiles.filter((projectile) => projectile.troopType === troop.type)).toHaveLength(0);
    expect(troop.lastAttackAt).toBe(-Infinity);
  });

  it("Corrente de Vento desloca o Ícaro por ele ser uma unidade leve sem âncora", () => {
    const phase = {
      ...PHASES[24],
      environmentHazard: {
        ...PHASES[24].environmentHazard,
        minTroops: 1,
        affectedRouteRange: [5, 5],
        directionWeights: { headwind: 1, tailwind: 0, lateral: 0 },
      },
    };
    const session = createBattleSession(phase, ["interceptadorIcaro"], 99, { sandbox: true });
    const troop = createTroopEntity(session, "interceptadorIcaro", 0, 5);
    session.troops.push(troop);
    session.waveActive = true;
    resetWindCurrentForWave(session, phase.environmentHazard);
    session.rng = () => 0;
    const dependencies = { troops: TROOPS, enemies: ENEMIES, isCellReserved: () => false };
    session.elapsed += phase.environmentHazard.firstCheckDelayMs;
    updateWindCurrent(session, [], dependencies);
    session.elapsed += phase.environmentHazard.warningMs;
    updateWindCurrent(session, [], dependencies);
    session.elapsed += phase.environmentHazard.primaryGustDelayMs;
    updateWindCurrent(session, [], dependencies);
    expect(troop.col).toBe(4);
  });

  it("pode ser implantado no Campo de Provas e aparece no snapshot", () => {
    const session = sandbox();
    const result = placeTroop(session, "interceptadorIcaro", 2, 3);
    const snapshot = getSnapshot(session);
    expect(result.ok).toBe(true);
    expect(snapshot.deploymentStats.interceptadorIcaro).toMatchObject({
      activeCount: 1,
      maxDeployed: 5,
    });
  });
});
