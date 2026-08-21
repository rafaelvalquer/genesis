export function updateConvoyEnergy(session, events = []) {
  const convoy = session.convoy;
  if (!convoy || session.convoyFlow?.state !== "sectorActive" || session.paused) return;
  const interval = session.phase.convoy.energyPulseEveryMs || 5000;
  while (session.elapsed >= convoy.nextEnergyPulseAt) {
    const amount = Math.min(session.phase.convoy.energyPerPulse || 3, convoy.reserve, Math.max(0, session.energyMax - session.energy));
    if (amount > 0) {
      session.energy += amount;
      convoy.reserve -= amount;
      session.lastEnergyGainAt = session.elapsed;
      events.push({ type: "energyGenerated", sourceKind: "convoy", amount, remainingReserve: convoy.reserve, x: convoy.x, y: convoy.y });
    }
    if (convoy.reserve === 0 && !convoy.reserveEmptyEmitted) {
      convoy.reserveEmptyEmitted = true;
      events.push({ type: "reserveEmpty", convoyId: convoy.id });
    }
    convoy.nextEnergyPulseAt += interval;
  }
}

export function refillConvoyReserve(session, checkpointIndex, events = []) {
  const convoy = session.convoy;
  if (!convoy || convoy.refillAppliedForCheckpoint?.includes(checkpointIndex)) return 0;
  convoy.refillAppliedForCheckpoint ||= [];
  convoy.refillAppliedForCheckpoint.push(checkpointIndex);
  const before = convoy.reserve;
  convoy.reserve = Math.min(convoy.reserveMax, convoy.reserve + (session.phase.convoy.checkpointRefill || 50));
  convoy.reserveEmptyEmitted = convoy.reserve <= 0;
  const amountAdded = convoy.reserve - before;
  events.push({ type: "checkpointRefill", checkpointIndex, amountAdded, discardedAmount: (session.phase.convoy.checkpointRefill || 50) - amountAdded, newReserve: convoy.reserve });
  return amountAdded;
}
