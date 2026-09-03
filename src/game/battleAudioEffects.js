/** Browser-only low-integrity warning; it never participates in gameplay state. */
export function playCriticalAlarmBeep(volume = .5) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window._genesisAudioCtx) window._genesisAudioCtx = new AudioCtx();
    const ctx = window._genesisAudioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(140, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + .25);
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume * .45)), ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .28);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .3);
  } catch {}
}
