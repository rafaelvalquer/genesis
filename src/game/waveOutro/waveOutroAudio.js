export function getWaveOutroMusicVolumeFactor(outro) {
  if (!outro || outro.status === "idle") return 1;
  const elapsed = outro.elapsedMs || 0;
  
  // Volume drops over the first 180ms
  let factor = 1;
  if (elapsed >= 180) {
    factor = 0.36;
  } else {
    // Linear fade from 1 to 0.36 over 180ms
    factor = 1 - (elapsed / 180) * 0.64;
  }
  
  if (outro.finalWave && elapsed >= 180) {
    // Deeper ducking for the final wave
    factor = factor * 0.5;
  }
  return factor;
}

export function getWaveOutroCueState(outro) {
  if (!outro || outro.status === "idle") return {};
  
  return {
    impactReady: outro.elapsedMs >= 180,
    finalWave: Boolean(outro.finalWave),
    cinematic: Boolean(outro.lastKill?.cinematic),
    shake: outro.finalWave ? 12 : 5,
    key: `wave-outro-cue-${outro.completedWave}`
  };
}
