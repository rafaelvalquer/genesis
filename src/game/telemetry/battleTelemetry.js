const emptyTroop = () => ({ deployed: 0, lost: 0, damageDealt: 0, kills: 0, damageTaken: 0, damagePrevented: 0, shots: 0, hits: 0, energyGenerated: 0, energyWasted: 0, special: {} });

export function createBattleTelemetry(routeCount = 5) {
  return {
    version: 1,
    troops: {},
    combat: { totalDamageDealt: 0, totalDamageReceived: 0, totalDamagePrevented: 0, enemiesKilled: 0 },
    energy: { generated: 0, spent: 0, wasted: 0, refunded: 0, fromReactors: 0, fromPickups: 0, fromWaves: 0, fromDecisions: 0 },
    threats: { enemyDamage: 0, airDamage: 0, groundDamage: 0, bossDamage: 0, environmentalDamage: 0, byEnemyType: {} },
    routes: Array.from({ length: routeCount }, (_, row) => ({ row, pressureSum: 0, sampleCount: 0, peakPressure: 0, criticalMs: 0, maxEnemies: 0 })),
    objective: { damageTaken: 0, damagePrevented: 0 },
    lastRouteSampleAt: 0,
  };
}

export function troopTelemetry(telemetry, troopType) {
  if (!telemetry || !troopType) return null;
  telemetry.troops[troopType] ??= emptyTroop();
  return telemetry.troops[troopType];
}

export function recordDeployment(telemetry, troopType, count = 1) { const stat = troopTelemetry(telemetry, troopType); if (stat) stat.deployed += count; }
export function recordTroopLossTelemetry(telemetry, troopType, count = 1) { const stat = troopTelemetry(telemetry, troopType); if (stat) stat.lost += count; }
export function recordTroopDamage(telemetry, troopType, damage) { const value = Math.max(0, damage || 0); const stat = troopTelemetry(telemetry, troopType); if (stat) stat.damageDealt += value; if (telemetry) telemetry.combat.totalDamageDealt += value; }
export function recordKill(telemetry, troopType) { const stat = troopTelemetry(telemetry, troopType); if (stat) stat.kills += 1; if (telemetry) telemetry.combat.enemiesKilled += 1; }
export function recordDamageTaken(telemetry, troopType, damage, prevented = 0) { const value = Math.max(0, damage || 0); const saved = Math.max(0, prevented || 0); const stat = troopTelemetry(telemetry, troopType); if (stat) { stat.damageTaken += value; stat.damagePrevented += saved; } if (telemetry) { telemetry.combat.totalDamageReceived += value; telemetry.combat.totalDamagePrevented += saved; } }

export function grantEnergy(session, requestedAmount, source = {}) {
  const requested = Math.max(0, Number(requestedAmount) || 0);
  const gained = Math.min(requested, Math.max(0, session.energyMax - session.energy));
  const wasted = requested - gained;
  session.energy += gained;
  const energy = session.telemetry?.energy;
  if (energy) { energy.generated += gained; energy.wasted += wasted; if (source.kind === "reactor") energy.fromReactors += gained; else if (source.kind === "pickup") energy.fromPickups += gained; else if (source.kind === "wave") energy.fromWaves += gained; else if (source.kind === "decision") energy.fromDecisions += gained; }
  const troop = troopTelemetry(session.telemetry, source.troopType);
  if (troop) { troop.energyGenerated += gained; troop.energyWasted += wasted; }
  return { requested, gained, wasted };
}

export function spendEnergy(session, amount, source = {}) {
  const spent = Math.min(Math.max(0, Number(amount) || 0), Math.max(0, session.energy));
  session.energy -= spent;
  if (session.telemetry) session.telemetry.energy.spent += spent;
  return spent;
}

export function refundEnergy(session, amount) {
  const result = grantEnergy(session, amount, { kind: "refund" });
  if (session.telemetry) session.telemetry.energy.refunded += result.gained;
  return result;
}

export function recordThreatDamage(telemetry, amount, { enemyType, airborne, boss, sourceKind = "enemy" } = {}) {
  if (!telemetry) return;
  const value = Math.max(0, amount || 0);
  if (sourceKind === "environment") telemetry.threats.environmentalDamage += value;
  else if (sourceKind === "enemy") { telemetry.threats.enemyDamage += value; telemetry.threats[airborne ? "airDamage" : "groundDamage"] += value; if (boss) telemetry.threats.bossDamage += value; if (enemyType) telemetry.threats.byEnemyType[enemyType] = (telemetry.threats.byEnemyType[enemyType] || 0) + value; }
}

export function recordRoutePressure(telemetry, routes, elapsed) {
  if (!telemetry || !Array.isArray(routes)) return;
  const dt = Math.max(0, elapsed - telemetry.lastRouteSampleAt);
  routes.forEach((route) => { const entry = telemetry.routes[route.row]; if (!entry) return; entry.pressureSum += route.pressure; entry.sampleCount += 1; entry.peakPressure = Math.max(entry.peakPressure, route.pressure); entry.maxEnemies = Math.max(entry.maxEnemies, route.activeCount || 0); if (route.state === "critical") entry.criticalMs += dt; });
  telemetry.lastRouteSampleAt = elapsed;
}
