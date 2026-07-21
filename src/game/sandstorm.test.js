import { describe, expect, it } from "vitest";
import { getSandstormGustVisual, getSandstormVisualIntensity } from "./arenaRenderer.js";
import {
  CELL,
  createBattleSession,
  getSnapshot,
  placeTroop,
  removeTroop,
  spawnEnemy,
  startWave,
  stepBattle,
} from "./battleModel.js";
import { PHASES } from "./content.js";

function createStormBattle(types = Array(5).fill("marine"), phaseIndex = 16) {
  const phase = {
    ...PHASES[phaseIndex],
    energy: 10000,
    supplyLimit: 100,
  };
  const loadout = [...new Set(types)];
  const session = createBattleSession(phase, loadout, 4401);
  types.forEach((type, index) => {
    const result = placeTroop(session, type, index % 5, 1 + Math.floor(index / 5));
    expect(result.ok).toBe(true);
  });
  expect(startWave(session)).toBe(true);
  session.queue = [{ type: "silex", spawnAtMs: Infinity }];
  session.nextSpawnAt = Infinity;
  return session;
}

function triggerStorm(session) {
  session.rng = () => 0;
  const warning = stepBattle(session, 18000);
  expect(warning).toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
  const started = stepBattle(session, session.phase.environmentHazard.warningMs);
  expect(started).toContainEqual(expect.objectContaining({ type: "sandstormStarted" }));
  return started;
}

describe("tempestade de areia", () => {
  it("configura apenas as fases 17 a 24 com progressao por fase", () => {
    expect(PHASES.slice(0, 16).every((phase) => phase.environmentHazard == null)).toBe(true);
    PHASES.slice(16).forEach((phase, index) => {
      expect(phase.environmentHazard).toMatchObject({
        id: "sandstorm",
        baseChance: 0.04 + index * 0.01,
        durationMs: 7000 + index * 400,
        firstCheckDelayMs: 18000,
        checkEveryMs: 12000,
        maxChance: 0.4,
        startGustMs: 1200,
      });
    });
  });

  it("verifica em intervalos fixos e exige cinco tropas", () => {
    const tooSmall = createStormBattle(Array(4).fill("marine"));
    tooSmall.rng = () => 0;
    expect(stepBattle(tooSmall, 18000)).not.toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
    expect(tooSmall.sandstorm.nextCheckAt).toBe(30000);

    const session = createStormBattle();
    expect(stepBattle(session, 17999)).not.toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
    session.rng = () => 0;
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
    expect(session.sandstorm.state).toBe("warning");
  });

  it("rearma sem limite quando a contagem nao diminui e usa um novo baseline", () => {
    const session = createStormBattle();
    triggerStorm(session);
    const firstEndsAt = session.sandstorm.endsAt;
    const recovering = stepBattle(session, session.phase.environmentHazard.durationMs);
    expect(recovering).toContainEqual(expect.objectContaining({
      type: "sandstormRecovering",
      stormNumber: 1,
      troopCountAtStart: 5,
      troopCountAtEnd: 5,
      repeatEligible: true,
      nextCheckAt: firstEndsAt + 12000,
    }));
    stepBattle(session, session.phase.environmentHazard.recoveryMs);
    expect(session.sandstorm.state).toBe("idle");
    expect(session.sandstorm.nextCheckAt - session.elapsed).toBe(10000);
    expect(stepBattle(session, 9999)).not.toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));

    expect(placeTroop(session, "marine", 0, 2).ok).toBe(true);
    const secondStarted = stepBattle(session, session.phase.environmentHazard.warningMs);
    expect(secondStarted).toContainEqual(expect.objectContaining({
      type: "sandstormStarted", stormNumber: 2, troopCountAtStart: 6,
    }));
    expect(session.sandstorm.stormsThisWave).toBe(2);
  });

  it("encerra recorrencias quando a contagem diminui durante a tempestade", () => {
    const session = createStormBattle();
    triggerStorm(session);
    const removed = session.troops[0];
    expect(removeTroop(session, removed.row, removed.col).ok).toBe(true);
    const recovering = stepBattle(session, session.phase.environmentHazard.durationMs);
    expect(recovering).toContainEqual(expect.objectContaining({
      type: "sandstormRecovering",
      troopCountAtStart: 5,
      troopCountAtEnd: 4,
      repeatEligible: false,
      nextCheckAt: Infinity,
    }));
    stepBattle(session, session.phase.environmentHazard.recoveryMs);
    session.rng = () => 0;
    expect(stepBattle(session, 60000)).not.toContainEqual(expect.objectContaining({ type: "sandstormWarning" }));
    expect(getSnapshot(session).sandstorm).toMatchObject({ repeatEligible: false, nextCheckInMs: 0 });
  });

  it("reinicia elegibilidade e telemetria ao comecar outra onda", () => {
    const session = createStormBattle();
    triggerStorm(session);
    session.waveActive = false;
    stepBattle(session, 32);
    expect(session.sandstorm.repeatEligible).toBe(false);
    expect(startWave(session)).toBe(true);
    expect(session.sandstorm).toMatchObject({
      stormsThisWave: 0,
      troopCountAtStart: 0,
      repeatEligible: true,
    });
    expect(session.sandstorm.nextCheckAt).toBe(session.elapsed + 18000);
  });

  it("seleciona afetados de forma deterministica e exclui muralhas do soterramento", () => {
    const first = createStormBattle();
    const second = createStormBattle();
    triggerStorm(first);
    triggerStorm(second);
    const selectedIndexes = (session, ids) => ids.map((id) => session.troops.findIndex((troop) => troop.id === id));
    expect(selectedIndexes(first, first.sandstorm.buriedTroopIds))
      .toEqual(selectedIndexes(second, second.sandstorm.buriedTroopIds));
    expect(selectedIndexes(first, first.sandstorm.slowedTroopIds))
      .toEqual(selectedIndexes(second, second.sandstorm.slowedTroopIds));
    expect(first.sandstorm.buriedTroopIds).toHaveLength(1);
    expect(first.sandstorm.slowedTroopIds).toHaveLength(2);

    const economy = createStormBattle(["reator", "muralhaReforcada", "muralhaReforcada", "muralhaReforcada", "muralhaReforcada"]);
    triggerStorm(economy);
    expect(economy.sandstorm.buriedTroopIds).toEqual([economy.troops[0].id]);
    expect(economy.sandstorm.slowedTroopIds).toEqual([]);
  });

  it("interrompe a acao da tropa soterrada e preserva a celula", () => {
    const session = createStormBattle(["reator", "muralhaReforcada", "muralhaReforcada", "muralhaReforcada", "muralhaReforcada"]);
    triggerStorm(session);
    const reactor = session.troops[0];
    session.energy = 0;
    reactor.energyAccumulator = 5900;
    const events = stepBattle(session, 100);
    expect(events).not.toContainEqual(expect.objectContaining({ type: "energyGenerated", sourceTroopId: reactor.id }));
    expect(reactor.energyAccumulator).toBe(5900);
    expect(session.troops).toContain(reactor);
    expect(reactor.dead).toBe(false);
  });

  it("recupera a cadencia linearmente por dois segundos e limpa ao fim", () => {
    const session = createStormBattle();
    triggerStorm(session);
    const slowed = session.troops.find((troop) => session.sandstorm.slowedTroopIds.includes(troop.id));
    expect(slowed.attackSpeedFactor).toBeCloseTo(0.65, 5);
    expect(stepBattle(session, session.phase.environmentHazard.durationMs))
      .toContainEqual(expect.objectContaining({ type: "sandstormRecovering" }));
    expect(session.sandstorm.state).toBe("recovering");
    stepBattle(session, 1000);
    expect(slowed.attackSpeedFactor).toBeCloseTo(0.825, 3);
    expect(stepBattle(session, 1000)).toContainEqual(expect.objectContaining({ type: "sandstormEnded" }));
    expect(slowed.attackSpeedFactor).toBe(1);
    expect(getSnapshot(session).sandstorm).toMatchObject({
      state: "idle", startsInMs: 0, remainingMs: 0, buriedTroopIds: [], slowedTroopIds: [],
      stormsThisWave: 1, troopCountAtStart: 5, repeatEligible: true, nextCheckInMs: 10000,
    });
  });

  it("remove um tile de alcance apenas na fase ativa", () => {
    const phase = { ...PHASES[16], energy: 1000, supplyLimit: 100 };
    const session = createBattleSession(phase, ["marine"], 5501, { sandbox: true });
    expect(placeTroop(session, "marine", 0, 1).ok).toBe(true);
    const troop = session.troops[0];
    const spawned = spawnEnemy(session, { type: "silex", row: 0 });
    const enemy = spawned.enemies[0];
    enemy.x = troop.x + 5 * CELL.width;
    enemy.previousRenderX = enemy.x;
    enemy.speed = 0;
    session.waveActive = true;
    session.sandstorm.state = "active";
    session.sandstorm.endsAt = Infinity;
    stepBattle(session, 32);
    expect(troop.lastAttackAt).toBe(-Infinity);
    session.sandstorm.state = "idle";
    stepBattle(session, 32);
    expect(troop.lastAttackAt).toBe(session.elapsed);
  });

  it("escala alerta, atividade e dissipacao visual", () => {
    const session = createStormBattle();
    session.sandstorm.state = "warning";
    expect(getSandstormVisualIntensity(session)).toBe(0.45);
    session.sandstorm.state = "active";
    expect(getSandstormVisualIntensity(session)).toBe(1);
    session.sandstorm.state = "recovering";
    session.sandstorm.recoveryStartedAt = session.elapsed;
    session.sandstorm.recoveryEndsAt = session.elapsed + 2000;
    session.elapsed += 1000;
    expect(getSandstormVisualIntensity(session)).toBeCloseTo(0.325, 5);
    session.sandstorm.state = "idle";
    expect(getSandstormVisualIntensity(session)).toBe(0);
  });

  it("limita a rajada inicial por duracao, qualidade adaptativa e movimento reduzido", () => {
    const session = createStormBattle();
    triggerStorm(session);
    expect(getSandstormGustVisual(session, {}, { level: "normal" })).toMatchObject({
      active: true, progress: 0, moving: true, particleScale: 1,
    });
    session.elapsed += 600;
    expect(getSandstormGustVisual(session, {}, { level: "busy" })).toMatchObject({
      active: true, progress: 0.5, moving: true, particleScale: 0.72,
    });
    expect(getSandstormGustVisual(session, { reduceMotion: true }, { level: "stress" })).toMatchObject({
      active: true, moving: false, particleScale: 0.45,
    });
    session.elapsed += 600;
    expect(getSandstormGustVisual(session)).toMatchObject({ active: false, progress: 0 });
  });

  it("limpa os efeitos se a onda terminar antecipadamente", () => {
    const session = createStormBattle();
    triggerStorm(session);
    session.waveActive = false;
    expect(stepBattle(session, 32)).toContainEqual(expect.objectContaining({ type: "sandstormEnded", forced: true }));
    expect(session.sandstorm.state).toBe("idle");
    expect(session.troops.every((troop) => troop.sandBuriedUntil === 0 && troop.attackSpeedFactor === 1)).toBe(true);
  });

  it("remove IDs de tropas mortas ou retiradas do snapshot", () => {
    const session = createStormBattle();
    triggerStorm(session);
    const buried = session.troops.find((troop) => session.sandstorm.buriedTroopIds.includes(troop.id));
    const slowed = session.troops.find((troop) => session.sandstorm.slowedTroopIds.includes(troop.id));
    buried.dead = true;
    expect(removeTroop(session, slowed.row, slowed.col).ok).toBe(true);
    stepBattle(session, 32);
    expect(getSnapshot(session).sandstorm.buriedTroopIds).not.toContain(buried.id);
    expect(getSnapshot(session).sandstorm.slowedTroopIds).not.toContain(slowed.id);
  });
});
