export function getConvoyAttackSummary(convoy, hostileCount) {
  if (!convoy?.underAttack) return null;
  const critical = convoy.damageState === "critical" || convoy.damageState === "destroyed";
  return `${critical ? "⚠ TRANSPORTE CRÍTICO SOB ATAQUE" : "⚠ TRANSPORTE SOB ATAQUE"} · ${hostileCount} HOSTIS RESTANTES`;
}
