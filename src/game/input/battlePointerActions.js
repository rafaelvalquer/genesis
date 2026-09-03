import { TROOPS } from "../content.js";
import { cellFromPoint } from "../battleModel.js";
import { viewportPointToFieldPoint } from "../visualGeometry.js";

/** Converts a browser pointer event to the fixed battle viewport coordinate space. */
export function getBattlePointerPoint(event, viewport) {
  const rect = event?.currentTarget?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return null;
  return {
    x: (event.clientX - rect.left) * viewport.width / rect.width,
    y: (event.clientY - rect.top) * viewport.height / rect.height,
  };
}

/** Full DOM-to-field conversion used by canvas handlers. */
export function getBattleFieldPoint(event, viewport) {
  const point = getBattlePointerPoint(event, viewport);
  return point && viewportPointToFieldPoint(point.x, point.y);
}

/**
 * Resolves a pointer gesture into a gameplay-neutral action. The controller is
 * the only caller that applies the returned action to a battle session.
 */
export function resolveCanvasClickAction(session, fieldPoint, selectedTroop = null, removeMode = false) {
  if (!fieldPoint) return null;
  const cell = cellFromPoint(fieldPoint.x, fieldPoint.y);
  if (!cell) return null;
  if (removeMode) return { type: "remove", cell };

  const manualSpecialTroop = session.troops
    .filter((entry) => !entry.dead && TROOPS[entry.type]?.specialEveryMs)
    .map((troop) => {
      const visualY = troop.y + (TROOPS[troop.type]?.spriteOffsetY || 0);
      return {
        troop,
        visualY,
        distance: ((fieldPoint.x - troop.x) / 82) ** 2 + ((fieldPoint.y - (visualY - 31)) / 98) ** 2,
      };
    })
    .filter(({ troop, visualY }) => (
      fieldPoint.x >= troop.x - 82
      && fieldPoint.x <= troop.x + 82
      && fieldPoint.y >= visualY - 120
      && fieldPoint.y <= visualY + 66
    ))
    .sort((left, right) => left.distance - right.distance)[0]?.troop;
  if (manualSpecialTroop) return { type: "special", cell, troop: manualSpecialTroop };

  const troopInCell = session.troops.find((entry) => !entry.dead && entry.row === cell.row && entry.col === cell.col);
  if (troopInCell && !selectedTroop) {
    if (troopInCell.type === "droneSentinela") return { type: "inspectDrone", cell, troop: troopInCell };
    return { type: "special", cell, troop: troopInCell };
  }
  return selectedTroop ? { type: "place", cell, troopType: selectedTroop } : null;
}

export default resolveCanvasClickAction;
