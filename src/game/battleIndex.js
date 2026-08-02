import { CELL, FIELD } from "./visualGeometry.js";

const indexes = new WeakMap();

function createRows() {
  return Array.from({ length: FIELD.rows }, () => []);
}

function createBattleIndex() {
  return {
    troopById: new Map(),
    enemyById: new Map(),
    troopsByRow: createRows(),
    enemiesByRow: createRows(),
    targetableEnemiesByRow: createRows(),
    enemiesByTile: new Map(),
    activeTroopsByType: new Map(),
    enemiesByType: new Map(),
    enemiesByPacket: new Map(),
  };
}

function clearBuckets(map) {
  for (const bucket of map.values()) bucket.length = 0;
}

function bucketFor(map, key) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  return bucket;
}

export function battleTileKey(row, x) {
  const col = Math.max(0, Math.min(FIELD.cols - 1, Math.floor(x / CELL.width)));
  return row * FIELD.cols + col;
}

export function registerTroopInIndex(index, troop) {
  if (!index || !troop || troop.dead) return;
  index.troopById.set(troop.id, troop);
  index.troopsByRow[troop.row]?.push(troop);
  bucketFor(index.activeTroopsByType, troop.type).push(troop);
}

export function registerEnemyInIndex(index, enemy) {
  if (!index || !enemy || enemy.dead) return;
  index.enemyById.set(enemy.id, enemy);
  index.enemiesByRow[enemy.row]?.push(enemy);
  const targetRows = enemy.type === "leviathanNereida"
    ? (enemy.leviathanTargetableRows || [])
    : [enemy.row];
  for (const row of new Set(targetRows)) index.targetableEnemiesByRow[row]?.push(enemy);
  bucketFor(index.enemiesByTile, battleTileKey(enemy.row, enemy.x)).push(enemy);
  bucketFor(index.enemiesByType, enemy.type).push(enemy);
  if (enemy.packetId != null) bucketFor(index.enemiesByPacket, enemy.packetId).push(enemy);
}

function removeFromBucket(bucket, entity) {
  if (!bucket) return;
  const position = bucket.indexOf(entity);
  if (position >= 0) bucket.splice(position, 1);
}

export function moveTroopInIndex(index, troop, previousRow) {
  if (!index || previousRow === troop.row) return;
  removeFromBucket(index.troopsByRow[previousRow], troop);
  index.troopsByRow[troop.row]?.push(troop);
}

export function moveEnemyInIndex(index, enemy, previousRow, previousX) {
  if (!index) return;
  if (previousRow !== enemy.row) {
    removeFromBucket(index.enemiesByRow[previousRow], enemy);
    index.enemiesByRow[enemy.row]?.push(enemy);
  }
  const previousKey = battleTileKey(previousRow, previousX);
  const nextKey = battleTileKey(enemy.row, enemy.x);
  if (previousKey === nextKey) return;
  removeFromBucket(index.enemiesByTile.get(previousKey), enemy);
  bucketFor(index.enemiesByTile, nextKey).push(enemy);
}

export function rebuildBattleIndex(session) {
  let index = indexes.get(session);
  if (!index) {
    index = createBattleIndex();
    indexes.set(session, index);
  }
  index.troopById.clear();
  index.enemyById.clear();
  for (const row of index.troopsByRow) row.length = 0;
  for (const row of index.enemiesByRow) row.length = 0;
  for (const row of index.targetableEnemiesByRow) row.length = 0;
  clearBuckets(index.enemiesByTile);
  clearBuckets(index.activeTroopsByType);
  clearBuckets(index.enemiesByType);
  clearBuckets(index.enemiesByPacket);
  for (const troop of session.troops) registerTroopInIndex(index, troop);
  for (const enemy of session.enemies) registerEnemyInIndex(index, enemy);
  return index;
}

export function getBattleIndex(session) {
  return indexes.get(session) || null;
}

export function livingTroopById(index, id) {
  const troop = index?.troopById.get(id);
  return troop && !troop.dead ? troop : null;
}

export function livingEnemyById(index, id) {
  const enemy = index?.enemyById.get(id);
  return enemy && !enemy.dead && enemy.hp > 0 ? enemy : null;
}
