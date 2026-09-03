export function getThermalBannerText(phase, snapshot) {
  if (phase?.chapterId !== "chapter_06") return null;
  const thermal = snapshot?.thermal;
  if (!thermal?.state) return null;
  const remainingSeconds = (thermal.remainingMs != null
    ? thermal.remainingMs / 1000
    : Math.max(0, (thermal.nextStateAt - snapshot.elapsed) / 1000)).toFixed(0);
  const label = thermal.paused
    ? "MAGMA EM PAUSA"
    : thermal.state === "stable" ? "🔥 ESTÁVEL"
      : thermal.state === "active" ? "🔥🔥 ATIVA"
        : thermal.state === "eruption" ? "⚠ ERUPÇÃO" : "RESFRIAMENTO";
  return `${label} · ${remainingSeconds}s`;
}

export function resolveInspectedTroopId({ hoveredTroop }) {
  return hoveredTroop || null;
}
