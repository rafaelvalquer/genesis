import { CELL, FIELD, advanceWaveOutro } from "../battleModel.js";
import { advanceConvoyEntry, advanceConvoySectorCountdown } from "../chapter07/convoyFlow.js";
import { playCriticalAlarmBeep } from "../battleAudioEffects.js";
import { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "../waveOutro/waveOutroAudio.js";

/** Advances non-step battle flow and emits its visual/audio reactions. */
export function advanceBattleFrameProgress({
  adaptiveSettingsRef,
  audioRef,
  consumeGraphicsEventsAtVisualTime,
  convoyCountdownStepRef,
  fortunePaused,
  frameDelta,
  lastCriticalBeepRef,
  now,
  particlesRef,
  paused,
  phase,
  play,
  pushEventParticles,
  sessionRef,
  setBanner,
  settings,
  speed,
  waveOutroCueRef,
}) {
  const outroEvents = advanceWaveOutro(sessionRef.current, frameDelta);
  if (outroEvents.length) {
    pushEventParticles(particlesRef.current, outroEvents, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    consumeGraphicsEventsAtVisualTime(outroEvents, sessionRef.current.elapsed);
    if (outroEvents.some((event) => event.type === "waveCompleteBanner")) {
      audioRef.current.theme?.pause();
      setBanner(sessionRef.current.waveOutro.finalWave
        ? "PERÍMETRO ASSEGURADO"
        : `ONDA ${sessionRef.current.waveOutro.completedWave} CONCLUÍDA`);
      play("alert", 0.38);
    }
    if (outroEvents.some((event) => event.type === "decisionIntro")) setBanner("NOVA VANTAGEM TÁTICA");
    if (outroEvents.some((event) => event.type === "victoryIntro")) {
      setBanner("MISSÃO CONCLUÍDA");
      play("alert", 0.62);
    }
  }
  const activeSession = sessionRef.current;
  if (!paused && !fortunePaused && activeSession?.convoyFlow?.state === "sectorCountdown") {
    const remainingBeforeStep = Math.max(0, (activeSession.convoyFlow.countdownDurationMs || 2400) - (activeSession.convoyFlow.countdownElapsedMs || 0));
    const countdownStep = Math.max(1, Math.min(3, Math.ceil(remainingBeforeStep / 800)));
    if (convoyCountdownStepRef.current !== countdownStep) {
      convoyCountdownStepRef.current = countdownStep;
      play("alert", 0.2);
    }
    const countdownEvents = [];
    advanceConvoySectorCountdown(activeSession, frameDelta * speed, countdownEvents);
    if (countdownEvents.length) {
      consumeGraphicsEventsAtVisualTime(countdownEvents, activeSession.elapsed);
      play("alert", 0.45);
      convoyCountdownStepRef.current = null;
    }
  }
  if (!paused && !fortunePaused && activeSession?.convoyFlow?.state === "convoyEntry") {
    const entryEvents = [];
    advanceConvoyEntry(activeSession, frameDelta, entryEvents);
    if (entryEvents.length) consumeGraphicsEventsAtVisualTime(entryEvents, activeSession.elapsed);
  }
  const activeOutro = activeSession?.waveOutro?.status
    && !["idle", "completed"].includes(activeSession.waveOutro.status);
  const cueState = getWaveOutroCueState(activeSession?.waveOutro);
  if (cueState?.impactReady && waveOutroCueRef.current !== cueState.key) {
    waveOutroCueRef.current = cueState.key;
    const lastEnemy = activeSession.waveOutro.lastKill?.enemy;
    const impactEvent = {
      type: cueState.finalWave ? "missionFinalImpact" : "waveFinalImpact",
      x: Number.isFinite(lastEnemy?.x) ? lastEnemy.x : FIELD.width * 0.64,
      y: Number.isFinite(lastEnemy?.y)
        ? lastEnemy.y
        : ((activeSession.waveOutro.lastKill?.row ?? 2) + 0.5) * CELL.height,
      shake: settings.reduceMotion ? 0 : cueState.shake,
      color: phase.palette.accent,
      seed: Math.round((lastEnemy?.x || 17) * 31 + (lastEnemy?.y || 23) * 17),
    };
    consumeGraphicsEventsAtVisualTime([impactEvent], activeSession.elapsed);
    play("melee", cueState.finalWave ? 0.88 : cueState.cinematic ? 0.68 : 0.48);
    play("alert", cueState.finalWave ? 0.30 : 0.14);
  }
  const themeAudio = audioRef.current.theme;
  if (themeAudio && activeOutro) {
    const baseMusicVolume = settings.masterVolume * settings.musicVolume;
    themeAudio.volume = baseMusicVolume * getWaveOutroMusicVolumeFactor(activeSession.waveOutro);
  }
  if (activeSession && !activeOutro && !activeSession.outcome && activeSession.integrity > 0 && (activeSession.integrity / activeSession.integrityMax) <= 0.25) {
    if (now - lastCriticalBeepRef.current >= 1200) {
      lastCriticalBeepRef.current = now;
      playCriticalAlarmBeep(settings.masterVolume * settings.effectsVolume);
    }
  }
}
