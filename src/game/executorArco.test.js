import { describe, expect, it } from "vitest";
import { resolveTroopFrame } from "./assetCatalog.js";
import {
  CELL, createBattleSession, forceExecutorCombo, placeTroop, spawnEnemy, stepBattle,
} from "./battleModel.js";
import { ENEMIES, PHASES, TROOPS, getUnlockedTroops } from "./content.js";
import {
  isEnemyWithinExecutorRange,
  isEnemyWithinExecutorRangedRange,
  selectExecutorRangedTarget,
  selectExecutorTarget,
} from "./executorArco.js";
import { createExecutorParticles } from "./executorArcoRenderer.js";
import { getTroopInfo } from "./troopInfo.js";
import { getTroopAnimation } from "./visualGeometry.js";

const column = (enemy) => Math.floor(enemy.x / CELL.width);

function createSession() {
  return createBattleSession(PHASES[0], ["executorArco"], 3301, { sandbox: true });
}

function place(session, row = 1, col = 2) {
  const result = placeTroop(session, "executorArco", row, col);
  expect(result.ok).toBe(true);
  return result.troop;
}

function enemy(id, troop, {
  x = troop.x + 40,
  row = troop.row,
  type = "medu",
  hp = 100,
  shield = 0,
  variant,
  airborne = false,
} = {}) {
  return {
    id, type, row, x, y: row * CELL.height + CELL.height / 2,
    hp, maxHp: hp, shield, shieldMax: shield, variant, airborne,
    speed: 0, damage: 0, baseDamage: 0, attackReadyAt: Infinity,
    lastAttackAt: -Infinity, slowUntil: 0, slowFactor: 1,
    dead: false, moving: false, previousRenderX: x, previousRenderY: row * CELL.height + CELL.height / 2,
  };
}

function startAndImpact(session, impactMs) {
  const started = stepBattle(session, 1);
  const before = stepBattle(session, impactMs - 1);
  const impact = stepBattle(session, 1);
  return { started, before, impact };
}

describe("Vórtice — Executor de Arco", () => {
  it("centraliza identidade, balanceamento, estados, título e desbloqueio", () => {
    expect(TROOPS.executorArco).toMatchObject({
      id: "executorArco",
      label: "Vórtice",
      title: "Executor de Arco",
      role: "Combo / Anti-elite",
      price: 19,
      supply: 5,
      deployCooldownMs: 6000,
      hp: 42,
      range: 1.25,
      rangedRange: 2,
      rangedDamage: 4,
      rangedAttackEveryMs: 1200,
      rangedProjectileSpeed: 520,
      combo1Damage: 6,
      combo2Damage: 7,
      combo3Damage: 24,
      combo3CollateralFactor: 0.3,
      comboWindowMs: 1800,
      unlockAt: 8,
      assetStates: ["idle", "attack1", "attack2", "attack3", "attackRanged"],
    });
    expect(TROOPS.executorArco.rangedAttackVisual).toMatchObject({
      state: "attackRanged", durationMs: 640, releaseMs: 320,
      effect: "executorArcSlash",
    });
    expect(TROOPS.executorArco.attackVisuals.combo3.recoveryMs)
      .toBeGreaterThan(TROOPS.executorArco.attackVisuals.combo2.recoveryMs);
    expect(TROOPS.executorArco.idleVisual.height).toBe(146);
    expect(Object.values(TROOPS.executorArco.attackVisuals)
      .every((visual) => visual.height === 146)).toBe(true);
    expect(getUnlockedTroops(7).some((troop) => troop.id === "executorArco")).toBe(false);
    expect(getUnlockedTroops(8).some((troop) => troop.id === "executorArco")).toBe(true);
    expect(getTroopInfo(TROOPS.executorArco)).toMatchObject({
      specials: expect.arrayContaining([
        { label: "Finalização", value: "30% nos demais inimigos do mesmo tile" },
        { label: "Janela do combo", value: "1,8 s" },
      ]),
    });
  });

  it("inicializa estado independente por unidade", () => {
    const session = createSession();
    const first = place(session, 0, 2);
    const second = place(session, 1, 2);
    expect(first).toMatchObject({
      comboStep: 0, comboTargetId: null, comboExpiresAt: null,
      pendingComboImpact: null, attackTargetId: null, attackBusyUntil: 0,
      state: "idle",
    });
    first.comboStep = 2;
    expect(second.comboStep).toBe(0);
  });

  it("aceita apenas alvo terrestre, na mesma linha, à frente e dentro do alcance", () => {
    const session = createSession();
    const troop = place(session);
    const valid = enemy("valid", troop);
    expect(isEnemyWithinExecutorRange(troop, valid, TROOPS.executorArco)).toBe(true);
    expect(isEnemyWithinExecutorRange(troop, enemy("behind", troop, { x: troop.x - 1 }), TROOPS.executorArco)).toBe(false);
    expect(isEnemyWithinExecutorRange(troop, enemy("other_row", troop, { row: troop.row + 1 }), TROOPS.executorArco)).toBe(false);
    expect(isEnemyWithinExecutorRange(troop, enemy("far", troop, { x: troop.x + TROOPS.executorArco.range * CELL.width + 1 }), TROOPS.executorArco)).toBe(false);
    expect(isEnemyWithinExecutorRange(troop, enemy("air", troop, { type: "magoAbissal" }), TROOPS.executorArco)).toBe(false);
  });

  it("prioriza mesmo tile, distância, Alpha, Elite, HP e ID deterministicamente", () => {
    const session = createSession();
    const troop = place(session);
    const nextTile = enemy("next", troop, { x: (troop.col + 1) * CELL.width + 1 });
    const sameTile = enemy("same", troop, { x: troop.x + 45 });
    session.enemies = [nextTile, sameTile];
    expect(selectExecutorTarget(session, troop, TROOPS.executorArco, column)).toBe(sameTile);

    const common = enemy("common", troop, { hp: 999 });
    const elite = enemy("elite", troop, { type: "krakhul", hp: 50 });
    const alpha = enemy("alpha", troop, { hp: 10, variant: "alpha" });
    session.enemies = [common, elite, alpha];
    expect(selectExecutorTarget(session, troop, TROOPS.executorArco, column)).toBe(alpha);
    alpha.dead = true;
    expect(selectExecutorTarget(session, troop, TROOPS.executorArco, column)).toBe(elite);

    const highB = enemy("b", troop, { hp: 80 });
    const highA = enemy("a", troop, { hp: 80 });
    session.enemies = [highB, highA];
    expect(selectExecutorTarget(session, troop, TROOPS.executorArco, column)).toBe(highA);
  });

  it("limita o Corte de Arco à zona entre corpo a corpo e duas células", () => {
    const session = createSession();
    const troop = place(session);
    const melee = enemy("melee", troop, { x: troop.x + 1.25 * CELL.width });
    const edge = enemy("edge", troop, { x: troop.x + 2 * CELL.width });
    expect(isEnemyWithinExecutorRangedRange(troop, melee, TROOPS.executorArco)).toBe(false);
    expect(isEnemyWithinExecutorRangedRange(troop, edge, TROOPS.executorArco)).toBe(true);
    expect(isEnemyWithinExecutorRangedRange(troop,
      enemy("far", troop, { x: troop.x + 2 * CELL.width + 1 }), TROOPS.executorArco)).toBe(false);
    expect(isEnemyWithinExecutorRangedRange(troop,
      enemy("air", troop, { x: troop.x + 1.8 * CELL.width, airborne: true }), TROOPS.executorArco)).toBe(false);

    const nearest = enemy("nearest", troop, { x: troop.x + 1.5 * CELL.width, hp: 5 });
    const alpha = enemy("alpha", troop, { x: troop.x + 1.8 * CELL.width, variant: "alpha", hp: 999 });
    session.enemies = [alpha, nearest];
    expect(selectExecutorRangedTarget(session, troop, TROOPS.executorArco)).toBe(nearest);
  });

  it("dispara em alvo único sem avançar o combo e compartilha o cooldown", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { x: troop.x + 1.8 * CELL.width });
    const bystander = enemy("bystander", troop, { x: target.x + 2 });
    session.enemies = [target, bystander];

    stepBattle(session, 1);
    expect(troop).toMatchObject({
      state: "attackRanged", lastAttackMode: "ranged", comboStep: 0, comboTargetId: null,
    });
    expect(session.projectiles[0]).toMatchObject({
      kind: "executorArcSlash", targetId: target.id, launched: false, damage: 4,
    });
    stepBattle(session, 570);
    expect(target.hp).toBe(96);
    expect(bystander.hp).toBe(100);
    expect(troop.comboStep).toBe(0);

    target.x = troop.x + CELL.width;
    stepBattle(session, 629);
    expect(troop.comboStep).toBe(0);
    stepBattle(session, 1);
    expect(troop.lastAttackMode).toBe("combo1");
  });

  it("descarta o Corte de Arco quando o alvo morre antes do impacto", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { x: troop.x + 1.8 * CELL.width });
    const replacement = enemy("replacement", troop, { x: target.x + 3 });
    session.enemies = [target, replacement];
    stepBattle(session, 1);
    target.dead = true;
    target.hp = 0;
    stepBattle(session, TROOPS.executorArco.rangedAttackVisual.releaseMs);
    expect(replacement.hp).toBe(100);
    expect(session.projectiles).toHaveLength(0);
  });

  it("aplica Ataque 1 somente no impacto e mantém o alvo bloqueado", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop);
    session.enemies = [target];
    const { before, impact } = startAndImpact(session, TROOPS.executorArco.attackVisuals.combo1.impactMs);
    expect(target.hp).toBe(94);
    expect(before.some((event) => event.type === "executorSlash")).toBe(false);
    expect(impact).toContainEqual(expect.objectContaining({ type: "executorSlash", combo: 1, targetId: target.id }));
    expect(troop).toMatchObject({
      comboStep: 1, comboTargetId: target.id, attackTargetId: target.id,
      lastAttackMode: "combo1", state: "attack1",
    });
    expect(troop.comboExpiresAt).toBe(session.elapsed + TROOPS.executorArco.comboWindowMs);

    const closer = enemy("closer", troop, { x: troop.x + 1 });
    session.enemies.unshift(closer);
    stepBattle(session, 280);
    expect(troop.pendingComboImpact).toMatchObject({ mode: "combo2", targetId: target.id });
  });

  it("executa Ataque 2 no alvo bloqueado sem dano colateral", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop);
    const bystander = enemy("bystander", troop, { x: target.x + 5 });
    session.enemies = [target, bystander];
    startAndImpact(session, 240);
    stepBattle(session, 280);
    expect(troop).toMatchObject({ lastAttackMode: "combo2", state: "attack2" });
    stepBattle(session, 260);
    expect(target.hp).toBe(87);
    expect(bystander.hp).toBe(100);
    expect(troop.comboStep).toBe(2);
  });

  it("finaliza com 30% no mesmo tile, sem duplicar o alvo nem atingir tile ou linha adjacente", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { hp: 100 });
    const collateral = enemy("collateral", troop, { x: target.x + 5, hp: 100 });
    const adjacent = enemy("adjacent", troop, { x: (column(target) + 1) * CELL.width + 1, hp: 100 });
    const otherRow = enemy("other_row", troop, { row: troop.row + 1, hp: 100 });
    session.enemies = [target, collateral, adjacent, otherRow];

    startAndImpact(session, 240);
    stepBattle(session, 280);
    stepBattle(session, 260);
    stepBattle(session, 260);
    expect(troop).toMatchObject({ state: "attack3", lastAttackMode: "combo3" });
    const events = stepBattle(session, 400);

    expect(target.hp).toBe(63);
    expect(collateral.hp).toBeCloseTo(92.8, 5);
    expect(adjacent.hp).toBe(100);
    expect(otherRow.hp).toBe(100);
    const finisher = events.find((event) => event.type === "executorFinisher");
    expect(finisher).toEqual(expect.objectContaining({
      type: "executorFinisher",
      targetId: target.id,
      targetIds: expect.arrayContaining([target.id, collateral.id]),
      damage: 24,
    }));
    expect(finisher.collateralDamage).toBeCloseTo(7.2, 5);
    expect(troop).toMatchObject({ comboStep: 0, comboTargetId: null, pendingComboImpact: null });
    expect(troop).toMatchObject({ state: "attack3", lastAttackMode: "combo3" });
    expect(getTroopAnimation(troop, TROOPS.executorArco, session.elapsed + 230, { attack3: 8 }))
      .toEqual({ state: "attack3", frame: 7 });
  });

  it("mantém o colateral quando o golpe final mata o alvo principal e respeita escudos", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { hp: 10, shield: 5 });
    const collateral = enemy("collateral", troop, { x: troop.x + 44, hp: 100, shield: 2 });
    session.enemies = [target, collateral];
    expect(forceExecutorCombo(session, 3).ok).toBe(true);
    startAndImpact(session, 400);
    expect(target.dead).toBe(true);
    expect(collateral.shield).toBe(0);
    expect(collateral.hp).toBeCloseTo(94.8, 5);
  });

  it("reinicia por morte, saída de alcance e expiração sem transferir a etapa", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop);
    const replacement = enemy("replacement", troop, { x: troop.x + 60 });
    session.enemies = [target, replacement];
    startAndImpact(session, 240);
    target.dead = true;
    stepBattle(session, 280);
    expect(troop.comboStep).toBe(0);
    expect(troop.comboTargetId).toBe(replacement.id);

    replacement.x = troop.x + TROOPS.executorArco.range * CELL.width + 2;
    stepBattle(session, 240);
    expect(troop.comboTargetId).toBeNull();

    const third = enemy("third", troop);
    session.enemies = [third];
    troop.attackBusyUntil = session.elapsed;
    troop.attackReadyAt = session.elapsed;
    startAndImpact(session, 240);
    troop.attackReadyAt = session.elapsed + 4000;
    stepBattle(session, TROOPS.executorArco.comboWindowMs);
    expect(troop).toMatchObject({ comboStep: 0, comboTargetId: third.id });
  });

  it("cancela alvo morto antes do impacto e não reaplica o mesmo impacto", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { hp: 6 });
    const replacement = enemy("replacement", troop, { x: troop.x + 60 });
    session.enemies = [target, replacement];
    stepBattle(session, 1);
    target.dead = true;
    stepBattle(session, 240);
    expect(replacement.hp).toBe(100);
    expect(troop).toMatchObject({ comboStep: 0, pendingComboImpact: null });

    target.dead = false;
    target.hp = 6;
    session.enemies = [target];
    troop.attackBusyUntil = session.elapsed;
    troop.attackReadyAt = session.elapsed;
    startAndImpact(session, 240);
    expect(target.dead).toBe(true);
    expect(troop.comboStep).toBe(0);
    const hpAfterImpact = target.hp;
    stepBattle(session, 1);
    expect(target.hp).toBe(hpAfterImpact);
  });

  it("reinicia quando o Ataque 2 elimina o alvo", () => {
    const session = createSession();
    const troop = place(session);
    const target = enemy("target", troop, { hp: 7 });
    session.enemies = [target];
    expect(forceExecutorCombo(session, 2).ok).toBe(true);
    startAndImpact(session, 260);
    expect(target.dead).toBe(true);
    expect(troop).toMatchObject({
      comboStep: 0, comboTargetId: null, pendingComboImpact: null,
    });
  });

  it("permite dois Vórtices independentes atacarem o mesmo alvo", () => {
    const session = createSession();
    const first = place(session, 1, 2);
    const second = place(session, 1, 3);
    const target = enemy("target", second, { x: second.x + 20, hp: 200 });
    session.enemies = [target];
    stepBattle(session, 1);
    expect(first.comboTargetId).toBe(target.id);
    expect(second.comboTargetId).toBe(target.id);
    stepBattle(session, 240);
    expect(first.comboStep).toBe(1);
    expect(second.comboStep).toBe(1);
    first.comboStep = 2;
    expect(second.comboStep).toBe(1);
  });

  it("força o próximo passo no Vórtice mais recente e agrupa spawns no mesmo tile", () => {
    const session = createSession();
    const first = place(session, 0, 2);
    const latest = place(session, 1, 2);
    const target = enemy("target", latest);
    session.enemies = [target];
    expect(forceExecutorCombo(session, 3)).toMatchObject({ ok: true, troop: latest, step: 3 });
    expect(latest.comboStep).toBe(2);
    expect(first.comboStep).toBe(0);

    const grouped = spawnEnemy(session, { type: "medu", row: 2, count: 5, groupInTile: true });
    expect(grouped.ok).toBe(true);
    expect(new Set(grouped.enemies.map(column))).toHaveLength(1);
  });

  it("seleciona animações por estado e possui fallback seguro para frames ausentes", () => {
    const config = TROOPS.executorArco;
    const troop = {
      type: "executorArco", state: "attack2", lastAttackMode: "combo2",
      lastAttackAt: 100, stateStartedAt: 100,
    };
    expect(getTroopAnimation(troop, config, 360, { attack2: 8 })).toEqual({ state: "attack2", frame: 4 });
    troop.state = "attackRanged";
    troop.lastAttackMode = "ranged";
    troop.lastAttackAt = 100;
    troop.stateStartedAt = 100;
    expect(getTroopAnimation(troop, config, 420, { attackRanged: 8 }))
      .toEqual({ state: "attackRanged", frame: 4 });
    const idle = { id: "idle" };
    expect(resolveTroopFrame({ attack2: Array(8), idle: [idle] }, "attack2", 4)).toBe(idle);
    expect(resolveTroopFrame({}, "attack3", 7)).toBeNull();
  });

  it("mantém o X no movimento reduzido e reduz partículas secundárias", () => {
    const event = { type: "executorFinisher", x: 100, y: 100, color: "#fb923c", seed: 9 };
    const normal = createExecutorParticles(event, 0, { reduceMotion: false });
    const reduced = createExecutorParticles(event, 0, { reduceMotion: true });
    expect(normal.some((particle) => particle.kind === "executorX")).toBe(true);
    expect(reduced.some((particle) => particle.kind === "executorX")).toBe(true);
    expect(reduced.length).toBeLessThan(normal.length);
  });

  it("mantém canais de som opcionais ausentes sem exigir assets", () => {
    const available = {};
    const optional = ["executor_slash_1.ogg", "executor_slash_2.wav", "executor_finisher.ogg", "executor_combo_reset.wav"];
    expect(optional.map((name) => available[name] || null)).toEqual([null, null, null, null]);
    expect(ENEMIES.medu).toBeTruthy();
  });
});
