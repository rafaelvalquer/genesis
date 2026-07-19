import { describe, expect, it } from "vitest";
import { PHASES, TROOPS } from "./content.js";
import {
  CELL,
  createBattleSession,
  placeTroop,
  removeTroop,
  selectNaniteAttackTarget,
  selectNaniteHealTarget,
  stepBattle,
} from "./battleModel.js";
import { getTroopAnimation } from "./visualGeometry.js";

const phase = { ...PHASES[0], id: "teste_medica_nanites", waves: [] };

function createSession() {
  return createBattleSession(phase, ["medicaNanites", "marine", "muralhaReforcada"], 2401, { sandbox: true });
}

function place(session, type, row, col, hp = null) {
  const result = placeTroop(session, type, row, col);
  expect(result.ok).toBe(true);
  if (hp != null) result.troop.hp = hp;
  return result.troop;
}

function enemy(id, row, col, overrides = {}) {
  return {
    id, type: "medu", row, x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2,
    hp: 100, maxHp: 100, speed: 0, damage: 0, attackReadyAt: Infinity, lastAttackAt: -Infinity,
    slowUntil: 0, slowFactor: 1, baseDamage: 0, bossPhase: 0, dead: false, moving: false,
    ...overrides,
  };
}

describe("Médica de Nanites", () => {
  it("centraliza os valores de balanceamento e estados visuais na configuração", () => {
    expect(TROOPS.medicaNanites).toMatchObject({
      hp: 24, range: 5, damage: 2, attackEveryMs: 900, projectileSpeed: 230,
      healRangeTiles: 5, maxHealingPerCharge: 20, healPulseAmount: 2,
      healPulseEveryMs: 400, healStartThreshold: 0.75, healCooldownMs: 5000,
      assetStates: ["idle", "heal", "attack", "cooldown"],
    });
    expect(TROOPS.medicaNanites.idleVisual).toMatchObject({ durationMs: 1600 });
    expect(TROOPS.medicaNanites.healVisual).toMatchObject({ durationMs: 1600, loop: true });
    expect(TROOPS.medicaNanites.attackVisual).toMatchObject({ durationMs: 480, releaseMs: 180 });
    expect(TROOPS.medicaNanites.cooldownVisual).toMatchObject({ durationMs: 1200, loop: true });
    expect(TROOPS.medicaNanites.attackVisual.shots[0]).toMatchObject({ atMs: 180, frame: 3 });
  });

  it("inicia cura estritamente abaixo de 75% e rejeita exatamente 75% ou mais", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const eligible = place(session, "marine", 0, 2);
    const boundary = place(session, "marine", 0, 3);
    eligible.hp = eligible.maxHp * 0.7499;
    boundary.hp = boundary.maxHp * 0.75;

    expect(selectNaniteHealTarget(session, medic)?.id).toBe(eligible.id);
    eligible.hp = eligible.maxHp * 0.75;
    expect(selectNaniteHealTarget(session, medic)).toBeNull();
  });

  it("mantém o alvo bloqueado e continua curando depois que ele ultrapassa 75%", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const target = place(session, "marine", 0, 2, 22);
    stepBattle(session, 1);
    expect(target.hp / target.maxHp).toBeGreaterThan(0.75);
    expect(medic.healTargetId).toBe(target.id);

    stepBattle(session, 399);
    expect(target.hp).toBe(24);
    stepBattle(session, 1);
    expect(target.hp).toBe(26);
    expect(medic).toMatchObject({ state: "healing", healTargetId: target.id, healedThisCharge: 4 });
  });

  it("seleciona somente aliados vivos, feridos, à frente, na mesma linha e até cinco tiles", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 2, 2);
    const valid = place(session, "marine", 2, 7, 10);
    place(session, "marine", 1, 4, 1);
    place(session, "marine", 2, 1, 1);
    place(session, "marine", 2, 8, 1);
    const full = place(session, "marine", 2, 5);
    const dead = place(session, "marine", 2, 6, 1);
    dead.dead = true;
    medic.hp = 1;

    expect(selectNaniteHealTarget(session, medic)?.id).toBe(valid.id);
    expect(full.hp).toBe(full.maxHp);
  });

  it("desempata por HP atual, percentual de vida e proximidade, sem selecionar a si mesma", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const farther = place(session, "marine", 0, 5, 10);
    const lowerRatio = place(session, "muralhaReforcada", 0, 4, 10);
    const nearestSameRatio = place(session, "muralhaReforcada", 0, 2, 10);
    expect(selectNaniteHealTarget(session, medic)?.id).toBe(nearestSameRatio.id);
    nearestSameRatio.hp = 11;
    expect(selectNaniteHealTarget(session, medic)?.id).toBe(lowerRatio.id);
    lowerRatio.hp = 12;
    expect(selectNaniteHealTarget(session, medic)?.id).toBe(farther.id);
  });

  it("cura gradualmente, bloqueia o alvo, limita a carga a 20 HP e entra em cooldown", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const target = place(session, "muralhaReforcada", 0, 3, 50);
    stepBattle(session, 1);
    expect(target.hp).toBe(52);
    expect(medic).toMatchObject({ state: "healing", healTargetId: target.id, healedThisCharge: 2 });

    const moreWounded = place(session, "marine", 0, 2, 1);
    stepBattle(session, 399);
    expect(medic.healTargetId).toBe(target.id);
    expect(moreWounded.hp).toBe(1);
    expect(target.hp).toBe(52);

    stepBattle(session, 1);
    for (let pulse = 0; pulse < 8; pulse += 1) stepBattle(session, 400);
    expect(target.hp).toBe(70);
    expect(medic).toMatchObject({ state: "cooldown", healedThisCharge: 20, healTargetId: null });
  });

  it("nunca ultrapassa maxHp e inicia cooldown quando o alvo completa a vida", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const target = place(session, "marine", 0, 2, 10);
    stepBattle(session, 1);
    target.hp = target.maxHp - 1;
    stepBattle(session, 400);
    expect(target.hp).toBe(target.maxHp);
    expect(medic).toMatchObject({ state: "cooldown", healedThisCharge: 3 });
  });

  it("encerra o ciclo quando o alvo é removido e restaura a carga após 5 segundos", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    place(session, "marine", 0, 2, 10);
    stepBattle(session, 1);
    removeTroop(session, 0, 2);
    stepBattle(session, 1);
    expect(medic.state).toBe("cooldown");
    const healed = medic.healedThisCharge;
    stepBattle(session, 4999);
    expect(medic.state).toBe("cooldown");
    expect(medic.healedThisCharge).toBe(healed);
    stepBattle(session, 1);
    expect(medic).toMatchObject({
      state: "idle", healedThisCharge: 0, healTargetId: null,
      cooldownStartedAt: null, cooldownEndsAt: null,
    });
  });

  it("prioriza inimigo no mesmo tile, preserva alvo e orçamento, e retoma a cura", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 1, 1);
    const target = place(session, "muralhaReforcada", 1, 2, 50);
    stepBattle(session, 1);
    const healedBeforeThreat = medic.healedThisCharge;
    const lockedId = medic.healTargetId;
    const threat = enemy("same_tile", 1, 1, { hp: 20, attackReadyAt: 10 });
    session.enemies.push(threat);
    stepBattle(session, 400);
    expect(medic.state).toBe("attacking");
    expect(medic.healTargetId).toBe(lockedId);
    expect(medic.healedThisCharge).toBe(healedBeforeThreat);
    expect(medic.attackTargetId).toBe(threat.id);

    session.enemies = [];
    stepBattle(session, 400);
    expect(medic.state).toBe("healing");
    expect(medic.healTargetId).toBe(target.id);
    expect(medic.healedThisCharge).toBe(healedBeforeThreat + 2);
  });

  it("cura antes de atacar à distância e só ataca inimigos à frente na mesma linha", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 2, 2);
    const ally = place(session, "marine", 2, 3, 10);
    const valid = enemy("valid", 2, 7);
    session.enemies.push(valid, enemy("behind", 2, 1), enemy("other", 1, 3), enemy("far", 2, 8));
    stepBattle(session, 1);
    expect(medic.state).toBe("healing");
    expect(medic.healTargetId).toBe(ally.id);
    expect(medic.attackTargetId).toBeNull();

    ally.hp = ally.maxHp;
    medic.healTargetId = null;
    medic.healedThisCharge = 0;
    medic.state = "idle";
    stepBattle(session, 1);
    expect(medic.attackTargetId).toBe(valid.id);
    expect(session.projectiles.find((projectile) => projectile.sourceTroopId === medic.id))
      .toMatchObject({ visualKind: "naniteBullet", damage: 2, targetId: valid.id });
  });

  it("escolhe no mesmo tile quem atacará primeiro e usa HP como desempate", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 2);
    const lowHp = enemy("low_hp", 0, 2, { hp: 5, attackReadyAt: 500 });
    const readyFirst = enemy("ready_first", 0, 2, { hp: 50, attackReadyAt: 100 });
    session.enemies.push(lowHp, readyFirst);
    expect(selectNaniteAttackTarget(session, medic)?.id).toBe(readyFirst.id);
    lowHp.attackReadyAt = 100;
    expect(selectNaniteAttackTarget(session, medic)?.id).toBe(lowHp.id);
  });

  it("bloqueia cura, ataque e reação ofensiva durante cooldown", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 3, 1);
    const ally = place(session, "marine", 3, 2, 10);
    stepBattle(session, 1);
    ally.hp = ally.maxHp - 1;
    stepBattle(session, 400);
    expect(medic.state).toBe("cooldown");
    const threat = enemy("cooldown_threat", 3, 1);
    session.enemies.push(threat);
    const projectileCount = session.projectiles.length;
    stepBattle(session, 1000);
    expect(medic.state).toBe("cooldown");
    expect(session.projectiles).toHaveLength(projectileCount);
    expect(threat.hp).toBe(100);
  });

  it("respeita 900 ms entre disparos e causa apenas o dano configurado", () => {
    const session = createSession();
    const medic = place(session, "medicaNanites", 0, 1);
    const target = enemy("target", 0, 3);
    session.enemies.push(target);
    stepBattle(session, 1);
    expect(medic.lastAttackAt).toBe(1);
    stepBattle(session, 899);
    expect(medic.lastAttackAt).toBe(1);
    stepBattle(session, 1);
    expect(medic.lastAttackAt).toBe(901);
    for (let index = 0; index < 50 && target.hp === 100; index += 1) stepBattle(session, 32);
    expect(target.hp).toBe(98);
  });

  it("mantém orçamento e cooldown independentes entre várias Médicas sem sobrecura", () => {
    const session = createSession();
    const first = place(session, "medicaNanites", 4, 1);
    const second = place(session, "medicaNanites", 4, 2);
    const target = place(session, "marine", 4, 3, 20);
    stepBattle(session, 1);
    expect(target.hp).toBe(24);
    expect(first.healedThisCharge).toBe(2);
    expect(second.healedThisCharge).toBe(2);
    expect(first.healTargetId).toBe(target.id);
    expect(second.healTargetId).toBe(target.id);
    expect(target.hp).toBeLessThanOrEqual(target.maxHp);
    expect(first.cooldownEndsAt).toBeNull();
    expect(second.cooldownEndsAt).toBeNull();
  });

  it("sincroniza os oito frames com as novas durações e o disparo no frame 3", () => {
    const config = TROOPS.medicaNanites;
    const frameCounts = { idle: 8, heal: 8, attack: 8, cooldown: 8 };
    const medic = {
      type: "medicaNanites",
      state: "healing",
      stateStartedAt: 0,
      lastAttackAt: -Infinity,
    };
    expect(getTroopAnimation(medic, config, 200, frameCounts)).toEqual({ state: "heal", frame: 1 });
    medic.state = "cooldown";
    expect(getTroopAnimation(medic, config, 150, frameCounts)).toEqual({ state: "cooldown", frame: 1 });
    medic.state = "attacking";
    medic.lastAttackAt = 0;
    expect(getTroopAnimation(medic, config, 180, frameCounts)).toEqual({ state: "attack", frame: 3 });
  });
});
