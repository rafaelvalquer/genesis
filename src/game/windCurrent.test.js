import { describe, expect, it } from "vitest";
import {
  ARENAS,
  CHAPTERS,
  CHAPTER_FOUR_PHASE_BLUEPRINTS,
  CHAPTER_LOADOUT_LIMITS,
  ENEMIES,
  PHASES,
  TROOPS,
} from "./content.js";
import {
  createBattleSession,
  createTroopEntity,
  getSnapshot,
  spawnEnemy,
} from "./battleModel.js";
import {
  createWindCurrentHazard,
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
} from "./windCurrent.js";
import {
  consumeWindCurrentGraphicsEvents,
  getWindArrowVector,
  getWindCurrentVisualState,
  updateWindCurrentGraphics,
} from "./windCurrentRenderer.js";

const dependencies = { troops: TROOPS, enemies: ENEMIES, isCellReserved: () => false };

function createWindBattle({
  index = 0,
  troopCount = 5,
  direction = "headwind",
  sourceRow = 0,
  verticalDirection = -1,
} = {}) {
  const blueprint = CHAPTER_FOUR_PHASE_BLUEPRINTS[index];
  const phase = {
    ...blueprint,
    waves: [{ enemies: [{ type: "medu", count: 1 }] }],
    environmentHazard: {
      ...blueprint.environmentHazard,
      directionWeights: {
        headwind: direction === "headwind" ? 1 : 0,
        tailwind: direction === "tailwind" ? 1 : 0,
        lateral: direction === "lateral" ? 1 : 0,
      },
    },
  };
  const session = createBattleSession(phase, Object.keys(TROOPS), 101, {
    sandbox: true,
    sandboxSettings: { rulesMode: "free" },
  });
  session.waveActive = true;
  for (let index = 0; index < troopCount; index += 1) {
    session.troops.push(createTroopEntity(
      session,
      index % 2 ? "marine" : "colono",
      index % 5,
      1 + Math.floor(index / 5),
    ));
  }
  resetWindCurrentForWave(session, phase.environmentHazard);
  const rolls = [
    0, // activation
    0, // weighted direction
    sourceRow / 5 + 0.001,
    verticalDirection < 0 ? 0 : 0.999,
  ];
  session.rng = () => rolls.length ? rolls.shift() : 0;
  return session;
}

function advance(session, milliseconds) {
  session.elapsed += milliseconds;
  const events = [];
  updateWindCurrent(session, events, dependencies);
  return events;
}

function beginActive(session) {
  advance(session, session.phase.environmentHazard.firstCheckDelayMs);
  advance(session, session.phase.environmentHazard.warningMs);
}

function applyGust(session) {
  beginActive(session);
  return advance(session, session.phase.environmentHazard.primaryGustDelayMs);
}

describe("conteudo do Capitulo 4", () => {
  it("mantem oito blueprints fora da campanha jogavel", () => {
    expect(CHAPTER_FOUR_PHASE_BLUEPRINTS).toHaveLength(8);
    expect(PHASES).toHaveLength(24);
    expect(CHAPTERS).toHaveLength(3);
    expect(PHASES.some((phase) => phase.chapterId === "chapter_04")).toBe(false);
  });

  it.each([
    [25, 420, 7000, [0.5, 0.4, 0.1], [1, 1]],
    [26, 450, 7400, [0.45, 0.35, 0.2], [1, 1]],
    [27, 480, 7800, [0.4, 0.3, 0.3], [1, 2]],
    [28, 510, 8200, [0.4, 0.25, 0.35], [1, 2]],
    [29, 540, 8600, [0.35, 0.25, 0.4], [1, 2]],
    [30, 570, 9000, [0.35, 0.2, 0.45], [2, 2]],
    [31, 600, 9400, [0.3, 0.2, 0.5], [2, 2]],
    [32, 640, 9800, [0.3, 0.15, 0.55], [2, 2]],
  ])("configura fase %i com energia, duracao, pesos e rotas corretos", (
    phaseNumber, energy, durationMs, weights, routeRange,
  ) => {
    const phase = CHAPTER_FOUR_PHASE_BLUEPRINTS[phaseNumber - 25];
    expect(phase).toMatchObject({
      id: `fase_${phaseNumber}`,
      energy,
      energyMax: energy,
      supplyLimit: 35,
      loadoutLimit: 6,
      baseIntegrity: 100,
      environment: "storm_highlands",
      chapterId: "chapter_04",
    });
    expect(phase.environmentHazard).toMatchObject({
      id: "wind_current",
      durationMs,
      affectedRouteRange: routeRange,
      directionWeights: {
        headwind: weights[0],
        tailwind: weights[1],
        lateral: weights[2],
      },
    });
    expect(ARENAS[phase.id].arenaId).toBe(phase.id);
  });

  it("adiciona o limite de loadout do quarto capitulo", () => {
    expect(CHAPTER_LOADOUT_LIMITS).toEqual({ 1: 4, 2: 5, 3: 6, 4: 6 });
  });

  it("classifica todas as tropas e extensoes inimigas", () => {
    expect(TROOPS.reator.windClass).toBe("structure");
    expect(TROOPS.muralhaReforcada.windClass).toBe("structure");
    expect(TROOPS.lumiUrsa7.windClass).toBe("heavy");
    expect(TROOPS.colossoImpacto.windClass).toBe("heavy");
    expect(Object.values(TROOPS).every((troop) =>
      ["light", "medium", "heavy", "structure"].includes(troop.windClass))).toBe(true);
    expect(Object.values(ENEMIES).every((enemy) =>
      Number.isFinite(enemy.windResistance)
      && typeof enemy.windImmune === "boolean"
      && typeof enemy.canBeWindEjected === "boolean")).toBe(true);
  });
});

describe("agendamento e probabilidade", () => {
  it("cria o estado publico completo em idle", () => {
    expect(createWindCurrentState()).toMatchObject({
      state: "idle",
      nextCheckAt: Infinity,
      currentsThisWave: 0,
      recoveryQueue: [],
      repeatEligible: true,
    });
  });

  it("agenda a primeira checagem em 18 segundos", () => {
    const session = createWindBattle();
    expect(session.windCurrent.nextCheckAt).toBe(18000);
    expect(advance(session, 17999)).toEqual([]);
    expect(session.windCurrent.state).toBe("idle");
  });

  it("agenda outra tentativa 12 segundos depois de uma falha", () => {
    const session = createWindBattle();
    session.rng = () => 0.99;
    expect(advance(session, 18000)).toEqual([]);
    expect(session.windCurrent.nextCheckAt).toBe(30000);
  });

  it("exige cinco tropas acionaveis", () => {
    const session = createWindBattle({ troopCount: 4 });
    expect(advance(session, 18000)).toEqual([]);
    expect(session.windCurrent.state).toBe("idle");
  });

  it.each([
    [0, 5, 0.04],
    [0, 8, 0.145],
    [0, 15, 0.39],
    [7, 15, 0.4],
  ])("aplica chance da fase %i com %i tropas e limite de 40%%", (index, troopCount, expectedChance) => {
    const config = CHAPTER_FOUR_PHASE_BLUEPRINTS[index].environmentHazard;
    const chance = Math.min(config.maxChance,
      config.baseChance + (troopCount - config.minTroops) * config.chancePerExtraTroop);
    expect(chance).toBeCloseTo(expectedChance);
  });

  it("usa o RNG da sessao para ativar e sortear", () => {
    const session = createWindBattle();
    let calls = 0;
    session.rng = () => { calls += 1; return 0; };
    advance(session, 18000);
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(session.windCurrent.state).toBe("warning");
  });
});

describe("ciclo e direcoes", () => {
  it("mantem warning por 2,5 segundos", () => {
    const session = createWindBattle();
    expect(advance(session, 18000)).toContainEqual(expect.objectContaining({ type: "windCurrentWarning" }));
    advance(session, 2499);
    expect(session.windCurrent.state).toBe("warning");
    expect(advance(session, 1)).toContainEqual(expect.objectContaining({ type: "windCurrentStarted" }));
  });

  it.each(["headwind", "tailwind", "lateral"])("sorteia somente a direcao habilitada %s", (direction) => {
    const session = createWindBattle({ direction });
    advance(session, 18000);
    expect(session.windCurrent.direction).toBe(direction);
  });

  it("seleciona rotas distintas conforme o intervalo da fase", () => {
    const session = createWindBattle({ index: 7 });
    advance(session, 18000);
    expect(session.windCurrent.selectedRows).toHaveLength(2);
    expect(new Set(session.windCurrent.selectedRows).size).toBe(2);
  });

  it("define origem, destino e direcao vertical lateral", () => {
    const session = createWindBattle({ direction: "lateral", sourceRow: 2, verticalDirection: 1 });
    advance(session, 18000);
    expect(session.windCurrent).toMatchObject({
      sourceRow: 2,
      targetRow: 3,
      verticalDirection: 1,
      selectedRows: [2],
    });
  });

  it("aplica o Impulso Principal apenas uma vez", () => {
    const session = createWindBattle();
    beginActive(session);
    const first = advance(session, 1200);
    const second = advance(session, 1200);
    expect(first.filter((event) => event.type === "windPrimaryGust")).toHaveLength(1);
    expect(second.filter((event) => event.type === "windPrimaryGust")).toHaveLength(0);
  });

  it("entra em recovering e encerra em dois segundos", () => {
    const session = createWindBattle();
    beginActive(session);
    const recovering = advance(session, session.phase.environmentHazard.durationMs);
    expect(recovering).toContainEqual(expect.objectContaining({ type: "windCurrentRecovering" }));
    expect(session.windCurrent.state).toBe("recovering");
    advance(session, 1999);
    expect(session.windCurrent.state).toBe("recovering");
    expect(advance(session, 1)).toContainEqual(expect.objectContaining({ type: "windCurrentEnded" }));
  });
});

describe("deslocamento de tropas", () => {
  it("vento contrario recua uma tropa e preserva energia e supply", () => {
    const session = createWindBattle({ troopCount: 5 });
    session.phase.environmentHazard.affectedRouteRange = [5, 5];
    const troop = session.troops[0];
    troop.col = 5; troop.x = 550;
    const energy = session.energy;
    const supply = session.supply;
    applyGust(session);
    expect(troop.col).toBe(4);
    expect(session.energy).toBe(energy);
    expect(session.supply).toBe(supply);
  });

  it("vento favoravel nao desloca tropas", () => {
    const session = createWindBattle({ direction: "tailwind" });
    const positions = session.troops.map((troop) => [troop.row, troop.col]);
    applyGust(session);
    expect(session.troops.map((troop) => [troop.row, troop.col])).toEqual(positions);
  });

  it("estruturas nao participam do sorteio lateral", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 2, verticalDirection: 1 });
    session.troops.push(createTroopEntity(session, "reator", 2, 3));
    session.troops.push(createTroopEntity(session, "muralhaReforcada", 2, 4));
    session.phase.environmentHazard.minTroops = 2;
    applyGust(session);
    expect(session.troops.every((troop) => troop.row === 2)).toBe(true);
  });

  it("movimento lateral mantem a coluna", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 2, verticalDirection: 1 });
    const troop = createTroopEntity(session, "sniper", 2, 5);
    session.troops.push(troop, createTroopEntity(session, "marine", 0, 1),
      createTroopEntity(session, "marine", 1, 1), createTroopEntity(session, "marine", 3, 1),
      createTroopEntity(session, "marine", 4, 1));
    applyGust(session);
    expect(troop).toMatchObject({ row: 3, col: 5 });
  });

  it("abre destino ocupado com cadeia para frente", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 1, verticalDirection: 1 });
    const shifted = createTroopEntity(session, "sniper", 1, 5);
    const first = createTroopEntity(session, "marine", 2, 5);
    const second = createTroopEntity(session, "marine", 2, 6);
    session.troops.push(shifted, first, second,
      createTroopEntity(session, "marine", 0, 1), createTroopEntity(session, "marine", 3, 1));
    const events = applyGust(session);
    expect([shifted.row, shifted.col]).toEqual([2, 5]);
    expect(first.col).toBe(6);
    expect(second.col).toBe(7);
    expect(events.filter((event) => event.type === "windTroopChainShifted")).toHaveLength(2);
  });

  it.each(["muralhaReforcada", "reator"])("estrutura %s bloqueia a cadeia", (structure) => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 1, verticalDirection: 1 });
    const shifted = createTroopEntity(session, "sniper", 1, 5);
    session.troops.push(shifted, createTroopEntity(session, "marine", 2, 5),
      createTroopEntity(session, structure, 2, 6),
      createTroopEntity(session, "marine", 0, 1), createTroopEntity(session, "marine", 3, 1));
    applyGust(session);
    expect(shifted.row).toBe(1);
  });

  it("falta de espaco cancela o deslocamento", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 1, verticalDirection: 1 });
    const shifted = createTroopEntity(session, "sniper", 1, 5);
    session.troops.push(shifted);
    for (let col = 5; col <= 9; col += 1) session.troops.push(createTroopEntity(session, "marine", 2, col));
    applyGust(session);
    expect(shifted.row).toBe(1);
  });
});

describe("inimigos e Queda de Emergencia", () => {
  it.each([
    ["headwind", -1],
    ["tailwind", 1],
  ])("%s empurra inimigos 0,75 tile na direcao correta", (direction, sign) => {
    const session = createWindBattle({ direction });
    session.phase.environmentHazard.affectedRouteRange = [5, 5];
    const { enemies } = spawnEnemy(session, { type: "medu", row: 0 });
    const enemy = enemies[0];
    enemy.x = 700;
    applyGust(session);
    expect(enemy.x).toBeCloseTo(700 + sign * 75);
  });

  it("move somente uma proporcao de inimigos laterais e preserva x", () => {
    const session = createWindBattle({ direction: "lateral", sourceRow: 2, verticalDirection: 1 });
    const { enemies } = spawnEnemy(session, { type: "medu", row: 2, count: 10 });
    const xs = new Map(enemies.map((enemy) => [enemy.id, enemy.x]));
    applyGust(session);
    const moved = enemies.filter((enemy) => enemy.row === 3);
    expect(moved.length).toBeGreaterThanOrEqual(2);
    expect(moved.length).toBeLessThanOrEqual(4);
    moved.forEach((enemy) => expect(enemy.x).toBe(xs.get(enemy.id)));
  });

  it("expulsa inimigo terrestre sem conceder energia ou eliminacao", () => {
    const session = createWindBattle({ direction: "lateral", sourceRow: 0, verticalDirection: -1 });
    const { enemies: [enemy] } = spawnEnemy(session, { type: "medu", row: 0 });
    const energy = session.energy;
    const killed = session.killed;
    const events = applyGust(session);
    expect(enemy).toMatchObject({ dead: true, removedByWind: true });
    expect(events).toContainEqual(expect.objectContaining({ type: "windEnemyEjected" }));
    expect(session.energy).toBe(energy);
    expect(session.killed).toBe(killed);
  });

  it("inimigo voador resiste a expulsao", () => {
    const airborneType = Object.values(ENEMIES).find((enemy) => enemy.airborne)?.id;
    expect(airborneType).toBeTruthy();
    const session = createWindBattle({ direction: "lateral", sourceRow: 0, verticalDirection: -1 });
    const { enemies: [enemy] } = spawnEnemy(session, { type: airborneType, row: 0 });
    applyGust(session);
    expect(enemy.dead).toBe(false);
    expect(enemy.row).toBe(0);
  });

  it("tropa expulsa permanece viva, no supply e sofre 25 por cento de dano", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 0, verticalDirection: -1 });
    const troop = createTroopEntity(session, "sniper", 0, 5);
    session.troops.push(troop, createTroopEntity(session, "marine", 1, 1),
      createTroopEntity(session, "marine", 2, 1), createTroopEntity(session, "marine", 3, 1),
      createTroopEntity(session, "marine", 4, 1));
    const hp = troop.hp;
    const supply = session.supply;
    applyGust(session);
    expect(troop.dead).toBe(false);
    expect(troop.windRecovery).toBe(true);
    expect(troop.hp).toBeCloseTo(hp - troop.maxHp * 0.25);
    expect(session.supply).toBe(supply);
  });

  it("retorna depois de oito segundos priorizando a celula original", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 0, verticalDirection: -1 });
    const troop = createTroopEntity(session, "sniper", 0, 5);
    session.troops.push(troop, createTroopEntity(session, "marine", 1, 1),
      createTroopEntity(session, "marine", 2, 1), createTroopEntity(session, "marine", 3, 1),
      createTroopEntity(session, "marine", 4, 1));
    applyGust(session);
    const events = advance(session, 8000);
    expect(troop).toMatchObject({ windRecovery: false, row: 0, col: 5 });
    expect(events).toContainEqual(expect.objectContaining({ type: "windEmergencyReturn" }));
  });

  it("procura celula alternativa e aguarda quando todas estao ocupadas", () => {
    const session = createWindBattle({ troopCount: 0, direction: "lateral", sourceRow: 0, verticalDirection: -1 });
    const troop = createTroopEntity(session, "sniper", 0, 5);
    session.troops.push(troop, createTroopEntity(session, "marine", 1, 1),
      createTroopEntity(session, "marine", 2, 1), createTroopEntity(session, "marine", 3, 1),
      createTroopEntity(session, "marine", 4, 1));
    applyGust(session);
    session.troops.push(createTroopEntity(session, "marine", 0, 5));
    advance(session, 8000);
    expect(troop.windRecovery).toBe(false);
    expect(troop.col).not.toBe(5);
  });
});

describe("repeticao, snapshot e visual", () => {
  it.each([
    [10, 1, true],
    [9, 1, false],
  ])("avalia tolerancia de 10%% com %i tropas e %i perda", (count, losses, eligible) => {
    const session = createWindBattle({ troopCount: count });
    beginActive(session);
    session.troops.slice(0, losses).forEach((troop) => { troop.dead = true; });
    advance(session, session.phase.environmentHazard.durationMs);
    expect(session.windCurrent.repeatEligible).toBe(eligible);
  });

  it("Queda de Emergencia nao conta como perda", () => {
    const session = createWindBattle({ troopCount: 5 });
    beginActive(session);
    session.troops[0].windRecovery = true;
    session.troops[0].row = -1;
    advance(session, session.phase.environmentHazard.durationMs);
    expect(session.windCurrent.troopLossCount).toBe(0);
    expect(session.windCurrent.repeatEligible).toBe(true);
  });

  it("encerra de forma forcada ao fim da onda", () => {
    const session = createWindBattle();
    advance(session, 18000);
    const events = [];
    expect(endWindCurrent(session, events, true)).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: "windCurrentEnded", forced: true }));
    expect(session.windCurrent.state).toBe("idle");
  });

  it("expoe telemetria completa no snapshot", () => {
    const session = createWindBattle();
    advance(session, 18000);
    expect(getSnapshot(session).windCurrent).toMatchObject({
      state: "warning",
      direction: "headwind",
      startsInMs: 2500,
      currentsThisWave: 0,
      repeatEligible: true,
    });
  });

  it.each([
    ["headwind", "←"],
    ["tailwind", "→"],
    ["lateral-up", "↑"],
    ["lateral-down", "↓"],
  ])("mantem a seta direcional %s mesmo em qualidade baixa", (kind, glyph) => {
    const state = kind.startsWith("lateral")
      ? { direction: "lateral", verticalDirection: kind.endsWith("up") ? -1 : 1 }
      : { direction: kind };
    expect(getWindArrowVector(state).glyph).toBe(glyph);
  });

  it("reduz intensidade durante recovering", () => {
    const session = createWindBattle();
    session.windCurrent.state = "recovering";
    session.windCurrent.recoveryStartedAt = 1000;
    session.windCurrent.recoveryEndsAt = 3000;
    expect(getWindCurrentVisualState(session, 1000).intensity).toBe(1);
    expect(getWindCurrentVisualState(session, 2000).intensity).toBe(0.5);
    expect(getWindCurrentVisualState(session, 3000).intensity).toBe(0);
  });

  it("registra e expira efeitos graficos dos eventos", () => {
    const runtime = {};
    consumeWindCurrentGraphicsEvents(runtime, [
      { type: "windPrimaryGust" },
      { type: "windEmergencyReturn", x: 100, y: 100, durationMs: 650 },
    ], 1000);
    expect(runtime.windEffects).toHaveLength(2);
    updateWindCurrentGraphics(runtime, 2000);
    expect(runtime.windEffects).toHaveLength(0);
  });
});
