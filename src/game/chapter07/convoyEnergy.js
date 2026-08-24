import { spawnEnergyPickup } from "../energyPickups.js";

export function updateConvoyEnergy(session, events = []) {
  const convoy = session.convoy;
  if (!convoy || session.convoyFlow?.state !== "sectorActive" || session.paused) return;
  const interval = session.phase.convoy.energyPulseEveryMs || 5000;
  while (session.elapsed >= convoy.nextEnergyPulseAt) {
    const pendingPickupEnergy = session.energyPickups
      .filter((pickup) => pickup.sourceKind === "convoy")
      .reduce((sum, pickup) => sum + pickup.amount, 0);
    const availableCapacity = Math.max(0, session.energyMax - session.energy - pendingPickupEnergy);
    const amount = Math.floor(Math.min(session.phase.convoy.energyPerPulse || 3, convoy.reserve, availableCapacity));
    if (amount > 0) {
      for (let index = 0; index < amount; index += 1) {
        const angle = (index - (amount - 1) / 2) * 0.9;
        spawnEnergyPickup(session, {
          x: convoy.x + Math.cos(angle) * 14,
          y: convoy.y - 35 + Math.sin(angle) * 12,
          amount: 1,
          initialVx: Math.cos(angle) * 28,
          initialVy: Math.sin(angle) * 18 - 12,
          sourceKind: "convoy",
          sourceConvoyId: convoy.id,
        }, events);
      }
      convoy.reserve -= amount;
      events.push({ type: "energyGenerated", sourceKind: "convoy", amount, remainingReserve: convoy.reserve, x: convoy.x, y: convoy.y });
    }
    if (convoy.reserve === 0 && !convoy.reserveEmptyEmitted) {
      convoy.reserveEmptyEmitted = true;
      events.push({ type: "reserveEmpty", convoyId: convoy.id });
    }
    convoy.nextEnergyPulseAt += interval;
  }
}
