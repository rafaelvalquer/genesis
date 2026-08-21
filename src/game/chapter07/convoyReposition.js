import { CELL } from "../visualGeometry.js";
import { getPlacementBlockReasonForPhase } from "../phaseRules.js";

export function repositionTroop(session, troopId, row, col, rebuildIndex = () => {}) {
  if (session.convoyFlow?.state !== "checkpointPreparation") return { ok: false, reason: "Reposicionamento disponível somente no checkpoint." };
  const troop = session.troops.find((entry) => entry.id === troopId && !entry.dead);
  if (!troop) return { ok: false, reason: "Tropa não encontrada." };
  const phaseReason = getPlacementBlockReasonForPhase(session.phase, row, col, troop.type);
  if (phaseReason) return { ok: false, reason: phaseReason };
  if (session.troops.some((entry) => entry.id !== troopId && !entry.dead && entry.row === row && entry.col === col)) return { ok: false, reason: "Célula ocupada." };
  troop.row = row; troop.col = col;
  troop.x = col * CELL.width + CELL.width / 2;
  troop.y = row * CELL.height + CELL.height / 2;
  troop.previousRenderX = troop.x; troop.previousRenderY = troop.y;
  troop.attackTargetId = null; troop.pendingImpact = null; troop.pendingComboImpact = null; troop.channelingAttack = false;
  rebuildIndex(session);
  return { ok: true, troop, event: { type: "troopRepositioned", troopId, row, col, x: troop.x, y: troop.y } };
}
