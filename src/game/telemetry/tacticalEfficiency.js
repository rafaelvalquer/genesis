export function calculateTacticalEfficiency({ integrity = 0, troopsDeployed = 0, troopsLost = 0, energyGenerated = 0, energyWasted = 0, durationMs = 0, targetDurationMs = 0 }) {
  const integrityScore = Math.max(0, Math.min(1, integrity / 100));
  const survivalScore = 1 - troopsLost / Math.max(1, troopsDeployed);
  const energyScore = 1 - energyWasted / Math.max(1, energyGenerated);
  const timeScore = targetDurationMs > 0 ? Math.min(1, targetDurationMs / Math.max(1, durationMs)) : 1;
  return Math.round((integrityScore * .30 + survivalScore * .25 + energyScore * .25 + timeScore * .20) * 100);
}
