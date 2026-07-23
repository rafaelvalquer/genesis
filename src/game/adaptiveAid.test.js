import { describe, expect, it } from "vitest";
import { PHASES, TROOPS } from "./content.js";
import {
  ADAPTIVE_AID_OPTIONS,
  adaptiveAidBlocksIntermission,
  adaptiveAidPausesSimulation,
  calculateHardshipScore,
  createAdaptiveAidState,
  getEligibleAdaptiveAidOptions,
  recordTroopLoss,
  evaluateAdaptiveAid,
  updateAdaptiveAid,
} from "./adaptiveAid.js";
import {
  canPlaceTroop,
  createBattleSession,
  getSnapshot,
  openAdaptiveAidCapsule,
  placeTroop,
  selectAdaptiveAidOption,
  simulateAdaptiveAid,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";

const phase = { ...PHASES[3], waves: PHASES[3].waves.slice(0, 4), targetDurationMs: 120000 };

function makeSession(options = {}) {
  return createBattleSession(phase, ["colono", "marine", "reator"], 4401, options);
}

function prepareChoice(session, optionId) {
  const option = ADAPTIVE_AID_OPTIONS.find((entry) => entry.id === optionId);
  session.adaptiveAid.status = "choosing";
  session.adaptiveAid.triggered = true;
  session.adaptiveAid.availableOptions = [{ ...option }];
}

describe("Protocolo Fortuna", () => {
  it("calcula os sinais de perigo e limita o score", () => {
    const session = makeSession();
    session.integrity = 25;
    session.energy = 0;
    session.recentTroopLosses = Array.from({ length: 4 }, (_, index) => ({ cause: "enemy", at: index }));
    session.enemies = Array.from({ length: 10 }, (_, index) => ({
      id: `danger_${index}`, type: "medu", row: index % 5, x: 150, dead: false,
    }));
    session.waveActive = true;
    session.waveStartedAt = 0;
    session.elapsed = 50000;
    expect(calculateHardshipScore(session)).toBe(8);
  });

  it("conta duas rotas ameaçadas sem defesa e ignora a ausência de ameaça", () => {
    const session = makeSession();
    session.enemies = [0, 1].map((row) => ({ id: `threat_${row}`, type: "medu", row, x: 300, dead: false }));
    expect(calculateHardshipScore(session)).toBe(1);
    session.enemies = [];
    expect(calculateHardshipScore(session)).toBe(0);
  });

  it("avalia a cada segundo sem misturar a progressão da cápsula", () => {
    const session = makeSession();
    session.waveIndex = 1;
    session.waveActive = true;
    session.integrity = 30;
    session.queue = [{ type: "medu", spawnAtMs: 5000 }];
    session.elapsed = 999;
    evaluateAdaptiveAid(session, []);
    expect(session.adaptiveAid.lastEvaluationAt).toBe(0);
    session.elapsed = 1000;
    evaluateAdaptiveAid(session, []);
    expect(session.adaptiveAid.lastEvaluationAt).toBe(1000);
    expect(session.adaptiveAid.dangerSince).toBe(1000);
  });

  it("bloqueia intervalos com qualquer cápsula ativa e pausa somente escolha e alvo", () => {
    ["incoming", "landed", "opening", "choosing", "targeting"].forEach((status) => {
      expect(adaptiveAidBlocksIntermission(status)).toBe(true);
    });
    expect(adaptiveAidPausesSimulation("choosing")).toBe(true);
    expect(adaptiveAidPausesSimulation("targeting")).toBe(true);
    expect(adaptiveAidPausesSimulation("landed")).toBe(false);
  });

  it("exige 50% da fase e seis segundos estáveis para situação difícil", () => {
    const session = makeSession();
    session.waveActive = true;
    session.integrity = 30;
    session.elapsed = 1000;
    updateAdaptiveAid(session, []);
    expect(session.adaptiveAid.triggered).toBe(false);
    session.waveIndex = 1;
    session.queue = [{ type: "medu", spawnAtMs: 9000 }];
    session.elapsed = 2000;
    updateAdaptiveAid(session, []);
    expect(session.adaptiveAid.dangerSince).toBe(2000);
    session.elapsed = 3000;
    updateAdaptiveAid(session, []);
    expect(session.adaptiveAid.triggered).toBe(false);
    session.elapsed = 7000;
    updateAdaptiveAid(session, []);
    expect(session.adaptiveAid.triggered).toBe(false);
    session.elapsed = 8000;
    updateAdaptiveAid(session, []);
    expect(session.adaptiveAid).toMatchObject({ triggered: true, triggerTier: "difficult" });
  });

  it("aciona situação crítica imediatamente e nunca duas vezes", () => {
    const session = makeSession();
    session.waveIndex = 1;
    session.waveActive = true;
    session.integrity = 20;
    session.recentTroopLosses = Array.from({ length: 4 }, () => ({ cause: "enemy", at: 0 }));
    session.enemies = [{ id: "critical_threat", type: "medu", row: 0, x: 150, hp: 10, maxHp: 10, dead: false }];
    session.elapsed = 1000;
    const events = [];
    updateAdaptiveAid(session, events);
    expect(session.adaptiveAid.triggerTier).toBe("critical");
    const optionIds = session.adaptiveAid.availableOptions.map((option) => option.id);
    session.elapsed = 5000;
    updateAdaptiveAid(session, events);
    expect(events.filter((event) => event.type === "adaptiveAidTriggered")).toHaveLength(1);
    expect(session.adaptiveAid.availableOptions.map((option) => option.id)).toEqual(optionIds);
  });

  it("não ativa automaticamente no Campo de Provas, mas aceita simulação explícita", () => {
    const session = makeSession({ sandbox: true });
    session.integrity = 1;
    stepBattle(session, 5000);
    expect(session.adaptiveAid.triggered).toBe(false);
    expect(simulateAdaptiveAid(session, "critical")).toMatchObject({ ok: true, tier: "critical" });
    expect(simulateAdaptiveAid(session, "difficult")).toMatchObject({ ok: false });
  });

  it("percorre chegada, pouso, abertura e escolha", () => {
    const session = makeSession({ sandbox: true });
    expect(simulateAdaptiveAid(session, "critical").ok).toBe(true);
    stepBattle(session, 900);
    expect(session.adaptiveAid.status).toBe("landed");
    expect(openAdaptiveAidCapsule(session).ok).toBe(true);
    stepBattle(session, 800);
    expect(session.adaptiveAid.status).toBe("choosing");
  });

  it("reserva a célula da cápsula contra tropas", () => {
    const session = makeSession({ sandbox: true, sandboxSettings: { rulesMode: "real" } });
    simulateAdaptiveAid(session, "critical");
    const { row, col } = session.adaptiveAid.capsule;
    expect(canPlaceTroop(session, "colono", row, col)).toBe("Célula ocupada pela Cápsula da Colônia.");
  });

  it("mantém pools por tier, duas opções únicas e sorteio estável", () => {
    const difficult = makeSession({ sandbox: true });
    const critical = makeSession({ sandbox: true });
    simulateAdaptiveAid(difficult, "difficult");
    simulateAdaptiveAid(critical, "critical");
    expect(difficult.adaptiveAid.availableOptions).toHaveLength(2);
    expect(new Set(difficult.adaptiveAid.availableOptions.map((option) => option.id)).size).toBe(2);
    expect(difficult.adaptiveAid.availableOptions.every((option) => option.rarity !== "epic")).toBe(true);
    expect(critical.adaptiveAid.availableOptions.every((option) => option.rarity !== "common")).toBe(true);
    expect(getEligibleAdaptiveAidOptions(difficult, "difficult").length).toBeGreaterThanOrEqual(2);
  });

  it("aplica energia, reparo e reset de cooldown respeitando limites", () => {
    const session = makeSession();
    session.energy = session.energyMax - 5;
    prepareChoice(session, "energy_reserve");
    expect(selectAdaptiveAidOption(session, "energy_reserve").ok).toBe(true);
    expect(session.energy).toBe(session.energyMax);
    session.integrity = 92;
    session.adaptiveAid = createAdaptiveAidState(true);
    prepareChoice(session, "contingency_repairs");
    selectAdaptiveAidOption(session, "contingency_repairs");
    expect(session.integrity).toBe(session.integrityMax);
    session.deployCooldowns.colono = 9999;
    session.adaptiveAid = createAdaptiveAidState(true);
    prepareChoice(session, "logistics_sync");
    selectAdaptiveAidOption(session, "logistics_sync");
    expect(session.deployCooldowns.colono).toBe(session.elapsed);
  });

  it("dá prioridade à implantação gratuita sem consumir outros descontos", () => {
    const session = makeSession();
    prepareChoice(session, "free_reinforcement");
    selectAdaptiveAidOption(session, "free_reinforcement");
    session.efficientBatteryCharges = 2;
    session.emergencyContractCharges = 1;
    const energy = session.energy;
    expect(placeTroop(session, "colono", 0, 1).ok).toBe(true);
    expect(session.energy).toBe(energy);
    expect(session.supply).toBe(session.supplyMax - TROOPS.colono.supply);
    expect(session.fortuneFreeDeploymentCharges).toBe(0);
    expect(session.efficientBatteryCharges).toBe(2);
    expect(session.emergencyContractCharges).toBe(1);
  });

  it("aplica barreira, cura e pulso com resistência de Alfa", () => {
    const barrier = makeSession();
    prepareChoice(barrier, "core_barrier");
    selectAdaptiveAidOption(barrier, "core_barrier");
    expect(barrier.shieldCharges).toBe(2);

    const healing = makeSession({ sandbox: true });
    const troop = placeTroop(healing, "colono", 0, 1).troop;
    troop.hp = troop.maxHp - 40;
    prepareChoice(healing, "maintenance_drone");
    selectAdaptiveAidOption(healing, "maintenance_drone");
    expect(troop.hp).toBe(troop.maxHp - 30);

    const pulse = makeSession({ sandbox: true });
    const common = spawnEnemy(pulse, { type: "medu", row: 0 }).enemies[0];
    const alpha = spawnEnemy(pulse, { type: "medu", row: 1, variant: "alpha" }).enemies[0];
    prepareChoice(pulse, "containment_pulse");
    selectAdaptiveAidOption(pulse, "containment_pulse");
    expect(common.stunnedUntil).toBe(2000);
    expect(alpha.stunnedUntil).toBe(500);
  });

  it("orbital exige rota e afeta somente seus hostis", () => {
    const session = makeSession({ sandbox: true });
    const target = spawnEnemy(session, { type: "medu", row: 2 }).enemies[0];
    const other = spawnEnemy(session, { type: "medu", row: 3 }).enemies[0];
    prepareChoice(session, "emergency_orbital");
    expect(selectAdaptiveAidOption(session, "emergency_orbital")).toMatchObject({ ok: true, targeting: true });
    selectAdaptiveAidOption(session, "emergency_orbital", { row: 2 });
    expect(target.hp).toBe(target.maxHp * 0.5);
    expect(other.hp).toBe(other.maxHp);
    expect(session.adaptiveAid.status).toBe("resolved");
  });

  it("reconstrói apenas perdas inimigas recentes", () => {
    const session = makeSession();
    recordTroopLoss(session, { id: "lost", type: "colono", row: 1, col: 2, maxHp: 80, energyCost: 7, supplyCost: 2, dead: true }, "enemy");
    recordTroopLoss(session, { id: "manual", type: "marine", row: 2, col: 2, maxHp: 60, dead: true }, "manualRemoval");
    prepareChoice(session, "combat_reconstruction");
    expect(selectAdaptiveAidOption(session, "combat_reconstruction").ok).toBe(true);
    expect(session.troops).toHaveLength(1);
    expect(session.troops[0]).toMatchObject({ type: "colono", hp: 40, dead: false });
  });

  it("reconstrói entidades limpas sem consumir recursos e recalcula doutrinas e fortificação", () => {
    const session = makeSession({ sandbox: true, sandboxSettings: { rulesMode: "free" } });
    session.modifiers.firstImpact = true;
    session.modifiers.humanSwarmDoctrine = true;
    session.fortifiedRow = 1;
    [[1, 1], [1, 3], [2, 1], [3, 1]].forEach(([row, col]) => placeTroop(session, "colono", row, col));
    recordTroopLoss(session, {
      id: "dirty", type: "colono", row: 1, col: 2, hp: 0, maxHp: 96, baseMaxHp: 80,
      fortificationBonusMaxHp: 16, energyCost: 7, supplyCost: 2, dead: true,
      state: "attack", comboStep: 3, channelingAttack: true, defenseActive: true,
      attachedParasiteId: "parasite", webSlowUntil: 9999, reactiveShield: 40,
    }, "enemy");
    const resources = { energy: session.energy, supply: session.supply, deployed: { ...session.deployed } };
    prepareChoice(session, "combat_reconstruction");
    expect(selectAdaptiveAidOption(session, "combat_reconstruction").ok).toBe(true);
    const restored = session.troops.find((troop) => troop.id.startsWith("fortune_reconstructed_"));
    expect(restored).toMatchObject({
      row: 1, col: 2, state: "idle", comboStep: 0, channelingAttack: false,
      defenseActive: false, attachedParasiteId: null, webSlowUntil: 0,
      reactiveShield: 0, firstImpactAvailable: true, swarmHpApplied: true, dead: false,
    });
    expect(restored.maxHp).toBeCloseTo(80 * 1.2 * 1.1);
    expect(restored.hp).toBeCloseTo(restored.maxHp * 0.5);
    expect({ energy: session.energy, supply: session.supply, deployed: session.deployed }).toEqual(resources);
  });

  it("expõe snapshot e telemetria sem interferir na estrela", () => {
    const session = makeSession({ sandbox: true });
    simulateAdaptiveAid(session, "critical");
    const snapshot = getSnapshot(session);
    expect(snapshot).toMatchObject({ assistanceTriggered: true, assistanceUsed: false });
    expect(snapshot.adaptiveAid.availableOptions).toHaveLength(2);
  });

  it("adia a vitória até uma cápsula ativa ser resolvida", () => {
    const finalPhase = { ...phase, waves: [phase.waves[0]] };
    const session = createBattleSession(finalPhase, ["colono", "marine"], 4402);
    session.waveActive = true;
    session.preparing = false;
    session.queue = [];
    session.enemies = [];
    session.adaptiveAid.status = "landed";
    session.adaptiveAid.triggered = true;
    session.adaptiveAid.capsule = { state: "idle", stateEndsAt: Infinity };
    stepBattle(session, 1);
    expect(session).toMatchObject({ outcome: null, pendingOutcome: "victory" });
    expect(getSnapshot(session).pendingOutcome).toBe("victory");
    session.adaptiveAid.status = "resolved";
    session.adaptiveAid.capsule = null;
    stepBattle(session, 1);
    expect(session).toMatchObject({ outcome: "victory", pendingOutcome: null });
  });
});
