export function isCryo7(troop) {
  return troop?.type === "cryo7";
}

export function getCryoEnemyTags(enemyConfig = {}) {
  return enemyConfig.enemyTags || enemyConfig.traits || [];
}

export function isCryoThermalTarget(enemyConfig = {}) {
  const tags = getCryoEnemyTags(enemyConfig);
  return tags.includes("fire") || tags.includes("thermalAdapted");
}

export function getCryoDamageFactor(enemyConfig = {}, config = {}) {
  return isCryoThermalTarget(enemyConfig) ? Number(config.cryoDamageFactor) || 1.35 : 1;
}

export function getCryoShockDuration(enemyConfig = {}, config = {}) {
  return getCryoEnemyTags(enemyConfig).includes("fire")
    ? Number(config.fireCryoShockMs) || 2000
    : Number(config.cryoShockMs) || 1000;
}

export function getCryoTargetPriority(enemyConfig = {}) {
  const tags = getCryoEnemyTags(enemyConfig);
  if (tags.includes("fire")) return 0;
  if (tags.includes("thermalAdapted")) return 1;
  return 2;
}

export function selectCryoTarget(enemies, troop, config, { occupiesTargetRow, canTarget, enemyConfigFor, cellWidth = 100 } = {}) {
  const originX = troop.x;
  return enemies
    .filter((enemy) => !enemy.dead && enemy.x >= originX
      && enemy.x - originX <= config.range * cellWidth
      && (!occupiesTargetRow || occupiesTargetRow(enemy, troop.row))
      && (!canTarget || canTarget(enemy)))
    .sort((left, right) => {
      const priority = getCryoTargetPriority(enemyConfigFor?.(left) || {})
        - getCryoTargetPriority(enemyConfigFor?.(right) || {});
      return priority || left.x - right.x;
    })[0] || null;
}
