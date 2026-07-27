import { FIELD } from "./visualGeometry.js";

const POSITIONAL_DEFAULTS = Object.freeze({
  targetSize: 1,
  selectionColor: "#22d3ee",
  confirmationColor: "#67e8f9",
  requiresOccupiedTarget: false,
});

export function getPositionalMetadata(decision) {
  if (!decision?.positional || !decision.targetType) return null;
  return { ...POSITIONAL_DEFAULTS, ...decision };
}

export function normalizePositionalTarget(decision, target) {
  const metadata = getPositionalMetadata(decision);
  if (!metadata) return null;
  if (metadata.targetType === "row" || metadata.targetType === "occupiedRow") {
    const row = Number(target?.row);
    return Number.isInteger(row) && row >= 0 && row < FIELD.rows ? { row } : null;
  }
  if (metadata.targetType === "columnBlock") {
    const size = metadata.targetSize || 3;
    if (size !== 3) return null;
    const supplied = Array.isArray(target?.columns) ? target.columns : [];
    let centerCol = Number(target?.centerCol);
    if (!Number.isInteger(centerCol) && supplied.length === 3) centerCol = Number(supplied[1]);
    centerCol = Math.max(FIELD.firstTroopCol + 1, Math.min(FIELD.lastTroopCol - 1, centerCol));
    if (!Number.isInteger(centerCol)) return null;
    const columns = [centerCol - 1, centerCol, centerCol + 1];
    if (supplied.length && supplied.some((column, index) => Number(column) !== columns[index])) return null;
    return { centerCol, columns };
  }
  return null;
}

export function validatePositionalTarget(session, decision, target) {
  const normalized = normalizePositionalTarget(decision, target);
  if (!normalized) return { valid: false, reason: "Alvo inválido.", target: null };
  const metadata = getPositionalMetadata(decision);
  if (metadata.targetType === "occupiedRow" || metadata.requiresOccupiedTarget) {
    const occupied = (session?.troops || []).some((troop) => !troop.dead && troop.row === normalized.row);
    if (!occupied) return { valid: false, reason: "ROTA VAZIA", target: normalized };
  }
  return { valid: true, reason: null, target: normalized };
}

export function getPositionalTargetPreview(session, decision, hoveredCell) {
  const metadata = getPositionalMetadata(decision);
  if (!metadata || !hoveredCell) return null;
  const candidate = metadata.targetType === "columnBlock"
    ? { centerCol: hoveredCell.col }
    : { row: hoveredCell.row };
  const result = validatePositionalTarget(session, metadata, candidate);
  const enemyIds = result.target?.row == null ? [] : (session?.enemies || [])
    .filter((enemy) => !enemy.dead && enemy.row === result.target.row)
    .map((enemy) => enemy.id);
  return {
    type: metadata.targetType === "columnBlock" ? "columnBlock" : "row",
    ...result.target,
    valid: result.valid,
    reason: result.reason,
    enemyIds,
    dimInactive: true,
    decisionId: metadata.id,
    effectKind: metadata.effectKind,
    selectionColor: metadata.selectionColor,
    confirmationColor: metadata.confirmationColor,
  };
}

export function createPositionalConfirmationEvent(session, decision, target) {
  const result = validatePositionalTarget(session, decision, target);
  if (!result.valid) return null;
  const troopIds = (session?.troops || []).filter((troop) => !troop.dead && (
    result.target.row != null ? troop.row === result.target.row : result.target.columns.includes(troop.col)
  )).map((troop) => troop.id);
  const base = { troopIds, color: decision.confirmationColor || decision.selectionColor };
  switch (decision.id) {
    case "route_fortification":
      return { type: "routeFortified", row: result.target.row, hpBonus: 0.2, ...base };
    case "focused_fire":
      return { type: "focusedFireActivated", row: result.target.row, damageBonus: 0.18, ...base };
    case "advanced_formation":
      return { type: "advancedFormationActivated", columns: [...result.target.columns], damageBonus: 0.15, damageTaken: 0.1, ...base };
    case "emergency_orbital":
      return {
        type: "fortuneOrbitalStrike",
        row: result.target.row,
        enemyIds: (session?.enemies || []).filter((enemy) => !enemy.dead && enemy.row === result.target.row).map((enemy) => enemy.id),
        ...base,
      };
    default:
      return decision.confirmationEventType
        ? { type: decision.confirmationEventType, ...result.target, ...base }
        : null;
  }
}

export function positionalTargetMessage(decision, target) {
  if (decision.id === "route_fortification") return `Rota ${target.row + 1} fortificada. Tropas atuais e futuras recebem +20% de HP máximo.`;
  if (decision.id === "focused_fire") return `Fogo concentrado ativado na Rota ${target.row + 1}.`;
  if (decision.id === "advanced_formation") return `Formação avançada ativada nas colunas C${target.columns[0] + 1} a C${target.columns[2] + 1}.`;
  if (decision.id === "emergency_orbital") return `Ataque orbital confirmado na Rota ${target.row + 1}.`;
  return `${decision.label}: alvo confirmado.`;
}

export function positionalTargetInstruction(decision) {
  if (decision.targetType === "columnBlock") return `${decision.label}: escolha três colunas adjacentes.`;
  const occupied = decision.targetType === "occupiedRow" || decision.requiresOccupiedTarget;
  return `${decision.label}: selecione ${occupied ? "uma rota ocupada" : "uma rota"}.`;
}
