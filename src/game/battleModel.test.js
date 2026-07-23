import { describe, expect, it } from "vitest";
import { DECISIONS, ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  activateTroopSpecial, CELL, clearSandboxEntities, createBattleSession, DEMATERIALIZATION_PULSE, FIELD, getEffectiveTroopStats, getSnapshot, placeTroop, removeTroop,
  selectDecision, setEnergyPickupPointer, setSandboxSettings, spawnEnemy, startWave, stepBattle,
  trySpawnEnergyPickup, trySpawnGlassEcho,
} from "./battleModel.js";
import { getEnemyHitPoint, getMuzzleWorldPosition } from "./visualGeometry.js";

const meleeTarget = (x = 304, row = 0) => ({
  id: `melee_target_${row}_${x}`, type: "medu", row, x, y: row * 120 + 60,
  hp: 100, maxHp: 100, speed: 0, damage: 0, attackReadyAt: Infinity,
  slowUntil: 0, slowFactor: 1, baseDamage: 0, bossPhase: 0, dead: false,
});

describe("Corte de Arco do Vórtice", () => {
  it("mantém o projétil preso ao alvo e conserva o impacto por 360 ms", () => {
    const session = createBattleSession(PHASES[0], ["executorArco"], 7331, { sandbox: true });
    const troop = placeTroop(session, "executorArco", 1, 2).troop;
    const target = {
      ...meleeTarget(troop.x + 1.8 * CELL.width, troop.row),
      id: "arc_target",
      y: troop.y,
    };
    session.enemies = [target];

    stepBattle(session, 1);
    const projectile = session.projectiles[0];
    expect(projectile).toMatchObject({
      kind: "executorArcSlash", phase: "flying", targetId: target.id,
      launched: false, vx: TROOPS.executorArco.rangedProjectileSpeed,
    });
    const launchEvents = stepBattle(session, TROOPS.executorArco.rangedAttackVisual.releaseMs);
    expect(launchEvents).toContainEqual(expect.objectContaining({
      type: "shoot", weapon: "executorArcSlash",
    }));
    const impactEvents = stepBattle(session, 250);
    expect(target.hp).toBe(96);
    expect(projectile.phase).toBe("impact");
    expect(projectile.phaseAgeMs).toBeGreaterThanOrEqual(0);
    expect([...launchEvents, ...impactEvents]).toContainEqual(expect.objectContaining({
      type: "executorArcSlashImpact", targetId: target.id,
    }));
    const impactRemaining = projectile.impactStartedAt + 360 - session.elapsed;
    stepBattle(session, impactRemaining - 1);
    expect(session.projectiles).toContain(projectile);
    stepBattle(session, 1);
    expect(session.projectiles).not.toContain(projectile);
  });
});

describe("Pulso de Desmaterializacao", () => {
  it("reserva a nova coluna e inicia um dispositivo pronto por rota", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 1201);
    expect(FIELD).toMatchObject({
      width: 1100,
      cols: 11,
      defenseCol: 0,
      firstTroopCol: 1,
      lastTroopCol: 9,
      enemyEntryCol: 10,
    });
    expect(placeTroop(session, "marine", 0, 0)).toMatchObject({ ok: false });
    for (let col = 1; col <= 9; col += 1) {
      const sandbox = createBattleSession(PHASES[0], ["marine"], 1201 + col, { sandbox: true });
      expect(placeTroop(sandbox, "marine", 0, col).ok).toBe(true);
    }
    expect(session.dematerializationPulses).toHaveLength(5);
    expect(getSnapshot(session).dematerializationPulses).toEqual(
      session.dematerializationPulses.map((pulse) => ({ ...pulse })),
    );
    expect(session.dematerializationPulses.every((pulse) => pulse.state === "ready")).toBe(true);
  });

  it("bloqueia a rota durante a carga e desintegra todos os tipos somente nela", () => {
    const session = createBattleSession(PHASES[5], [], 1207, {
      sandbox: true,
      sandboxSettings: { invulnerableBase: false, enemySpeedMultiplier: 0 },
    });
    session.rng = () => 0;
    const common = spawnEnemy(session, { type: "estilha", row: 2 }).enemies[0];
    common.x = FIELD.baseX;
    common.isEcho = true;
    const alpha = spawnEnemy(session, { type: "obsidonte", row: 2, variant: "alpha" }).enemies[0];
    alpha.x = 700;
    alpha.shield = 999;
    alpha.shieldMax = 999;
    alpha.invulnerableUntil = Infinity;
    const airborne = spawnEnemy(session, { type: "magoAbissal", row: 2 }).enemies[0];
    airborne.x = 980;
    const otherLane = spawnEnemy(session, { type: "medu", row: 3 }).enemies[0];
    otherLane.x = 600;

    const chargingEvents = stepBattle(session, 32);
    expect(chargingEvents).toContainEqual(expect.objectContaining({
      type: "pulseCharging",
      row: 2,
      fireAt: DEMATERIALIZATION_PULSE.chargeDurationMs + 32,
    }));
    expect(session.dematerializationPulses[2].state).toBe("charging");
    expect(session.integrity).toBe(session.integrityMax);

    const waiting = spawnEnemy(session, { type: "medu", row: 2 }).enemies[0];
    waiting.x = FIELD.baseX;
    stepBattle(session, DEMATERIALIZATION_PULSE.chargeDurationMs - 1);
    expect(waiting.x).toBe(FIELD.baseX);
    expect(session.integrity).toBe(session.integrityMax);

    const firedEvents = stepBattle(session, 1);
    expect(firedEvents).toContainEqual(expect.objectContaining({ type: "pulseFired", row: 2 }));
    expect(firedEvents.filter((event) => event.type === "enemyDisintegrated")).toHaveLength(4);
    expect(session.enemies).toEqual([otherLane]);
    expect(session.energyPickups).toHaveLength(0);
    expect(session.dematerializationPulses[2].state).toBe("spent");
  });

  it("permite dano normal depois do uso e nao ativa fora de batalha", () => {
    const session = createBattleSession(PHASES[0], [], 1208, {
      sandbox: true,
      sandboxSettings: { invulnerableBase: false, enemySpeedMultiplier: 0 },
    });
    session.dematerializationPulses[0].state = "spent";
    const breach = spawnEnemy(session, { type: "medu", row: 0 }).enemies[0];
    breach.x = FIELD.baseX;
    stepBattle(session, 1);
    expect(session.integrity).toBe(session.integrityMax - ENEMIES.medu.baseDamage);

    const preparing = createBattleSession(PHASES[0], [], 1209);
    preparing.enemies.push({ ...meleeTarget(FIELD.baseX, 1), baseDamage: 10 });
    expect(stepBattle(preparing, 32)).toEqual([]);
    expect(preparing.dematerializationPulses[1].state).toBe("ready");
  });
});

describe("esferas coletáveis de energia", () => {
  const glassTypes = ["estilha", "vitrarca", "obsidonte", "refrator", "crisalio"];
  const phase = { ...PHASES[0], id: "teste_esferas", waves: [] };
  const source = (type = "estilha", overrides = {}) => ({
    id: `source_${type}`, type, x: 420, y: 180, row: 1, ...overrides,
  });

  it("configura somente os cinco predadores do Mar de Vidro com 15%", () => {
    expect(glassTypes.map((type) => ENEMIES[type].energyDropChance)).toEqual([0.15, 0.15, 0.15, 0.15, 0.15]);
    expect(ENEMIES.magoAbissal.energyDropChance).toBeUndefined();
  });

  it("respeita a fronteira exata do RNG e cria uma única esfera por rolagem", () => {
    const success = createBattleSession(phase, [], 1, { sandbox: true });
    success.rng = () => 0.149999;
    const events = [];
    expect(trySpawnEnergyPickup(success, source(), events)).toMatchObject({ amount: 1, x: 420, y: 152 });
    expect(success.energyPickups).toHaveLength(1);
    expect(events).toEqual([expect.objectContaining({ type: "energyDropSpawned", amount: 1 })]);

    const boundary = createBattleSession(phase, [], 2, { sandbox: true });
    boundary.rng = () => 0.15;
    expect(trySpawnEnergyPickup(boundary, source())).toBeNull();
    expect(boundary.energyPickups).toHaveLength(0);
  });

  it("aceita monstros normais e Ecos de Vidro, mas rejeita Alfas e outros inimigos", () => {
    for (const type of glassTypes) {
      const session = createBattleSession(phase, [], 3, { sandbox: true });
      session.rng = () => 0;
      expect(trySpawnEnergyPickup(session, source(type))).not.toBeNull();
      expect(trySpawnEnergyPickup(session, source(type, { isEcho: true }))).not.toBeNull();
      expect(trySpawnEnergyPickup(session, source(type, { variant: "alpha" }))).toBeNull();
    }
    const other = createBattleSession(phase, [], 4, { sandbox: true });
    other.rng = () => 0;
    expect(trySpawnEnergyPickup(other, source("magoAbissal"))).toBeNull();
  });

  it("atrai dentro de 140 px, não acelera fora do raio e coleta a 24 px", () => {
    const inside = createBattleSession(phase, [], 5, { sandbox: true });
    inside.energyPickups = [{ id: "inside", x: 200, y: 200, vx: 0, vy: 0, amount: 1, ageMs: 0, phase: 0 }];
    setEnergyPickupPointer(inside, { x: 300, y: 200 });
    stepBattle(inside, 32);
    expect(inside.energyPickups[0].x).toBeGreaterThan(200);

    const outside = createBattleSession(phase, [], 6, { sandbox: true });
    outside.energyPickups = [{ id: "outside", x: 200, y: 200, vx: 0, vy: 0, amount: 1, ageMs: 0, phase: 0 }];
    setEnergyPickupPointer(outside, { x: 341, y: 200 });
    stepBattle(outside, 32);
    expect(outside.energyPickups[0]).toMatchObject({ x: 200, y: 200, vx: 0, vy: 0 });

    const collect = createBattleSession(phase, [], 7, { sandbox: true });
    collect.energy = collect.energyMax - 1;
    collect.energyPickups = [{ id: "collect", x: 200, y: 200, vx: 0, vy: 0, amount: 1, ageMs: 0, phase: 0 }];
    setEnergyPickupPointer(collect, { x: 223, y: 200 });
    const events = stepBattle(collect, 32);
    expect(collect.energy).toBe(collect.energyMax);
    expect(collect.energyPickups).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "energyCollected", amount: 1 }));
  });

  it("permanece quando a energia está cheia, expira em 10s e pausa durante decisões", () => {
    const full = createBattleSession(phase, [], 8, { sandbox: true });
    full.energyPickups = [{ id: "full", x: 200, y: 200, vx: 0, vy: 0, amount: 1, ageMs: 0, phase: 0 }];
    setEnergyPickupPointer(full, { x: 200, y: 200 });
    expect(stepBattle(full, 32)).not.toContainEqual(expect.objectContaining({ type: "energyCollected" }));
    expect(full.energyPickups).toHaveLength(1);

    full.pendingDecision = [{ id: "pause" }];
    const pausedAge = full.energyPickups[0].ageMs;
    stepBattle(full, 5000);
    expect(full.energyPickups[0].ageMs).toBe(pausedAge);

    full.pendingDecision = null;
    full.energyPickupPointer = null;
    stepBattle(full, 9968);
    expect(full.energyPickups).toHaveLength(0);
  });

  it("limpa esferas e posição do ponteiro ao limpar ou reiniciar a sessão", () => {
    const session = createBattleSession(phase, [], 9, { sandbox: true });
    session.energyPickups = [{ id: "clear", x: 100, y: 100, vx: 0, vy: 0, amount: 1, ageMs: 0, phase: 0 }];
    setEnergyPickupPointer(session, { x: 100, y: 100 });
    clearSandboxEntities(session);
    expect(session.energyPickups).toEqual([]);
    expect(session.energyPickupPointer).toBeNull();
    expect(createBattleSession(phase, [], 10).energyPickups).toEqual([]);
  });
});

describe("Artilheira de Morteiro", () => {
  const phase = { ...PHASES[8], id: "teste_morteiro", waves: [] };
  const targetAt = (id, col, row = 0, xOffset = 10) => ({
    ...meleeTarget(col * FIELD.width / 10 + xOffset, row),
    id, hp: 100, maxHp: 100, scale: 1,
  });

  function createMortarSession(enemies) {
    const session = createBattleSession(phase, ["artilheiraMorteiro"], 1201, { sandbox: true });
    placeTroop(session, "artilheiraMorteiro", 0, 1);
    session.enemies = enemies;
    return session;
  }

  it("ignora a zona próxima e alvos além da sexta célula", () => {
    const session = createMortarSession([
      targetAt("near_1", 2),
      targetAt("near_2", 3),
      targetAt("far_7", 8),
      targetAt("other_lane", 4, 1),
    ]);
    stepBattle(session, 32);
    expect(session.projectiles).toHaveLength(0);
  });

  it("seleciona o tile elegível mais populoso e causa 100%/30% de dano", () => {
    const primary = targetAt("primary", 4, 0, 10);
    const collateral = targetAt("collateral", 4, 0, 35);
    const sparse = targetAt("sparse", 7, 0, 10);
    const session = createMortarSession([primary, collateral, sparse]);

    stepBattle(session, 1);
    expect(session.projectiles[0]).toMatchObject({
      kind: "mortar", targetId: primary.id, targetRow: 0, targetCol: 4,
      launched: false,
    });
    stepBattle(session, 480);
    expect(session.projectiles[0].launched).toBe(true);
    stepBattle(session, TROOPS.artilheiraMorteiro.projectileFlightMs);

    expect(primary.hp).toBeCloseTo(100 - TROOPS.artilheiraMorteiro.damage);
    expect(collateral.hp).toBeCloseTo(
      100 - TROOPS.artilheiraMorteiro.damage * TROOPS.artilheiraMorteiro.collateralMultiplier,
    );
    expect(sparse.hp).toBe(100);
  });

  it("mantém a trajetória balística presa ao tile escolhido", () => {
    const target = targetAt("arc_target", 7);
    const session = createMortarSession([target]);
    stepBattle(session, 1);
    stepBattle(session, 480);
    const projectile = session.projectiles[0];
    const initialTarget = { x: projectile.targetX, y: projectile.targetY };
    stepBattle(session, TROOPS.artilheiraMorteiro.projectileFlightMs / 2);
    expect(projectile.y).toBeLessThan(Math.min(projectile.origin.y, initialTarget.y));
    target.x = 250;
    stepBattle(session, TROOPS.artilheiraMorteiro.projectileFlightMs / 2);
    expect(projectile.targetX).toBe(initialTarget.x);
    expect(projectile.targetY).toBe(initialTarget.y);
    expect(target.hp).toBe(100);
  });
});

describe("Colosso de Impacto", () => {
  const phase = { ...PHASES[9], id: "teste_colosso", waves: [], energy: 200, supplyLimit: 30 };
  const tileEnemy = (id, x = 190, row = 0) => ({ ...meleeTarget(x, row), id, hp: 50, maxHp: 50, scale: 1, stunnedUntil: 0 });

  function createColossusSession(enemies = []) {
    const session = createBattleSession(phase, ["colossoImpacto"], 881, { sandbox: true });
    const result = placeTroop(session, "colossoImpacto", 0, 1);
    session.enemies = enemies;
    return { session, troop: result.troop };
  }

  it("tem estatisticas, recarga de implantacao e limite simultaneo previstos", () => {
    expect(TROOPS.colossoImpacto).toMatchObject({ hp: 180, price: 22, supply: 8, deployCooldownMs: 10000, maxDeployed: 2, range: 0.9, unlockAt: 9 });
    const session = createBattleSession(phase, ["colossoImpacto"], 882);
    expect(placeTroop(session, "colossoImpacto", 0, 1).ok).toBe(true);
    expect(placeTroop(session, "colossoImpacto", 1, 1).ok).toBe(true);
    expect(placeTroop(session, "colossoImpacto", 2, 1)).toMatchObject({ ok: false });
    const cooldownSession = createBattleSession(phase, ["colossoImpacto"], 883);
    cooldownSession.waveActive = true;
    const deployed = placeTroop(cooldownSession, "colossoImpacto", 0, 1);
    expect(cooldownSession.deployCooldowns.colossoImpacto).toBe(TROOPS.colossoImpacto.deployCooldownMs);
    expect(deployed.troop.specialReadyAt).toBe(TROOPS.colossoImpacto.specialEveryMs);
  });

  it("causa dano no quadro de impacto a todos no campo de ataque, incluindo aereos", () => {
    const { session, troop } = createColossusSession();
    const first = tileEnemy("first", troop.x - CELL.width / 2);
    const forwardEdge = { ...tileEnemy("forward_edge", troop.x + TROOPS.colossoImpacto.range * CELL.width), airborne: true };
    const outside = tileEnemy("outside", forwardEdge.x + 1);
    const otherLane = tileEnemy("other_lane", troop.x, 1);
    session.enemies = [first, forwardEdge, outside, otherLane];
    stepBattle(session, 1);
    expect(first.hp).toBe(50);
    stepBattle(session, 399);
    expect(first.hp).toBe(50);
    stepBattle(session, 1);
    expect(first.hp).toBe(45);
    expect(forwardEdge.hp).toBe(45);
    expect(outside.hp).toBe(50);
    expect(otherLane.hp).toBe(50);
  });

  it("mantem o especial carregado sem disparar automaticamente e exige uma onda ativa", () => {
    const target = tileEnemy("normal_target");
    const { session, troop } = createColossusSession([target]);
    troop.specialReadyAt = 0;
    stepBattle(session, 1);
    expect(troop.lastAttackMode).toBe("normal");
    expect(troop.specialReadyAt).toBe(0);
    expect(activateTroopSpecial(session, troop.id)).toMatchObject({ ok: false });
    session.waveActive = true;
    expect(activateTroopSpecial(session, troop.id)).toMatchObject({ ok: true, queued: true });
    expect(troop.specialReadyAt).toBe(Infinity);
  });

  it("executa o especial manual mesmo sem alvo e atordoa somente no quadro de impacto", () => {
    const { session, troop } = createColossusSession();
    session.waveActive = true;
    troop.specialReadyAt = 0;
    expect(activateTroopSpecial(session, troop.id)).toMatchObject({ ok: true, queued: false });
    stepBattle(session, 1);
    expect(troop.lastAttackMode).toBe("special");
    expect(troop.specialReadyAt).toBe(session.elapsed + TROOPS.colossoImpacto.specialEveryMs);
    stepBattle(session, 640);
    expect(troop.pendingImpact).toBeNull();

    const target = tileEnemy("special_target", troop.x - CELL.width / 2);
    const forwardEdge = tileEnemy("special_forward_edge", troop.x + TROOPS.colossoImpacto.range * CELL.width);
    const outside = tileEnemy("special_outside", forwardEdge.x + 1);
    session.enemies.push(target, forwardEdge, outside);
    troop.specialReadyAt = session.elapsed;
    expect(activateTroopSpecial(session, troop.id)).toMatchObject({ ok: true });
    stepBattle(session, 1280);
    expect(target.hp).toBe(50);
    stepBattle(session, 640);
    expect(target.hp).toBe(36);
    expect(forwardEdge.hp).toBe(36);
    expect(outside.hp).toBe(50);
    expect(target.stunnedUntil - session.elapsed).toBe(800);
    expect(forwardEdge.stunnedUntil - session.elapsed).toBe(800);
  });
});

describe("Ecos de Vidro", () => {
  const source = { id: "source_1", type: "medu", row: 2, x: 640, y: 300, isEcho: false, variant: null };

  it("retorna um hostil comum com os modificadores previstos", () => {
    const session = createBattleSession(PHASES[8], ["colono"], 100);
    session.rng = () => 0;
    const events = [];
    const echo = trySpawnGlassEcho(session, source, events);
    expect(echo).toMatchObject({ type: "medu", row: 2, x: 640, y: 300, isEcho: true, echoSourceId: "source_1" });
    expect(echo.maxHp).toBe(ENEMIES.medu.hp * 0.45);
    expect(echo.speed).toBe(ENEMIES.medu.speed * 1.2);
    expect(echo.damage).toBe(ENEMIES.medu.damage * 0.6);
    expect(echo.baseDamage).toBe(ENEMIES.medu.baseDamage * 0.6);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "echoSpawn", sourceId: "source_1" });
  });

  it("não recursa, não copia Alfas e limita doze ecos simultâneos", () => {
    const session = createBattleSession(PHASES[15], ["colono"], 101);
    session.rng = () => 0;
    expect(trySpawnGlassEcho(session, { ...source, isEcho: true }, [])).toBeNull();
    expect(trySpawnGlassEcho(session, { ...source, variant: "alpha" }, [])).toBeNull();
    session.enemies = Array.from({ length: 12 }, (_, index) => ({ ...source, id: `echo_${index}`, isEcho: true, dead: false }));
    expect(trySpawnGlassEcho(session, source, [])).toBeNull();
  });

  it("usa o RNG determinístico da sessão", () => {
    const first = createBattleSession(PHASES[15], ["colono"], 771);
    const second = createBattleSession(PHASES[15], ["colono"], 771);
    const run = (session) => Array.from({ length: 20 }, (_, index) => Boolean(trySpawnGlassEcho(session, { ...source, id: `source_${index}`, x: 700 - index }, [])));
    expect(run(first)).toEqual(run(second));
  });
});

describe("Crisálio e Manto Prismático", () => {
  const sandboxPhase = { ...PHASES[12], id: "teste_crisalio", waves: [] };

  function createMantleSession() {
    return createBattleSession(sandboxPhase, ["colono", "marine", "sniper"], 902, { sandbox: true });
  }

  it("pulsa após sete segundos e protege somente os quatro monstros permitidos em todas as rotas", () => {
    const session = createMantleSession();
    spawnEnemy(session, { type: "crisalio", row: 0 });
    const affected = ["estilha", "vitrarca", "obsidonte", "refrator"].map((type, row) => (
      spawnEnemy(session, { type, row: row + 1 }).enemies[0]
    ));
    const ordinary = spawnEnemy(session, { type: "medu", row: 4 }).enemies[0];

    expect(stepBattle(session, 6999).some((event) => event.type === "prismaticPulse")).toBe(false);
    const events = stepBattle(session, 1);

    expect(events.filter((event) => event.type === "prismaticPulse")).toHaveLength(1);
    affected.forEach((enemy) => {
      const expected = Math.min(42, 18 + enemy.maxHp * 0.12);
      expect(enemy.shield).toBeCloseTo(expected);
      expect(enemy.shieldMax).toBeCloseTo(expected);
    });
    expect(ordinary.shield).toBe(0);
    expect(session.enemies.find((enemy) => enemy.type === "crisalio").shield).toBe(0);
  });

  it("limita Alfas a 42, renova sem acumular e mantém uma única cadência com vários Crisálios", () => {
    const session = createMantleSession();
    const first = spawnEnemy(session, { type: "crisalio", row: 0 }).enemies[0];
    const second = spawnEnemy(session, { type: "crisalio", row: 1 }).enemies[0];
    const alpha = spawnEnemy(session, { type: "obsidonte", row: 2, variant: "alpha" }).enemies[0];

    const firstPulse = stepBattle(session, 7000);
    expect(firstPulse.filter((event) => event.type === "prismaticPulse")).toHaveLength(1);
    expect(alpha.shield).toBe(42);
    alpha.shield = 3;
    first.dead = true;
    expect(stepBattle(session, 6999).some((event) => event.type === "prismaticPulse")).toBe(false);
    const secondPulse = stepBattle(session, 1);
    expect(secondPulse.filter((event) => event.type === "prismaticPulse")).toHaveLength(1);
    expect(second.lastShieldPulseAt).toBe(session.elapsed);
    expect(alpha.shield).toBe(42);

    second.dead = true;
    const persisted = alpha.shield;
    expect(stepBattle(session, 7000).some((event) => event.type === "prismaticPulse")).toBe(false);
    expect(alpha.shield).toBe(persisted);
  });

  it("absorve o escudo antes da vida e transfere o excesso de dano", () => {
    const session = createMantleSession();
    const { troop } = placeTroop(session, "colono", 0, 1);
    const target = spawnEnemy(session, { type: "estilha", row: 0 }).enemies[0];
    target.x = troop.x + 40;
    target.previousRenderX = target.x;
    target.speed = 0;
    target.shield = 5;
    target.shieldMax = 5;
    const hp = target.hp;

    const events = stepBattle(session, 32);
    expect(target.shield).toBe(0);
    expect(target.hp).toBe(hp - (TROOPS.colono.damage - 5));
    expect(events.some((event) => event.type === "shieldHit" && event.absorbed === 5)).toBe(true);
    expect(events.some((event) => event.type === "shieldBreak")).toBe(true);
  });

  it("mantém a prioridade no primeiro inimigo da rota", () => {
    const session = createMantleSession();
    const { troop } = placeTroop(session, "marine", 0, 1);
    const front = spawnEnemy(session, { type: "estilha", row: 0 }).enemies[0];
    const support = spawnEnemy(session, { type: "crisalio", row: 0 }).enemies[0];
    front.x = troop.x + 150;
    support.x = troop.x + 220;
    front.previousRenderX = front.x;
    support.previousRenderX = support.x;
    front.speed = 0;
    support.speed = 0;

    stepBattle(session, 32);
    expect(session.projectiles[0].targetId).toBe(front.id);
  });

  it("causa dano corpo a corpo somente no instante de impacto", () => {
    const session = createMantleSession();
    const { troop } = placeTroop(session, "colono", 0, 2);
    const support = spawnEnemy(session, { type: "crisalio", row: 0 }).enemies[0];
    support.x = troop.x + 40;
    support.previousRenderX = support.x;
    const hp = troop.hp;

    stepBattle(session, 1);
    expect(support.meleeAttackPending).toBe(true);
    expect(troop.hp).toBe(hp);
    stepBattle(session, ENEMIES.crisalio.attackVisual.impactMs - 1);
    expect(troop.hp).toBe(hp);
    const events = stepBattle(session, 1);
    expect(troop.hp).toBe(hp - ENEMIES.crisalio.damage);
    expect(events.some((event) => event.type === "melee" && event.sourceEnemyId === support.id)).toBe(true);
  });
});

const chooseDecision = (session, id, level = 1, target = null) => {
  session.pendingDecision = [DECISIONS[id]];
  session.pendingDecisionLevel = level;
  expect(selectDecision(session, DECISIONS[id], target)).toBe(true);
};

describe("Campo de Provas", () => {
  const testPhase = { ...PHASES[0], id: "campo_de_provas", energy: 150, waves: [] };

  it("gera qualquer inimigo na rota solicitada e aplica Alpha e HP temporário", () => {
    const session = createBattleSession(testPhase, Object.keys(TROOPS), 20, {
      sandbox: true,
      sandboxSettings: { enemyHpMultiplier: 2 },
    });
    const result = spawnEnemy(session, { type: "crix", row: 3, count: 5, variant: "alpha" });

    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(5);
    expect(session.enemies).toHaveLength(5);
    expect(session.enemies.every((enemy) => enemy.row === 3 && enemy.variant === "alpha")).toBe(true);
    expect(session.enemies[0].maxHp).toBe(ENEMIES.crix.hp * 8 * 2);
  });

  it("mantém o laboratório ativo sem ondas, vitória ou derrota", () => {
    const session = createBattleSession(testPhase, ["colono"], 21, { sandbox: true });
    stepBattle(session, 5000);
    expect(session.outcome).toBeNull();
    expect(session.result).toBeNull();
    expect(session.elapsed).toBe(5000);
  });

  it("não consome recursos nem aplica cooldown no modo Livre", () => {
    const session = createBattleSession(testPhase, ["reator"], 22, { sandbox: true });
    const initialEnergy = session.energy;
    const initialSupply = session.supply;
    for (let col = 1; col <= 6; col += 1) expect(placeTroop(session, "reator", 0, col).ok).toBe(true);
    expect(session.energy).toBe(initialEnergy);
    expect(session.supply).toBe(initialSupply);
    expect(session.deployCooldowns).toEqual({});
  });

  it("preserva custos, cooldown e limites no modo Regras reais", () => {
    const session = createBattleSession(testPhase, ["reator"], 23, {
      sandbox: true,
      sandboxSettings: { rulesMode: "real" },
    });
    expect(placeTroop(session, "reator", 0, 1).ok).toBe(true);
    expect(session.energy).toBe(150 - TROOPS.reator.price);
    expect(session.supply).toBe(20 - TROOPS.reator.supply);
    expect(session.deployCooldowns.reator).toBeGreaterThan(0);
    expect(placeTroop(session, "reator", 0, 2).reason).toMatch(/recarregando/i);
  });

  it("aplica velocidade e dano temporários e respeita a invulnerabilidade da base", () => {
    const session = createBattleSession(testPhase, ["colono"], 24, { sandbox: true });
    session.dematerializationPulses.forEach((pulse) => { pulse.state = "spent"; });
    setSandboxSettings(session, { enemySpeedMultiplier: 0, enemyDamageMultiplier: 3 });
    spawnEnemy(session, { type: "medu", row: 0 });
    const stoppedX = session.enemies[0].x;
    stepBattle(session, 1000);
    expect(session.enemies[0].x).toBe(stoppedX);

    session.enemies[0].x = FIELD.baseX;
    stepBattle(session, 32);
    expect(session.integrity).toBe(100);

    setSandboxSettings(session, { invulnerableBase: false });
    spawnEnemy(session, { type: "medu", row: 0 });
    session.enemies[0].x = FIELD.baseX;
    stepBattle(session, 32);
    expect(session.integrity).toBe(100 - ENEMIES.medu.baseDamage * 3);
  });

  it("limpa entidades e restaura recursos de implantação", () => {
    const session = createBattleSession(testPhase, ["colono"], 25, {
      sandbox: true,
      sandboxSettings: { rulesMode: "real" },
    });
    placeTroop(session, "colono", 0, 1);
    spawnEnemy(session, { type: "medu", row: 0 });
    clearSandboxEntities(session, "troops");
    expect(session.troops).toHaveLength(0);
    expect(session.enemies).toHaveLength(1);
    expect(session.energy).toBe(session.energyMax);
    expect(session.supply).toBe(session.supplyMax);
    clearSandboxEntities(session, "enemies");
    expect(session.enemies).toHaveLength(0);
  });
});

describe("sessão de batalha", () => {
  it("aumenta o supply de 20 para 30 e então 40 entre os capítulos", () => {
    expect(createBattleSession(PHASES[0], ["colono"], 1)).toMatchObject({ supply: 20, supplyMax: 20 });
    expect(createBattleSession(PHASES[8], ["colono"], 1)).toMatchObject({ supply: 30, supplyMax: 30 });
    expect(createBattleSession(PHASES[16], ["colono"], 1)).toMatchObject({ supply: 30, supplyMax: 30 });
  });

  it("inicia os finais dos capítulos 2 e 3 com a energia configurada", () => {
    expect(createBattleSession(PHASES[14], ["colono"], 15).energy).toBe(230);
    expect(createBattleSession(PHASES[15], ["colono"], 16).energy).toBe(250);
    expect(createBattleSession(PHASES[16], ["colono"], 17).energy).toBe(180);
    expect(createBattleSession(PHASES[23], ["colono"], 24).energy).toBe(390);
  });

  it("aplica os multiplicadores Alpha à configuração da variante", () => {
    const phase = {
      ...PHASES[3], cadenceMs: 1000,
      waves: [{ enemies: [{ type: "vexar", variant: "alpha", count: 1 }] }],
    };
    const session = createBattleSession(phase, ["colono"], 7);
    startWave(session);
    stepBattle(session, 1);
    const alpha = session.enemies[0];
    expect(alpha).toMatchObject({ type: "vexar", variant: "alpha", bossPhase: 0 });
    expect(alpha.maxHp).toBe(ENEMIES.vexar.hp * 8);
    expect(alpha.speed).toBe(ENEMIES.vexar.speed * 0.75);
    expect(alpha.damage).toBe(ENEMIES.vexar.damage * 2);
    expect(alpha.scale).toBe(ENEMIES.vexar.scale * 1.45);

    alpha.hp = alpha.maxHp * 0.3;
    const events = stepBattle(session, 1);
    expect(alpha.bossPhase).toBe(2);
    expect(events.filter((event) => event.type === "bossPhase")).toHaveLength(2);
  });

  it("implanta, limita célula e reembolsa metade da energia", () => {
    const session = createBattleSession(PHASES[0], ["colono"], 1);
    expect(placeTroop(session, "colono", 1, 1).ok).toBe(true);
    expect(session.energy).toBe(70);
    expect(placeTroop(session, "colono", 1, 1).reason).toMatch(/ocupada/i);
    expect(removeTroop(session, 1, 1)).toMatchObject({ ok: true, refund: 5 });
    expect(session.energy).toBe(75);
    expect(session.supply).toBe(20);
  });

  it("permite ao colono atacar a partir da muralha imediatamente a frente", () => {
    const session = createBattleSession(PHASES[0], ["colono", "muralhaReforcada"], 11);
    placeTroop(session, "colono", 0, 1);
    placeTroop(session, "muralhaReforcada", 0, 2);
    startWave(session);
    session.queue = [];
    const target = meleeTarget();
    session.enemies = [target];

    const events = stepBattle(session, 32);

    expect(target.hp).toBe(100 - TROOPS.colono.damage);
    expect(events).toContainEqual(expect.objectContaining({ type: "melee", x: target.x, y: target.y }));
  });

  it.each([
    ["sem muralha", null],
    ["com muralha em outra fileira", { row: 1, col: 2 }],
    ["com uma celula entre o colono e a muralha", { row: 0, col: 3 }],
    ["com a muralha morta", { row: 0, col: 2, dead: true }],
  ])("nao estende o alcance melee %s", (_label, wall) => {
    const session = createBattleSession(PHASES[0], ["colono", "muralhaReforcada"], 12);
    placeTroop(session, "colono", 0, 1);
    if (wall) {
      placeTroop(session, "muralhaReforcada", wall.row, wall.col);
      if (wall.dead) session.troops.at(-1).dead = true;
    }
    startWave(session);
    session.queue = [];
    const target = meleeTarget();
    session.enemies = [target];

    const events = stepBattle(session, 32);

    expect(target.hp).toBe(100);
    expect(events.some((event) => event.type === "melee")).toBe(false);
  });

  it.each(["removida", "destruida"])("retorna ao alcance normal quando a muralha e %s", (mode) => {
    const session = createBattleSession(PHASES[0], ["colono", "muralhaReforcada"], 13);
    placeTroop(session, "colono", 0, 1);
    placeTroop(session, "muralhaReforcada", 0, 2);
    const wall = session.troops.at(-1);
    if (mode === "removida") removeTroop(session, 0, 2);
    else wall.dead = true;
    startWave(session);
    session.queue = [];
    const target = meleeTarget();
    session.enemies = [target];

    stepBattle(session, 32);

    expect(target.hp).toBe(100);
  });

  it("faz o reator gerar energia durante a onda sem ultrapassar o limite", () => {
    const session = createBattleSession(PHASES[0], ["reator"], 1);
    expect(TROOPS.reator.price).toBe(10);
    expect(TROOPS.reator.hp).toBeLessThan(TROOPS.colono.hp);
    expect(placeTroop(session, "reator", 0, 1).ok).toBe(true);
    expect(session.deployCooldowns.reator).toBeUndefined();
    expect(session.energy).toBe(70);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "energy_clock", type: "medu", row: 4, x: 900, y: 540, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 0, bossPhase: 0, dead: false,
    }];

    expect(stepBattle(session, 5999).some((event) => event.type === "energyGenerated")).toBe(false);
    const events = stepBattle(session, 1);
    expect(session.energy).toBe(71);
    expect(events).toContainEqual(expect.objectContaining({ type: "energyGenerated", amount: 1 }));

    session.energy = session.energyMax;
    stepBattle(session, 6000);
    expect(session.energy).toBe(session.energyMax);
  });

  it("permite cinco reatores sem cooldown durante a preparacao", () => {
    const session = createBattleSession(PHASES[0], ["reator"], 3);
    expect(TROOPS.reator.maxDeployed).toBe(5);
    expect(TROOPS.reator.deployCooldownMs).toBe(20000);
    for (let row = 0; row < 5; row += 1) {
      expect(placeTroop(session, "reator", row, 1).ok).toBe(true);
      expect(session.deployCooldowns.reator).toBeUndefined();
    }
    expect(session.troops.filter((troop) => !troop.dead && troop.type === "reator")).toHaveLength(5);
    expect(placeTroop(session, "reator", 0, 2).reason).toMatch(/limite/i);
  });

  it("aplica o cooldown do reator depois que a onda comeca", () => {
    const session = createBattleSession(PHASES[0], ["reator"], 4);
    expect(placeTroop(session, "reator", 0, 1).ok).toBe(true);
    startWave(session);

    expect(placeTroop(session, "reator", 1, 1).ok).toBe(true);
    expect(session.deployCooldowns.reator).toBe(session.elapsed + TROOPS.reator.deployCooldownMs);
    expect(placeTroop(session, "reator", 2, 1).reason).toMatch(/recarregando/i);
  });

  it("pausa a carga na preparação e concede oito ao concluir a onda", () => {
    const session = createBattleSession(PHASES[0], ["reator"], 2);
    placeTroop(session, "reator", 0, 1);
    stepBattle(session, 8000);
    expect(session.energy).toBe(70);
    expect(session.troops[0].energyAccumulator).toBe(0);

    startWave(session);
    session.queue = [];
    const events = stepBattle(session, 32);
    expect(session.energy).toBe(78);
    expect(events).toContainEqual(expect.objectContaining({ type: "energyGenerated", amount: 8, reason: "wave" }));
    expect(events.some((event) => event.type === "waveComplete")).toBe(true);
  });

  it("concede 20 de energia por onda a partir da missao dois, inclusive na onda final", () => {
    expect(PHASES[0].waveCompletionEnergy).toBe(0);
    expect(PHASES[1].waveCompletionEnergy).toBe(20);

    const firstMission = createBattleSession({ ...PHASES[0], waves: [{ enemies: [] }] }, [], 21);
    firstMission.energy = 40;
    startWave(firstMission);
    const firstMissionEvents = stepBattle(firstMission, 32);
    expect(firstMission.energy).toBe(40);
    expect(firstMissionEvents).not.toContainEqual(expect.objectContaining({ reason: "waveCompletion" }));

    const secondMission = createBattleSession({ ...PHASES[1], waves: [{ enemies: [] }] }, [], 22);
    secondMission.energy = 40;
    startWave(secondMission);
    const secondMissionEvents = stepBattle(secondMission, 32);
    expect(secondMission.energy).toBe(60);
    expect(secondMission.outcome).toBe("victory");
    expect(secondMissionEvents).toContainEqual(expect.objectContaining({
      type: "energyGenerated",
      amount: 20,
      reason: "waveCompletion",
    }));
  });

  it("limita o bonus de onda ao maximo de energia e soma o bonus adicional do reator", () => {
    const capped = createBattleSession({ ...PHASES[1], waves: [{ enemies: [] }] }, [], 23);
    capped.energy = capped.energyMax - 8;
    startWave(capped);
    const cappedEvents = stepBattle(capped, 32);
    expect(capped.energy).toBe(capped.energyMax);
    expect(cappedEvents).toContainEqual(expect.objectContaining({
      type: "energyGenerated",
      amount: 8,
      reason: "waveCompletion",
    }));

    const withReactor = createBattleSession({ ...PHASES[1], waves: [{ enemies: [] }] }, ["reator"], 24);
    placeTroop(withReactor, "reator", 0, 1);
    withReactor.energy = 40;
    startWave(withReactor);
    const reactorEvents = stepBattle(withReactor, 32);
    expect(withReactor.energy).toBe(68);
    expect(reactorEvents).toContainEqual(expect.objectContaining({
      type: "energyGenerated",
      amount: 20,
      reason: "waveCompletion",
    }));
    expect(reactorEvents).toContainEqual(expect.objectContaining({
      type: "energyGenerated",
      amount: 8,
      reason: "wave",
    }));
  });

  it("aplica dano de passagem e derrota somente com base zerada", () => {
    const session = createBattleSession(PHASES[0], ["colono"], 1);
    session.dematerializationPulses.forEach((pulse) => { pulse.state = "spent"; });
    startWave(session);
    session.queue = [];
    session.enemies = Array.from({ length: 10 }, (_, index) => ({
      id: `leak_${index}`, type: "medu", row: 0, x: 17, y: 60, hp: 1, maxHp: 1,
      speed: 0, damage: 0, attackReadyAt: 0, slowUntil: 0, slowFactor: 1,
      baseDamage: 10, bossPhase: 0, dead: false,
    }));
    stepBattle(session, 32);
    expect(session.integrity).toBe(0);
    expect(session.outcome).toBe("defeat");
  });

  it("aplica o cone configurado do caçador aos três inimigos mais próximos", () => {
    const session = createBattleSession(PHASES[4], ["caçador"], 70);
    placeTroop(session, "caçador", 0, 1);
    startWave(session);
    session.queue = [];
    const troop = session.troops[0];
    const enemy = (id, row, x) => ({
      id, type: "medu", row, x, y: row * 120 + 60, hp: 100, maxHp: 100,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 10, bossPhase: 0, dead: false,
    });
    const third = enemy("third", 0, troop.x + 180);
    const first = enemy("first", 0, troop.x + 80);
    const fourth = enemy("fourth", 0, troop.x + 240);
    const second = enemy("second", 0, troop.x + 130);
    const otherLane = enemy("other_lane", 1, troop.x + 60);
    const behind = enemy("behind", 0, troop.x - 10);
    const outOfRange = enemy("out_of_range", 0, troop.x + TROOPS["caçador"].range * CELL.width + 1);
    session.enemies = [third, first, fourth, second, otherLane, behind, outOfRange];

    stepBattle(session, 32);

    expect(first.hp).toBe(89);
    expect(second.hp).toBe(93);
    expect(third.hp).toBe(96);
    expect(fourth.hp).toBe(100);
    expect(otherLane.hp).toBe(100);
    expect(behind.hp).toBe(100);
    expect(outOfRange.hp).toBe(100);
  });

  it("canaliza fogo nos quatro inimigos mais próximos da mesma rota e dentro do alcance", () => {
    const session = createBattleSession(PHASES[3], ["incinerador"], 71);
    placeTroop(session, "incinerador", 0, 1);
    startWave(session);
    session.queue = [];
    const enemy = (id, row, x) => ({
      id, type: "medu", row, x, y: row * 120 + 60, hp: 10, maxHp: 10,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 10, bossPhase: 0, dead: false,
    });
    const first = enemy("first", 0, 300);
    const second = enemy("second", 0, 320);
    const third = enemy("third", 0, 340);
    const fourth = enemy("fourth", 0, 360);
    const fifth = enemy("fifth", 0, 380);
    const otherLane = enemy("other_lane", 1, 300);
    const outOfRange = enemy("out_of_range", 0, 410);
    session.enemies = [fifth, third, first, fourth, second, otherLane, outOfRange];

    const firstEvents = stepBattle(session, 32);
    const troop = session.troops[0];
    expect(first.hp).toBe(9);
    expect(second.hp).toBe(9);
    expect(third.hp).toBe(9);
    expect(fourth.hp).toBe(9);
    expect(fifth.hp).toBe(10);
    expect(otherLane.hp).toBe(10);
    expect(outOfRange.hp).toBe(10);
    expect(firstEvents.filter((event) => event.type === "flame")).toHaveLength(1);
    const firstFlame = firstEvents.find((event) => event.type === "flame");
    const firstMuzzle = getMuzzleWorldPosition(troop, TROOPS.incinerador, 0, 0);
    expect(firstFlame.x0).toBeCloseTo(firstMuzzle.x);
    expect(firstFlame.y0).toBeCloseTo(firstMuzzle.y);
    expect(session.projectiles).toHaveLength(0);
    expect(troop.channelingAttack).toBe(true);
    expect(troop.attackStartedAt).toBe(32);

    for (let index = 0; index < 6; index += 1) stepBattle(session, 32);
    expect(first.hp).toBe(9);
    const secondTickEvents = stepBattle(session, 8);
    expect(first.hp).toBe(8);
    expect(second.hp).toBe(8);
    expect(third.hp).toBe(8);
    expect(fourth.hp).toBe(8);
    expect(fifth.hp).toBe(10);
    const secondFlame = secondTickEvents.find((event) => event.type === "flame");
    const secondMuzzle = getMuzzleWorldPosition(troop, TROOPS.incinerador, 0, 2);
    expect(secondFlame.x0).toBeCloseTo(secondMuzzle.x);
    expect(secondFlame.y0).toBeCloseTo(secondMuzzle.y);

    first.dead = true;
    stepBattle(session, 200);
    expect(troop.channelingAttack).toBe(true);
    expect(troop.attackStartedAt).toBe(32);
    expect(fifth.hp).toBe(9);

    second.dead = true;
    third.dead = true;
    fourth.dead = true;
    fifth.dead = true;
    stepBattle(session, 32);
    expect(troop.channelingAttack).toBe(false);
    expect(troop.channelTickAccumulator).toBe(0);
  });

  it("mantém pausa/velocidade fora do modelo por passos fixos", () => {
    const normal = createBattleSession(PHASES[0], ["colono"], 1);
    const fast = createBattleSession(PHASES[0], ["colono"], 1);
    stepBattle(normal, 32);
    stepBattle(fast, 32);
    stepBattle(fast, 32);
    expect(fast.elapsed).toBe(normal.elapsed * 2);
  });

  it("dispara a rajada do marine em tres tiros consecutivos", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 1);
    placeTroop(session, "marine", 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 500, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    }];

    const firstEvents = stepBattle(session, 32);
    expect(session.projectiles).toHaveLength(3);
    expect(session.projectiles.map((shot) => shot.launchAt)).toEqual([32, 152, 272]);
    session.projectiles.forEach((projectile, shot) => {
      const expected = getMuzzleWorldPosition(session.troops[0], TROOPS.marine, shot);
      expect(projectile.origin.x).toBeCloseTo(expected.x);
      expect(projectile.origin.y).toBeCloseTo(expected.y);
      expect(projectile.shotIndex).toBe(shot);
      expect(projectile.visualKind).toBe("marineBullet");
      expect(projectile.row).toBe(0);
      expect(projectile.straightLane).toBe(true);
      expect(projectile.vy).toBe(0);
    });
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, false, false]);
    expect(firstEvents.filter((event) => event.type === "shoot")).toHaveLength(1);

    stepBattle(session, 32);
    stepBattle(session, 32);
    stepBattle(session, 32);
    const secondEvents = stepBattle(session, 32);
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, true, false]);
    expect(secondEvents.filter((event) => event.type === "shoot")).toHaveLength(1);

    stepBattle(session, 32);
    stepBattle(session, 32);
    stepBattle(session, 32);
    const thirdEvents = stepBattle(session, 32);
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, true, true]);
    expect(thirdEvents.filter((event) => event.type === "shoot")).toHaveLength(1);
  });

  it("mantem as balas do marine retas e sem atingir inimigos de outras linhas", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 2);
    placeTroop(session, "marine", 0, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "same_lane", type: "krakhul", row: 0, x: 500, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "other_lane", row: 1, y: 180, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const initialY = session.projectiles[0].y;
    originalTarget.dead = true;
    for (let index = 0; index < 12; index += 1) stepBattle(session, 32);

    expect(otherLane.hp).toBe(999);
    expect(session.projectiles.every((projectile) => projectile.y === projectile.origin.y)).toBe(true);
    expect(session.projectiles[0].y).toBe(initialY);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("mantem o tiro do sniper reto e restrito a linha de origem", () => {
    const session = createBattleSession(PHASES[2], ["sniper"], 3);
    placeTroop(session, "sniper", 2, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "sniper_lane", type: "krakhul", row: 2, x: 520, y: 300, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "sniper_other_lane", row: 3, y: 420, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("sniperBullet");
    expect(projectile.row).toBe(2);
    expect(projectile.straightLane).toBe(true);
    expect(projectile.vy).toBe(0);
    const initialY = projectile.y;

    originalTarget.dead = true;
    for (let index = 0; index < 12; index += 1) stepBattle(session, 32);
    expect(session.projectiles[0].y).toBe(initialY);
    expect(otherLane.hp).toBe(999);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("mantem o orbe do krio reto e restrito a linha de origem", () => {
    const session = createBattleSession(PHASES[4], ["krio"], 4);
    placeTroop(session, "krio", 1, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "krio_lane", type: "krakhul", row: 1, x: 520, y: 180, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "krio_other_lane", row: 2, y: 300, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("ice");
    expect(projectile.row).toBe(1);
    expect(projectile.straightLane).toBe(true);
    expect(projectile.vy).toBe(0);
    const initialY = projectile.y;

    originalTarget.dead = true;
    const snowEvents = [];
    for (let index = 0; index < 12; index += 1) snowEvents.push(...stepBattle(session, 32));
    expect(session.projectiles[0].y).toBe(initialY);
    expect(otherLane.hp).toBe(999);
    expect(snowEvents.some((event) => event.type === "iceTrail" && event.variant === "short")).toBe(true);
    expect(snowEvents.some((event) => event.type === "iceTrail" && event.variant === "long")).toBe(true);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("aplica e renova a lentidao do krio sem acumular o fator", () => {
    const session = createBattleSession(PHASES[4], ["krio"], 5);
    placeTroop(session, "krio", 0, 1);
    startWave(session);
    session.queue = [];
    const target = {
      id: "frozen_target", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    session.enemies = [target];

    for (let index = 0; index < 30 && target.slowUntil === 0; index += 1) stepBattle(session, 32);
    expect(target.slowFactor).toBe(TROOPS.krio.slowFactor);
    expect(target.slowUntil).toBe(session.elapsed + TROOPS.krio.slowMs);
    const firstSlowUntil = target.slowUntil;

    session.troops[0].attackReadyAt = session.elapsed;
    for (let index = 0; index < 30 && target.slowUntil === firstSlowUntil; index += 1) stepBattle(session, 32);
    expect(target.slowUntil).toBeGreaterThan(firstSlowUntil);
    expect(target.slowFactor).toBe(0.5);
  });

  it.each([
    ["ranger", "beam"],
    ["caçador", "shotgun"],
  ])("inicia o ataque instantaneo de %s no cano da arma", (troopId, eventType) => {
    const session = createBattleSession(PHASES[7], [troopId], 9);
    placeTroop(session, troopId, 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    }];

    const events = stepBattle(session, 32);
    const event = events.find((entry) => entry.type === eventType);
    const muzzle = getMuzzleWorldPosition(session.troops[0], TROOPS[troopId]);
    expect(event.x0).toBeCloseTo(muzzle.x);
    expect(event.y0).toBeCloseTo(muzzle.y);
    expect(event.sourceTroopId).toBe(session.troops[0].id);
    if (eventType === "beam") {
      const targetPoint = getEnemyHitPoint(session.enemies[0]);
      expect(event.x1).toBeCloseTo(targetPoint.x);
      expect(event.y1).toBeCloseTo(event.y0);
      expect(event.row).toBe(session.troops[0].row);
    }
  });

  it("dispara a bola de fogo do guarda em toda a rota, com cadencia limitada", () => {
    const session = createBattleSession(PHASES[7], ["guarda"], 10);
    placeTroop(session, "guarda", 0, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "guard_original", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    };
    const replacement = { ...originalTarget, id: "guard_replacement", x: 350, hp: 999, maxHp: 999 };
    const otherLane = { ...originalTarget, id: "guard_other_lane", row: 1, y: 180, hp: 999, maxHp: 999 };
    session.enemies = [originalTarget, replacement, otherLane];

    const firstEvents = stepBattle(session, 32);
    const projectile = session.projectiles[0];
    const muzzle = getMuzzleWorldPosition(session.troops[0], TROOPS.guarda);
    expect(TROOPS.guarda.attackEveryMs).toBe(1800);
    expect(TROOPS.guarda.damage).toBe(10);
    expect(session.troops[0].attackReadyAt - session.troops[0].lastAttackAt).toBe(1800);
    expect(projectile).toMatchObject({ kind: "fireball", visualKind: "fireball", row: 0, straightLane: true, vy: 0, maxDistance: 800 });
    expect(projectile.origin.x).toBeCloseTo(muzzle.x);
    expect(projectile.origin.y).toBeCloseTo(muzzle.y);
    expect(firstEvents.some((event) => event.type === "shoot" && event.weapon === "fireball")).toBe(true);

    originalTarget.dead = true;
    const events = [];
    for (let index = 0; index < 30 && replacement.hp === 999; index += 1) events.push(...stepBattle(session, 32));
    expect(replacement.hp).toBe(999 - TROOPS.guarda.damage);
    expect(otherLane.hp).toBe(999);
    expect(events.some((event) => event.type === "fireTrail")).toBe(true);
    expect(events.some((event) => event.type === "fireImpact")).toBe(true);
  });

  it("remove a bola de fogo do guarda ao atingir o alcance maximo", () => {
    const session = createBattleSession(PHASES[7], ["guarda"], 12);
    placeTroop(session, "guarda", 0, 1);
    startWave(session);
    session.queue = [];
    const target = {
      id: "guard_range", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    };
    const otherLane = { ...target, id: "guard_range_other_lane", row: 1, y: 180 };
    session.enemies = [target, otherLane];
    stepBattle(session, 32);
    target.dead = true;
    for (let index = 0; index < 100 && session.projectiles.length; index += 1) stepBattle(session, 32);
    expect(session.projectiles).toHaveLength(0);
  });

  it("exibe tres micromisseis sem multiplicar o dano logico do bombardeiro", () => {
    const session = createBattleSession(PHASES[7], ["bombardeiro"], 11);
    placeTroop(session, "bombardeiro", 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 300, y: 60, hp: 100, maxHp: 100,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    }];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("microMissile");
    expect(projectile.visualCount).toBe(3);
    for (let index = 0; index < 30 && session.enemies[0].hp === 100; index += 1) stepBattle(session, 32);
    expect(session.enemies[0].hp).toBe(100 - TROOPS.bombardeiro.damage);
  });
});

describe("Mago Abissal", () => {
  const sandboxPhase = { ...PHASES[4], id: "teste_mago_abissal", waves: [] };

  function createMageDuel() {
    const session = createBattleSession(sandboxPhase, ["colono", "muralhaReforcada"], 451, { sandbox: true });
    const { troop: colono } = placeTroop(session, "colono", 0, 4);
    const { troop: wall } = placeTroop(session, "muralhaReforcada", 0, 5);
    const { enemies: [mage] } = spawnEnemy(session, { type: "magoAbissal", row: 0 });
    mage.x = 900;
    mage.previousRenderX = 900;
    return { session, colono, wall, mage };
  }

  function finishFlight(session, limit = 240) {
    const events = [];
    for (let index = 0; index < limit && session.enemyProjectiles.length; index += 1) {
      events.push(...stepBattle(session, 32));
    }
    return events;
  }

  it("para no alcance, carrega sem dano antecipado e lança uma esfera lenta", () => {
    const { session, wall, mage } = createMageDuel();
    const wallHp = wall.hp;
    const chargeEvents = stepBattle(session, 1);
    expect(mage).toMatchObject({ casting: true, moving: false, x: 900 });
    expect(chargeEvents.some((event) => event.type === "abyssCharge")).toBe(true);
    expect(session.enemyProjectiles).toHaveLength(0);
    expect(wall.hp).toBe(wallHp);

    stepBattle(session, ENEMIES.magoAbissal.chargeMs - 1);
    expect(session.enemyProjectiles).toHaveLength(0);
    const releaseEvents = stepBattle(session, 1);
    expect(session.enemyProjectiles).toHaveLength(1);
    expect(session.enemyProjectiles[0]).toMatchObject({ vx: -130, damage: 18, visualKind: "abyssOrb" });
    expect(wall.hp).toBe(wallHp);
    expect(mage.attackReadyAt - mage.lastAttackAt).toBe(ENEMIES.magoAbissal.attackEveryMs);
    expect(releaseEvents.some((event) => event.type === "shoot" && event.weapon === "abyssOrb")).toBe(true);
  });

  it("atinge a primeira tropa, inclusive muralha, mesmo após a morte do conjurador", () => {
    const { session, colono, wall, mage } = createMageDuel();
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.magoAbissal.chargeMs);
    mage.dead = true;
    const events = finishFlight(session);
    expect(session.enemyProjectiles).toHaveLength(0);
    expect(wall.hp).toBe(wall.maxHp - ENEMIES.magoAbissal.damage);
    expect(colono.hp).toBe(colono.maxHp);
    expect(events.some((event) => event.type === "abyssImpact")).toBe(true);
  });

  it("continua até a próxima tropa se o primeiro alvo morrer e dissipa sem ferir a base", () => {
    const first = createMageDuel();
    stepBattle(first.session, 1);
    stepBattle(first.session, ENEMIES.magoAbissal.chargeMs);
    first.wall.dead = true;
    finishFlight(first.session);
    expect(first.colono.hp).toBe(first.colono.maxHp - ENEMIES.magoAbissal.damage);

    const empty = createMageDuel();
    stepBattle(empty.session, 1);
    stepBattle(empty.session, ENEMIES.magoAbissal.chargeMs);
    empty.session.troops = [];
    const integrity = empty.session.integrity;
    finishFlight(empty.session);
    expect(empty.session.enemyProjectiles).toHaveLength(0);
    expect(empty.session.integrity).toBe(integrity);
  });

  it("cancela a carga e retoma o avanço sem alvo na mesma fileira", () => {
    const { session, colono, wall, mage } = createMageDuel();
    stepBattle(session, 1);
    colono.dead = true;
    wall.dead = true;
    stepBattle(session, 32);
    expect(mage.casting).toBe(false);
    expect(mage.moving).toBe(true);
    expect(mage.x).toBeLessThan(900);
  });

  it("faz o Refrator disparar um projétil prismático mais veloz", () => {
    expect(ENEMIES.refrator.range).toBe(4);
    const session = createBattleSession(sandboxPhase, ["muralhaReforcada"], 913, { sandbox: true });
    placeTroop(session, "muralhaReforcada", 0, 5);
    const { enemies: [refrator] } = spawnEnemy(session, { type: "refrator", row: 0 });
    refrator.x = 900;
    refrator.previousRenderX = 900;

    stepBattle(session, 1);
    const events = stepBattle(session, ENEMIES.refrator.chargeMs);

    expect(session.enemyProjectiles[0]).toMatchObject({
      vx: -170, damage: 14, visualKind: "prismBolt",
    });
    expect(events.some((event) => event.type === "shoot" && event.weapon === "prismBolt")).toBe(true);
  });
});

describe("Demolidora de Minas", () => {
  const sandboxPhase = { ...PHASES[5], id: "teste_demolidora", waves: [] };

  it("reserva deterministicamente uma célula vazia nas três colunas e em qualquer linha", () => {
    const first = createBattleSession(sandboxPhase, ["demolidora"], 401, { sandbox: true });
    const second = createBattleSession(sandboxPhase, ["demolidora"], 401, { sandbox: true });
    placeTroop(first, "demolidora", 2, 1);
    placeTroop(second, "demolidora", 2, 1);
    stepBattle(first, 1);
    stepBattle(second, 1);
    const target = first.projectiles.find((projectile) => projectile.kind === "mine");
    const repeated = second.projectiles.find((projectile) => projectile.kind === "mine");
    expect({ row: target.targetRow, col: target.targetCol }).toEqual({ row: repeated.targetRow, col: repeated.targetCol });
    expect(target.targetRow).toBeGreaterThanOrEqual(0);
    expect(target.targetRow).toBeLessThan(FIELD.rows);
    expect(target.targetCol).toBeGreaterThanOrEqual(2);
    expect(target.targetCol).toBeLessThanOrEqual(4);
  });

  it("não consome cooldown sem destino e respeita o limite de cinco dispositivos", () => {
    const session = createBattleSession(sandboxPhase, ["demolidora"], 402, { sandbox: true });
    const { troop } = placeTroop(session, "demolidora", 0, 1);
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 2; col <= 4; col += 1) {
        session.mines.push({ id: `block_${row}_${col}`, ownerId: "other", row, col, x: col * 100 + 50, y: row * 120 + 60, active: true });
      }
    }
    stepBattle(session, 1);
    expect(troop.mineReadyAt).toBe(0);
    expect(session.projectiles).toHaveLength(0);

    session.mines = Array.from({ length: 5 }, (_, index) => ({
      id: `owned_${index}`, ownerId: troop.id, row: index, col: 5, x: 550, y: index * 120 + 60, active: true,
    }));
    stepBattle(session, 8000);
    expect(session.projectiles).toHaveLength(0);
  });

  it("prioriza a pistola na mesma linha a duas células e retoma as minas depois", () => {
    const session = createBattleSession(sandboxPhase, ["demolidora"], 403, { sandbox: true });
    const { troop } = placeTroop(session, "demolidora", 1, 1);
    const enemy = meleeTarget(troop.x + 180, 1);
    session.enemies.push(enemy);
    stepBattle(session, 1);
    expect(troop.lastAttackMode).toBe("gun");
    expect(session.projectiles.some((projectile) => projectile.visualKind === "demolidoraBullet")).toBe(true);
    expect(session.projectiles.some((projectile) => projectile.kind === "mine")).toBe(false);

    enemy.row = 4;
    stepBattle(session, 650);
    expect(troop.lastAttackMode).toBe("mine");
    expect(session.projectiles.some((projectile) => projectile.kind === "mine")).toBe(true);
  });

  it("faz o lançamento percorrer uma parábola e arma a mina no destino", () => {
    const session = createBattleSession(sandboxPhase, ["demolidora"], 404, { sandbox: true });
    placeTroop(session, "demolidora", 2, 1);
    stepBattle(session, 1);
    const projectile = session.projectiles.find((entry) => entry.kind === "mine");
    const linearMidY = (projectile.origin.y + projectile.targetY) / 2;
    stepBattle(session, 320);
    expect(projectile.launched).toBe(true);
    expect(projectile.y).toBeLessThan(linearMidY - 70);
    stepBattle(session, 330);
    expect(session.projectiles.some((entry) => entry.kind === "mine")).toBe(false);
    expect(session.mines).toHaveLength(1);
    expect(session.mines[0]).toMatchObject({ row: projectile.targetRow, col: projectile.targetCol, active: true });
  });

  it("detona ao atravessar a célula em passo grande e aplica dano em pequena área", () => {
    const session = createBattleSession(sandboxPhase, [], 405, { sandbox: true });
    session.mines.push({ id: "mine_test", ownerId: "gone", row: 0, col: 3, x: 350, y: 60, damage: 36, radius: 58, color: "#22d3ee", active: true, seed: 9 });
    const trigger = { ...meleeTarget(430, 0), id: "trigger", speed: 1000 };
    const nearby = { ...meleeTarget(360, 0), id: "nearby", speed: 0 };
    session.enemies.push(trigger, nearby);
    const events = stepBattle(session, 160);
    expect(session.mines).toHaveLength(0);
    expect(trigger.hp).toBe(64);
    expect(nearby.hp).toBe(64);
    expect(events.filter((event) => event.type === "explosion" && event.weapon === "magneticMine")).toHaveLength(1);
  });

  it("não dispara nem causa dano em inimigos flutuantes", () => {
    const session = createBattleSession(sandboxPhase, [], 407, { sandbox: true });
    session.mines.push({ id: "mine_airborne", ownerId: "gone", row: 0, col: 3, x: 350, y: 60, damage: 36, radius: 58, color: "#22d3ee", active: true, seed: 10 });
    const { enemies: [mage] } = spawnEnemy(session, { type: "magoAbissal", row: 0 });
    mage.x = 360;
    mage.previousRenderX = 360;
    mage.speed = 0;
    stepBattle(session, 32);
    expect(session.mines).toHaveLength(1);
    expect(mage.hp).toBe(mage.maxHp);

    const trigger = { ...meleeTarget(430, 0), id: "ground_trigger", speed: 1000 };
    session.enemies.push(trigger);
    stepBattle(session, 160);
    expect(session.mines).toHaveLength(0);
    expect(trigger.hp).toBe(64);
    expect(mage.hp).toBe(mage.maxHp);
  });

  it("não instala entre ondas, limpa na remoção manual e preserva após a morte", () => {
    const phase = { ...PHASES[5], waves: [{ enemies: [] }] };
    const session = createBattleSession(phase, ["demolidora"], 406);
    const { troop } = placeTroop(session, "demolidora", 0, 1);
    stepBattle(session, 9000);
    expect(session.projectiles).toHaveLength(0);
    startWave(session);
    stepBattle(session, 1);
    expect(session.projectiles.some((entry) => entry.kind === "mine")).toBe(true);
    removeTroop(session, 0, 1);
    expect(session.projectiles.some((entry) => entry.kind === "mine")).toBe(false);

    session.mines.push({ id: "survivor", ownerId: troop.id, row: 1, col: 2, x: 250, y: 180, active: true });
    session.troops = session.troops.filter((entry) => entry.id !== troop.id);
    expect(session.mines).toHaveLength(1);
  });
});

describe("Parasita Saltador", () => {
  const sandboxPhase = { ...PHASES[2], id: "teste_parasita_saltador", waves: [] };

  function createParasiteLane() {
    const session = createBattleSession(sandboxPhase, ["reator", "muralhaReforcada"], 512, { sandbox: true });
    const { troop: host } = placeTroop(session, "reator", 0, 4);
    const { troop: front } = placeTroop(session, "muralhaReforcada", 0, 5);
    const { enemies: [parasite] } = spawnEnemy(session, { type: "parasitaSaltador", row: 0 });
    parasite.x = 604;
    parasite.previousRenderX = 604;
    return { session, host, front, parasite };
  }

  it("salta apenas a primeira tropa, percorre a rota em 720 ms e se anexa à segunda", () => {
    const { session, host, parasite } = createParasiteLane();
    host.attackReadyAt = 1000;

    stepBattle(session, 1);
    expect(parasite).toMatchObject({ jumpConsumed: true, jumping: true, jumpTargetTroopId: host.id, jumpProgress: 0 });
    stepBattle(session, 360);
    expect(parasite.jumpProgress).toBeCloseTo(0.5, 2);
    expect(parasite.x).toBeCloseTo((604 + host.x) / 2, 1);
    stepBattle(session, 360);

    expect(parasite).toMatchObject({ jumping: false, attachedToTroopId: host.id, x: host.x });
    expect(host.attachedParasiteId).toBe(parasite.id);
    expect(host.attackSpeedFactor).toBe(0.65);
    expect(host.attackReadyAt).toBeGreaterThan(1000);
  });

  it("ataca rapidamente enquanto anexado e uma mina o elimina restaurando o hospedeiro", () => {
    const { session, host, parasite } = createParasiteLane();
    stepBattle(session, 1);
    stepBattle(session, 720);
    const initialHp = host.hp;
    stepBattle(session, 1);
    expect(host.hp).toBe(initialHp - ENEMIES.parasitaSaltador.damage);

    session.mines.push({
      id: "parasite_mine", ownerId: "gone", row: 0, col: 4, x: host.x, y: host.y,
      damage: 36, radius: 58, color: "#22d3ee", active: true, seed: 12,
    });
    stepBattle(session, 1);
    expect(session.enemies.some((enemy) => enemy.id === parasite.id)).toBe(false);
    expect(host.attachedParasiteId).toBeNull();
    expect(host.attackSpeedFactor).toBe(1);
  });

  it("consome o salto e combate a linha de frente quando não existe alvo atrás", () => {
    const session = createBattleSession(sandboxPhase, ["muralhaReforcada"], 513, { sandbox: true });
    const { troop: front } = placeTroop(session, "muralhaReforcada", 0, 5);
    const { enemies: [parasite] } = spawnEnemy(session, { type: "parasitaSaltador", row: 0 });
    parasite.x = 604;
    parasite.previousRenderX = 604;
    const initialHp = front.hp;
    stepBattle(session, 1);
    expect(parasite).toMatchObject({ jumpConsumed: true, jumping: false, attachedToTroopId: null });
    expect(front.hp).toBe(initialHp - ENEMIES.parasitaSaltador.damage);
  });

  it("cancela a aterrissagem se o destino morrer e não permite dois parasitas no mesmo hospedeiro", () => {
    const first = createParasiteLane();
    stepBattle(first.session, 1);
    first.host.dead = true;
    stepBattle(first.session, 32);
    expect(first.parasite).toMatchObject({ jumpConsumed: true, jumping: false, attachedToTroopId: null });

    const second = createParasiteLane();
    stepBattle(second.session, 1);
    stepBattle(second.session, 720);
    const { enemies: [challenger] } = spawnEnemy(second.session, { type: "parasitaSaltador", row: 0 });
    challenger.x = 604;
    challenger.previousRenderX = 604;
    stepBattle(second.session, 1);
    expect(second.host.attachedParasiteId).toBe(second.parasite.id);
    expect(challenger).toMatchObject({ jumpConsumed: true, jumping: false, attachedToTroopId: null });
  });
});

describe("decisões táticas aleatórias", () => {
  const decisionPhase = {
    ...PHASES[0], id: "teste_decisoes", energy: 120,
    waves: Array.from({ length: 4 }, () => ({ enemies: [] })),
  };

  it("apresenta os três estágios compactos entre ondas e encerra sem decisão final extra", () => {
    const session = createBattleSession(decisionPhase, ["marine", "bombardeiro", "ranger"], 901);
    const stages = ["preparation", "direction", "final"];
    for (let level = 1; level <= 3; level += 1) {
      expect(startWave(session)).toBe(true);
      stepBattle(session, 1);
      expect(session.pendingDecisionLevel).toBe(stages[level - 1]);
      expect(session.pendingDecision).toHaveLength(2);
      const chosen = session.pendingDecision[0];
      expect(selectDecision(session, chosen)).toBe(true);
      expect(session.decisions.at(-1)).toEqual({ wave: level, level: stages[level - 1], id: chosen.id });
    }
    expect(startWave(session)).toBe(true);
    stepBattle(session, 1);
    expect(session.outcome).toBe("victory");
    expect(session.pendingDecision).toBeNull();
    expect(session.pendingDecisionLevel).toBeNull();
  });

  it("aplica recursos, integridade, escudo e modificadores persistentes", () => {
    const session = createBattleSession(decisionPhase, ["marine"], 902);
    session.energy = 40;
    session.supply = 5;
    session.integrity = 50;
    chooseDecision(session, "emergency_energy");
    chooseDecision(session, "supply_expansion");
    chooseDecision(session, "repair_core");
    chooseDecision(session, "emergency_shield");
    chooseDecision(session, "armor_piercing");
    chooseDecision(session, "structural_armor", 2);

    expect(session).toMatchObject({
      energy: 60, supply: 9, supplyMax: 24,
      integrity: 90, integrityMax: 115, shieldCharges: 2,
    });
    expect(session.modifiers).toMatchObject({ troopDamage: 1.1, enemySpeed: 1 });
  });

  it("consome efeitos da próxima onda e aumenta a fila da Economia de guerra", () => {
    const phase = { ...decisionPhase, waves: [{ enemies: [{ type: "medu", count: 2 }] }, ...decisionPhase.waves.slice(1)] };
    const session = createBattleSession(phase, ["colono"], 903);
    session.energy = 20;
    chooseDecision(session, "strategic_reserve", 2);
    chooseDecision(session, "containment_protocol", 2);
    chooseDecision(session, "total_mobilization", 3);
    expect(startWave(session)).toBe(true);

    expect(session.energy).toBe(45);
    expect(session.queue).toHaveLength(3);
    expect(session.currentWaveBaseDamageFactor).toBe(0.65);
    expect(session.nextWaveEnergy).toBe(0);
    expect(session.nextWaveBaseDamageFactor).toBe(1);
    expect(session.nextWaveEnemyCountFactor).toBe(1);
  });

  it("atualiza custo, cooldown e reembolso pelo valor efetivamente pago", () => {
    const session = createBattleSession(decisionPhase, ["marine"], 904);
    chooseDecision(session, "efficient_batteries", 3);
    chooseDecision(session, "fast_deployment", 2);
    chooseDecision(session, "recycling", 3);
    expect(getEffectiveTroopStats(session, "marine")).toEqual({ price: 12, supply: 5, deployCooldownMs: 4250, refundRate: 0.65 });

    const placed = placeTroop(session, "marine", 0, 1);
    expect(placed.ok).toBe(true);
    expect(placed.troop.energyCost).toBe(12);
    expect(removeTroop(session, 0, 1).refund).toBe(7);
  });

  it("aplica Primeiro impacto uma vez e acelera o intervalo ofensivo", () => {
    const session = createBattleSession(decisionPhase, ["colono"], 905);
    const { troop } = placeTroop(session, "colono", 0, 1);
    chooseDecision(session, "first_impact");
    chooseDecision(session, "accelerated_training");
    expect(startWave(session)).toBe(true);
    const target = meleeTarget(230);
    session.enemies = [target];
    session.queue = [];

    stepBattle(session, 1);
    expect(target.hp).toBe(86);
    expect(troop.firstImpactAvailable).toBe(false);
    expect(troop.attackReadyAt - troop.lastAttackAt).toBeCloseTo(TROOPS.colono.attackEveryMs / 1.1);
    stepBattle(session, TROOPS.colono.attackEveryMs / 1.1);
    expect(target.hp).toBe(78);
  });

  it("aplica manutenção, Linha agressiva e resistência da Última linha", () => {
    const session = createBattleSession(decisionPhase, ["colono"], 906);
    const { troop } = placeTroop(session, "colono", 0, 1);
    troop.hp = 10;
    chooseDecision(session, "field_maintenance", 3);
    expect(troop.hp).toBeCloseTo(18.4);
    chooseDecision(session, "aggressive_line", 3);
    expect(troop.maxHp).toBeCloseTo(27.2);
    expect(troop.hp).toBeCloseTo(14.72);
    chooseDecision(session, "last_line", 3);

    expect(startWave(session)).toBe(true);
    const enemy = meleeTarget(troop.x + 40);
    enemy.damage = 8;
    enemy.attackReadyAt = 0;
    session.enemies = [enemy];
    session.queue = [];
    stepBattle(session, 1);
    expect(troop.hp).toBeCloseTo(8.32);
  });

  it("configura especializações, mira e impacto concussivo sem alterar o catálogo", () => {
    const session = createBattleSession(decisionPhase, ["marine", "bombardeiro", "ranger", "krio", "guarda"], 907);
    chooseDecision(session, "ballistic_specialization", 2);
    chooseDecision(session, "explosive_specialization", 2);
    chooseDecision(session, "energy_specialization", 2);
    chooseDecision(session, "targeting_systems", 3);
    chooseDecision(session, "concussive_impact", 3);
    expect(session.modifiers).toMatchObject({
      ballisticDamage: 1.15, explosiveDamage: 1.15, rangerDamage: 1.15,
      guardDamage: 1.1, krioSlowDuration: 1.2, guardRangeBonus: 0.5,
      targetingRange: 1.1, concussiveImpact: true,
    });
    expect(TROOPS.guarda.range).toBe(8);
    expect(TROOPS.marine.damage).toBe(4);
  });

  it("aplica os bônus individuais da especialização energética", () => {
    const guardSession = createBattleSession(decisionPhase, ["guarda"], 910);
    placeTroop(guardSession, "guarda", 0, 1);
    chooseDecision(guardSession, "energy_specialization", 2);
    expect(startWave(guardSession)).toBe(true);
    guardSession.queue = [];
    guardSession.enemies = [{ ...meleeTarget(430), id: "guard_energy_target" }];
    stepBattle(guardSession, 1);
    expect(guardSession.projectiles[0]).toMatchObject({ kind: "fireball", damage: TROOPS.guarda.damage * 1.1, maxDistance: 850 });

    const krioSession = createBattleSession(decisionPhase, ["krio"], 911);
    placeTroop(krioSession, "krio", 0, 1);
    chooseDecision(krioSession, "energy_specialization", 2);
    expect(startWave(krioSession)).toBe(true);
    const frozen = { ...meleeTarget(300), id: "krio_energy_target" };
    krioSession.enemies = [frozen];
    krioSession.queue = [];
    for (let index = 0; index < 40 && frozen.slowUntil === 0; index += 1) stepBattle(krioSession, 32);
    expect(frozen.slowUntil - krioSession.elapsed).toBe(TROOPS.krio.slowMs * 1.2);
  });

  it("reduz também o tempo restante de cooldowns ativos", () => {
    const session = createBattleSession(decisionPhase, ["marine"], 912);
    expect(startWave(session)).toBe(true);
    expect(placeTroop(session, "marine", 0, 1).ok).toBe(true);
    expect(session.deployCooldowns.marine - session.elapsed).toBe(TROOPS.marine.deployCooldownMs);
    chooseDecision(session, "fast_deployment", 2);
    expect(session.deployCooldowns.marine - session.elapsed).toBe(TROOPS.marine.deployCooldownMs * 0.85);
  });

  it("amplifica e empurra alvos atingidos pela explosão do Bombardeiro", () => {
    const session = createBattleSession(decisionPhase, ["bombardeiro"], 909);
    placeTroop(session, "bombardeiro", 0, 1);
    chooseDecision(session, "explosive_specialization", 2);
    chooseDecision(session, "concussive_impact", 3);
    expect(startWave(session)).toBe(true);
    const target = { ...meleeTarget(300), id: "concussive_target", hp: 100, maxHp: 100 };
    session.enemies = [target];
    session.queue = [];
    for (let index = 0; index < 60 && target.hp === 100; index += 1) stepBattle(session, 32);
    expect(target.hp).toBe(100 - TROOPS.bombardeiro.damage * 1.15);
    expect(target.x).toBe(335);
  });

  it("bloqueia duas invasões e aplica o protocolo após consumir o escudo", () => {
    const session = createBattleSession(decisionPhase, ["colono"], 908);
    session.dematerializationPulses.forEach((pulse) => { pulse.state = "spent"; });
    chooseDecision(session, "emergency_shield");
    chooseDecision(session, "containment_protocol", 2);
    expect(startWave(session)).toBe(true);
    session.queue = [];
    session.enemies = Array.from({ length: 3 }, (_, index) => ({
      ...meleeTarget(FIELD.baseX, index), id: `breach_${index}`, row: index, y: index * 120 + 60,
      baseDamage: 20,
    }));
    stepBattle(session, 1);
    expect(session.integrity).toBe(87);
    expect(session.shieldCharges).toBe(0);
  });

  it("não consome o escudo de emergência quando um chefe invade", () => {
    const session = createBattleSession(decisionPhase, ["colono"], 913);
    session.dematerializationPulses.forEach((pulse) => { pulse.state = "spent"; });
    chooseDecision(session, "emergency_shield");
    expect(startWave(session)).toBe(true);
    session.queue = [];
    session.enemies = [{
      ...meleeTarget(FIELD.baseX), id: "boss_breach", type: "scarabEmperor", baseDamage: 20,
    }];
    stepBattle(session, 1);
    expect(session.integrity).toBe(80);
    expect(session.shieldCharges).toBe(2);
  });

  it("consome em conjunto as decisões da próxima implantação", () => {
    const session = createBattleSession(decisionPhase, ["marine"], 914);
    chooseDecision(session, "efficient_batteries");
    chooseDecision(session, "early_preparation");
    chooseDecision(session, "emergency_contract");
    expect(getEffectiveTroopStats(session, "marine")).toMatchObject({ price: 6, supply: 6 });
    expect(placeTroop(session, "marine", 0, 1)).toMatchObject({ ok: true });
    expect(session.deployCooldowns.marine).toBeUndefined();
    expect(session).toMatchObject({ efficientBatteryCharges: 2, earlyPreparationCharges: 0, emergencyContractCharges: 0 });
  });

  it("aplica fortificação de rota a tropas atuais e futuras e reembolsa retirada crítica", () => {
    expect(DECISIONS.route_fortification).toMatchObject({
      positional: true, targetType: "occupiedRow", targetSize: 1,
    });
    const session = createBattleSession(decisionPhase, ["colono"], 915);
    const first = placeTroop(session, "colono", 2, 1).troop;
    session.pendingDecision = [DECISIONS.route_fortification];
    session.pendingDecisionLevel = 1;
    expect(selectDecision(session, DECISIONS.route_fortification, { row: 3 })).toBe(false);
    chooseDecision(session, "route_fortification", 1, { row: 2 });
    expect(session.fortifiedRow).toBe(2);
    expect(first.maxHp).toBeCloseTo(TROOPS.colono.hp * 1.2);
    const second = placeTroop(session, "colono", 2, 2).troop;
    expect(second.maxHp).toBeCloseTo(TROOPS.colono.hp * 1.2);
    chooseDecision(session, "organized_retreat");
    second.hp = second.maxHp * 0.2;
    expect(removeTroop(session, 2, 2).refund).toBe(second.energyCost);
  });

  it("seleciona três colunas para a Formação avançada e aplica risco e bônus somente nelas", () => {
    expect(DECISIONS.advanced_formation).toMatchObject({
      positional: true, targetType: "columnBlock", targetSize: 3,
    });
    const session = createBattleSession(decisionPhase, ["colono"], 919, { sandbox: true });
    const advanced = placeTroop(session, "colono", 0, 2).troop;
    const regular = placeTroop(session, "colono", 1, 5).troop;
    session.pendingDecision = [DECISIONS.advanced_formation];
    session.pendingDecisionLevel = 3;

    expect(selectDecision(session, DECISIONS.advanced_formation, { columns: [1, 2, 3] })).toBe(true);
    expect(session.advancedFormationColumns).toEqual([1, 2, 3]);
    expect(session.pendingDecision).toBeNull();

    const advancedEnemy = spawnEnemy(session, { type: "medu", row: 0 }).enemies[0];
    const regularEnemy = spawnEnemy(session, { type: "medu", row: 1 }).enemies[0];
    [advancedEnemy, regularEnemy].forEach((enemy, index) => {
      const target = index === 0 ? advanced : regular;
      enemy.x = target.x + 35;
      enemy.previousRenderX = enemy.x;
      enemy.speed = 0;
      enemy.hp = 100000;
      enemy.maxHp = 100000;
    });
    for (let index = 0; index < 80; index += 1) stepBattle(session, 32);
    const advancedLoss = advanced.maxHp - advanced.hp;
    const regularLoss = regular.maxHp - regular.hp;
    expect(regularLoss).toBeGreaterThan(0);
    expect(advancedLoss).toBeCloseTo(regularLoss * 1.1, 5);
  });

  it("ativa decisões temporárias somente na próxima onda e limpa ao concluí-la", () => {
    const phase = { ...decisionPhase, waves: [{ enemies: [{ type: "medu", count: 1 }] }, ...decisionPhase.waves.slice(1)] };
    const session = createBattleSession(phase, ["marine"], 916);
    chooseDecision(session, "final_overload", "finalTemporary");
    chooseDecision(session, "emergency_deployment", "finalTemporary");
    expect(session.activeTemporaryDecisions).toEqual([]);
    expect(startWave(session)).toBe(true);
    expect(session.activeTemporaryDecisions).toEqual(["final_overload", "emergency_deployment"]);
    expect(getEffectiveTroopStats(session, "marine").deployCooldownMs).toBe(TROOPS.marine.deployCooldownMs * 0.6);
    session.queue = [];
    session.enemies = [];
    stepBattle(session, 1);
    expect(session.activeTemporaryDecisions).toEqual([]);
  });

  it("inicia imediatamente a onda escolhida por Ataque antecipado", () => {
    const session = createBattleSession(decisionPhase, ["marine"], 917);
    session.energy = 20;
    chooseDecision(session, "early_assault");
    expect(session.waveActive).toBe(true);
    expect(session.preparing).toBe(false);
    expect(session.energy).toBe(50);
  });

  it("concede a barreira reativa uma única vez por rota", () => {
    const session = createBattleSession(decisionPhase, ["colono"], 918);
    const troop = placeTroop(session, "colono", 0, 1).troop;
    chooseDecision(session, "reactive_barrier");
    expect(startWave(session)).toBe(true);
    troop.hp = 12;
    const enemy = meleeTarget(troop.x + 40);
    enemy.damage = 4;
    enemy.attackReadyAt = 0;
    session.queue = [];
    session.enemies = [enemy];
    stepBattle(session, 1);
    expect(session.reactiveBarrierRows).toEqual([0]);
    expect(troop.reactiveShield).toBeCloseTo(troop.maxHp * 0.25);
    expect(troop.reactiveShieldUntil).toBe(session.elapsed + 6000);
  });

  it("programa a sobrecarga e a inatividade do Reator em ondas consecutivas", () => {
    const session = createBattleSession(decisionPhase, ["reator"], 919);
    placeTroop(session, "reator", 0, 1);
    chooseDecision(session, "overcharged_reactor");
    expect(session).toMatchObject({ overchargedReactorBoostWave: 0, overchargedReactorInactiveWave: 1 });
    session.energy = 0;
    expect(startWave(session)).toBe(true);
    session.queue = [];
    session.enemies = [{ ...meleeTarget(1000), id: "reactor_clock", speed: 0 }];
    stepBattle(session, TROOPS.reator.attackEveryMs);
    expect(session.energy).toBe(TROOPS.reator.energyPerPulse * 1.5);

    session.waveActive = false;
    session.enemies = [];
    session.pendingDecision = null;
    session.waveIndex = 1;
    session.energy = 0;
    session.troops[0].energyAccumulator = 0;
    expect(startWave(session)).toBe(true);
    session.queue = [];
    session.enemies = [{ ...meleeTarget(1000), id: "reactor_inactive_clock", speed: 0 }];
    stepBattle(session, 4999);
    expect(session.troops[0].energyAccumulator).toBe(0);
  });
});
