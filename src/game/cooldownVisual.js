export function getDeployCooldownProgress(remainingMs, durationMs) {
  const remaining = Number(remainingMs);
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  if (!Number.isFinite(remaining)) return 1;
  return Math.max(0, Math.min(1, 1 - remaining / duration));
}
