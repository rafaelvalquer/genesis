import { useCallback, useEffect } from "react";

export function createBattleAudioChannels(assets) {
  const build = (name, loop = false) => {
    const url = assets.audio[name];
    if (!url) return null;
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.loop = loop;
    return audio;
  };
  const buildFirst = (base) => build(`${base}.ogg`) || build(`${base}.wav`);
  return {
    theme: build("wave_theme.ogg", true),
    alert: build("wave_alert.ogg"),
    deploy: build("deploy.ogg"),
    shoot: [1, 2, 3, 4].map((index) => build(`shoot_ball_${index}.wav`)).filter(Boolean),
    melee: [1, 2, 3, 4].map((index) => build(`melee_${index}.wav`)).filter(Boolean),
    executorSlash1: buildFirst("executor_slash_1"),
    executorSlash2: buildFirst("executor_slash_2"),
    executorFinisher: buildFirst("executor_finisher"),
    executorComboReset: buildFirst("executor_combo_reset"),
    icaroBurstShot: buildFirst("icaro_burst_shot"),
    icaroInterceptionLock: buildFirst("icaro_interception_lock"),
    icaroInterceptionFire: buildFirst("icaro_interception_fire"),
    icaroDeath: buildFirst("icaro_death"),
    leviathanCharge: buildFirst("leviathan_charge"),
    leviathanFire: buildFirst("leviathan_fire"),
    leviathanImpact: buildFirst("leviathan_impact"),
    leviathanRupture: buildFirst("leviathan_rupture"),
    leviathanCooldown: buildFirst("leviathan_cooldown"),
    colossoAwaken: buildFirst("colosso_awaken"),
    colossoRiftCharge: buildFirst("colosso_rift_charge"),
    colossoRiftOpen: buildFirst("colosso_rift_open"),
    colossoSlamCharge: buildFirst("colosso_slam_charge"),
    colossoSlamImpact: buildFirst("colosso_slam_impact"),
    colossoFracture: buildFirst("colosso_fracture"),
    colossoSeismicCharge: buildFirst("colosso_seismic_charge"),
    colossoSeismicImpact: buildFirst("colosso_seismic_impact"),
    colossoCoreOpen: buildFirst("colosso_core_open"),
    colossoPhase2: buildFirst("colosso_phase2"),
    colossoPhase3: buildFirst("colosso_phase3"),
    colossoFinalCollapse: buildFirst("colosso_final_collapse"),
    colossoDeath: buildFirst("colosso_death"),
    windWarning: build("wind_warning.ogg"),
    windActiveLoop: build("wind_active_loop.ogg", true),
    windPrimaryGust: build("wind_primary_gust.ogg"),
    windTroopShift: build("wind_troop_shift.ogg"),
    windEjection: build("wind_ejection.ogg"),
    windRecovery: build("wind_recovery.ogg"),
    thunder: [build("thunder_distant_1.ogg"), build("thunder_distant_2.ogg")].filter(Boolean),
  };
}

export function useBattleAudio({ audioRef, settings, paused, windActive }) {
  const stopAudio = useCallback(() => {
    audioRef.current.theme?.pause();
    audioRef.current.windActiveLoop?.pause();
  }, [audioRef]);

  const configureAudio = useCallback((assets) => {
    stopAudio();
    audioRef.current = createBattleAudioChannels(assets);
  }, [audioRef, stopAudio]);

  const play = useCallback((channel, intensity = 1) => {
    const source = Array.isArray(audioRef.current[channel])
      ? audioRef.current[channel][Math.floor(Math.random() * audioRef.current[channel].length)]
      : audioRef.current[channel];
    if (!source) return;
    const instance = channel === "theme" ? source : source.cloneNode();
    const group = channel === "theme" ? settings.musicVolume : settings.effectsVolume;
    instance.volume = Math.max(0, Math.min(1, settings.masterVolume * group * intensity));
    instance.play().catch(() => {});
  }, [audioRef, settings]);

  useEffect(() => {
    const loopAudio = audioRef.current.windActiveLoop;
    if (!loopAudio) return;
    if (paused || !windActive) {
      loopAudio.pause();
      return;
    }
    loopAudio.volume = Math.max(0, Math.min(1,
      settings.masterVolume * settings.effectsVolume * 0.42));
    loopAudio.play().catch(() => {});
  }, [audioRef, paused, settings.effectsVolume, settings.masterVolume, windActive]);

  return { configureAudio, play, stopAudio };
}

export default useBattleAudio;
