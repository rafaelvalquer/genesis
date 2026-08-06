import { TROOPS } from "../../content.js";
import { FIELD } from "../../visualGeometry.js";

const livingTroops = (session) => (
  (session?.troops || []).filter((troop) => !troop.dead && troop.hp > 0)
);

export function hasLivingTroopsForRasgamar(session) {
  return livingTroops(session).length > 0;
}

export function hasLivingTroopsInRasgamarRow(session, row) {
  return livingTroops(session).some((troop) => troop.row === row);
}

export function getRasgamarOccupiedRows(session, ignoredEnemyId = null) {
  const rows = new Set();

  for (const enemy of session?.enemies || []) {
    if (
      enemy.dead
      || enemy.hp <= 0
      || enemy.type !== "enguiaRasgamar"
      || enemy.id === ignoredEnemyId
    ) {
      continue;
    }

    if (Number.isInteger(enemy.row)) rows.add(enemy.row);
    if (Number.isInteger(enemy.rasgamarTargetRow)) rows.add(enemy.rasgamarTargetRow);
  }

  return rows;
}

function troopStrategicValue(troop) {
  const config = TROOPS[troop.type] || {};
  const deploymentValue = Number(troop.energyCost);
  const price = Number.isFinite(deploymentValue) && deploymentValue > 0
    ? deploymentValue
    : Number(config.price) || 0;
  const supply = Number(troop.supplyCost ?? config.supply) || 0;
  const hpRatio = Number(troop.maxHp) > 0
    ? Math.max(0, Math.min(1, Number(troop.hp) / Number(troop.maxHp)))
    : 1;

  return price + supply * 1.5 + hpRatio * 2;
}

function isPriorityTroop(troop) {
  const config = TROOPS[troop.type] || {};
  return troop.type === "reator"
    || /suporte|economia|cura/i.test(config.role || "")
    || Boolean(config.attack && config.attack !== "none" && config.attack !== "energy");
}

export function buildRasgamarRowStats(
  session,
  enemy,
  eligibleRows = Array.from({ length: FIELD.rows }, (_, row) => row),
) {
  const allowed = new Set(eligibleRows);
  const occupiedRows = getRasgamarOccupiedRows(session, enemy?.id);
  const troops = livingTroops(session);

  return Array.from({ length: FIELD.rows }, (_, row) => {
    const rowTroops = troops.filter((troop) => troop.row === row);
    return {
      row,
      eligible: allowed.has(row),
      occupied: occupiedRows.has(row),
      troopCount: rowTroops.length,
      strategicValue: rowTroops.reduce(
        (total, troop) => total + troopStrategicValue(troop),
        0,
      ),
      priorityCount: rowTroops.filter(isPriorityTroop).length,
      distance: Math.abs(row - Number(enemy?.row || 0)),
    };
  });
}

function compareRasgamarRows(left, right) {
  return right.troopCount - left.troopCount
    || right.strategicValue - left.strategicValue
    || right.priorityCount - left.priorityCount
    || left.distance - right.distance
    || left.row - right.row;
}

export function selectRasgamarRelocationRow(session, enemy, eligibleRows) {
  const candidates = buildRasgamarRowStats(session, enemy, eligibleRows)
    .filter((entry) => (
      entry.eligible
      && entry.row !== enemy.row
      && entry.troopCount > 0
    ));

  if (!candidates.length) return null;

  const unoccupied = candidates.filter((entry) => !entry.occupied);
  const pool = unoccupied.length ? unoccupied : candidates;
  pool.sort(compareRasgamarRows);
  return pool[0]?.row ?? null;
}

export function getRasgamarRelocationDuration(config, fromRow, toRow) {
  const distance = Math.abs(Number(toRow) - Number(fromRow));
  return Math.max(
    1,
    (Number(config?.laneRelocationBaseMs) || 450)
      + distance * (Number(config?.laneRelocationPerRowMs) || 220),
  );
}
