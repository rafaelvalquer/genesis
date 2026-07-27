import { describe, expect, it } from "vitest";
import { DECISIONS } from "./content.js";
import { ADAPTIVE_AID_OPTIONS } from "./adaptiveAid.js";
import { getFocusedFireDamageMultiplier } from "./battleModel.js";
import {
  createPositionalConfirmationEvent,
  getPositionalTargetPreview,
  normalizePositionalTarget,
  positionalTargetMessage,
  validatePositionalTarget,
} from "./positionalTargeting.js";

const troop = (id, row, col) => ({ id, row, col, dead: false });

describe("sistema genérico de alvos posicionais", () => {
  it("exige targetType em todas as decisões posicionais", () => {
    Object.values(DECISIONS).filter((decision) => decision.positional)
      .forEach((decision) => expect(decision.targetType, decision.id).toBeTruthy());
  });

  it("valida rotas ocupadas sem consumir alvos vazios", () => {
    const session = { troops: [troop("t1", 2, 1)], enemies: [] };
    expect(validatePositionalTarget(session, DECISIONS.route_fortification, { row: 2 }).valid).toBe(true);
    expect(validatePositionalTarget(session, DECISIONS.route_fortification, { row: 3 }))
      .toMatchObject({ valid: false, reason: "ROTA VAZIA", target: { row: 3 } });
    expect(validatePositionalTarget(session, DECISIONS.focused_fire, { row: 3 }).valid).toBe(false);
  });

  it("limita a Formação avançada a três colunas adjacentes dentro do campo", () => {
    expect(normalizePositionalTarget(DECISIONS.advanced_formation, { centerCol: -10 }).columns).toEqual([1, 2, 3]);
    expect(normalizePositionalTarget(DECISIONS.advanced_formation, { centerCol: 99 }).columns).toEqual([7, 8, 9]);
    expect(normalizePositionalTarget(DECISIONS.advanced_formation, { columns: [1, 3, 4] })).toBeNull();
  });

  it("marca áreas inativas e diferencia preview válido e inválido", () => {
    const session = { troops: [troop("t1", 1, 2)], enemies: [] };
    expect(getPositionalTargetPreview(session, DECISIONS.focused_fire, { row: 1, col: 3 }))
      .toMatchObject({ valid: true, dimInactive: true, row: 1, effectKind: "damage" });
    expect(getPositionalTargetPreview(session, DECISIONS.focused_fire, { row: 4, col: 3 }))
      .toMatchObject({ valid: false, dimInactive: true, reason: "ROTA VAZIA" });
    expect(getPositionalTargetPreview(session, DECISIONS.focused_fire, null)).toBeNull();
  });

  it("gera um evento semântico distinto para cada vantagem", () => {
    const session = {
      troops: [troop("t1", 1, 2)],
      enemies: [{ id: "e1", row: 1, dead: false }],
    };
    expect(createPositionalConfirmationEvent(session, DECISIONS.route_fortification, { row: 1 }).type).toBe("routeFortified");
    expect(createPositionalConfirmationEvent(session, DECISIONS.focused_fire, { row: 1 }).type).toBe("focusedFireActivated");
    expect(createPositionalConfirmationEvent(session, DECISIONS.advanced_formation, { columns: [1, 2, 3] }).type).toBe("advancedFormationActivated");
    const orbital = ADAPTIVE_AID_OPTIONS.find((option) => option.id === "emergency_orbital");
    expect(createPositionalConfirmationEvent(session, orbital, { row: 1 }))
      .toMatchObject({ type: "fortuneOrbitalStrike", row: 1, enemyIds: ["e1"] });
    expect(positionalTargetMessage(DECISIONS.focused_fire, { row: 1 })).toBe("Fogo concentrado ativado na Rota 2.");
  });

  it("restringe Fogo concentrado à rota e ao inimigo mais próximo da base nela", () => {
    const near = { id: "near", row: 2, x: 180, dead: false };
    const far = { id: "far", row: 2, x: 420, dead: false };
    const other = { id: "other", row: 1, x: 100, dead: false };
    const session = {
      modifiers: { focusedFire: true },
      focusedFireRow: 2,
      enemies: [far, other, near],
    };
    expect(getFocusedFireDamageMultiplier(session, troop("selected", 2, 2), near)).toBe(1.18);
    expect(getFocusedFireDamageMultiplier(session, troop("selected", 2, 2), far)).toBe(1);
    expect(getFocusedFireDamageMultiplier(session, troop("other", 1, 2), other)).toBe(1);
  });
});
