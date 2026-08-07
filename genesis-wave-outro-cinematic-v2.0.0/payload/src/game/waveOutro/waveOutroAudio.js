import { getWaveOutroProfile, sampleWaveOutroCurve } from "./waveOutroProfiles.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function getWaveOutroMusicVolume(outro, baseVolume = 1) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return clamp(baseVolume);
  const profile = getWaveOutroProfile(outro);
  return clamp(baseVolume) * clamp(sampleWaveOutroCurve(profile.audio, outro.elapsedMs));
}

function audioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!window._genesisWaveOutroAudioCtx) window._genesisWaveOutroAudioCtx = new AudioCtx();
  const ctx = window._genesisWaveOutroAudioCtx;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function playWaveOutroImpactSound(event, settings = {}) {
  const ctx = audioContext();
  if (!ctx || !event) return false;
  try {
    const master = clamp((settings.masterVolume ?? 1) * (settings.effectsVolume ?? 1));
    if (master <= 0) return false;
    const mission = event.type === "missionFinalImpact";
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const low = ctx.createOscillator();
    osc.type = event.damageKind === "electric" ? "square" : "sawtooth";
    low.type = "sine";
    osc.frequency.setValueAtTime(mission ? 150 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(mission ? 52 : 80, now + (mission ? .34 : .22));
    low.frequency.setValueAtTime(mission ? 42 : 58, now);
    low.frequency.exponentialRampToValueAtTime(28, now + (mission ? .48 : .30));
    gain.gain.setValueAtTime(Math.max(.001, master * (mission ? .55 : .32)), now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (mission ? .5 : .32));
    osc.connect(gain);
    low.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    low.start(now);
    osc.stop(now + (mission ? .5 : .32));
    low.stop(now + (mission ? .52 : .34));
    return true;
  } catch {
    return false;
  }
}

export function playWaveOutroVictoryStinger(settings = {}) {
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    const master = clamp((settings.masterVolume ?? 1) * (settings.effectsVolume ?? 1));
    const now = ctx.currentTime;
    [196, 246.94, 293.66].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, now + index * .07);
      gain.gain.exponentialRampToValueAtTime(Math.max(.002, master * .16), now + .04 + index * .07);
      gain.gain.exponentialRampToValueAtTime(.001, now + .72 + index * .07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * .07);
      osc.stop(now + .78 + index * .07);
    });
    return true;
  } catch {
    return false;
  }
}
