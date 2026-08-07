export function getWaveOutroImpactState(outro) {
  const progress = outro?.progress || 0;
  return {
    active: outro?.status === "impact",
    progress: progress,
    opacity: Math.max(0, 1 - progress)
  };
}

export function getWaveOutroPresentationProfile(outro) {
  const isFinale = outro?.type === "mission_finale" || outro?.type === "boss_defeat";
  return {
    letterbox: isFinale,
    shockwaveScale: isFinale ? 3.5 : 2.0,
    flashOpacity: isFinale ? 0.95 : 0.65
  };
}
