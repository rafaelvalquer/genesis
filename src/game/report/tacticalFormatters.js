export const SPECIAL_LABELS = Object.freeze({
  energyGenerated: "Energia gerada",
  energyWasted: "Energia desperdiçada",
  freezes: "Congelamentos",
  freezeDurationMs: "Tempo congelado",
  thermalTargetsHit: "Alvos térmicos",
  airDamage: "Dano aéreo",
});

export const formatNumber = (value) => Math.round(Number(value) || 0).toLocaleString("pt-BR");
export const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;
export const formatDuration = (milliseconds) => {
  const seconds = (Number(milliseconds) || 0) / 1000;
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : `${seconds.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: seconds % 1 ? 1 : 0 })} s`;
};
export const formatTimelineTime = (milliseconds) => {
  const total = Math.floor((Number(milliseconds) || 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
export const formatTacticalSpecial = (key, value) => ({
  label: SPECIAL_LABELS[key] || key.replace(/([A-Z])/g, " $1").trim(),
  value: key.endsWith("DurationMs") ? formatDuration(value) : formatNumber(value),
});
