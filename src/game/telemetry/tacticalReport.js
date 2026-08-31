import { calculateTacticalEfficiency } from "./tacticalEfficiency.js";
import { buildTacticalInsights } from "./tacticalInsights.js";

export function buildTacticalReport(session, options = {}) {
  const telemetry = session.telemetry; const troops = Object.entries(telemetry.troops).map(([type, stats]) => {
    const special = { ...stats.special };
    if (type === "cryo7") Object.assign(special, { freezes: session.metrics?.cryo7ShockApplications || 0, freezeDurationMs: (session.metrics?.cryo7NormalFreezeMs || 0) + (session.metrics?.cryo7FireFreezeMs || 0), thermalTargetsHit: session.metrics?.cryo7ThermalHits || 0 });
    if (type === "reator") Object.assign(special, { energyGenerated: Math.round(stats.energyGenerated), energyWasted: Math.round(stats.energyWasted) });
    if (type === "interceptadorIcaro") Object.assign(special, { airDamage: Math.round(stats.damageDealt) });
    return { type, ...stats, special, accuracy: stats.shots > 0 ? Math.round(stats.hits / stats.shots * 100) : null };
  });
  const deployed = troops.reduce((sum, troop) => sum + troop.deployed, 0); const lost = troops.reduce((sum, troop) => sum + troop.lost, 0);
  const routes = telemetry.routes.map((route) => ({ ...route, averagePressure: route.sampleCount ? Math.round(route.pressureSum / route.sampleCount) : 0 }));
  const mostPressured = routes.reduce((best, route) => route.pressureSum > best.pressureSum ? route : best, routes[0] || { row: 0 });
  const summary = { damageDealt: Math.round(telemetry.combat.totalDamageDealt), damageReceived: Math.round(telemetry.combat.totalDamageReceived), damagePrevented: Math.round(telemetry.combat.totalDamagePrevented), energyGenerated: Math.round(telemetry.energy.generated), energySpent: Math.round(telemetry.energy.spent), energyWasted: Math.round(telemetry.energy.wasted), energyRefunded: Math.round(telemetry.energy.refunded), troopsDeployed: deployed, troopsLost: lost, mostPressuredRoute: mostPressured.row, objectiveDamage: Math.round(telemetry.objective.damageTaken) };
  summary.efficiency = calculateTacticalEfficiency({ integrity: options.integrity, troopsDeployed: deployed, troopsLost: lost, energyGenerated: summary.energyGenerated, energyWasted: summary.energyWasted, durationMs: options.durationMs, targetDurationMs: options.targetDurationMs });
  const timeline = telemetry.timeline || { sampleIntervalMs: 1000, samples: [], events: [] };
  const report = {
    version: 2, summary, troops, threats: { ...telemetry.threats }, routes, insights: [],
    timeline: {
      sampleIntervalMs: timeline.sampleIntervalMs,
      durationMs: options.durationMs || 0,
      samples: timeline.samples.map((sample) => ({ ...sample, activeTroopsByType: { ...sample.activeTroopsByType } })),
      events: timeline.events.map((event) => ({ ...event })),
    },
  };
  report.insights = buildTacticalInsights(report, options);
  return report;
}
