import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import {
  getWaveOutroImpactState,
  getWaveOutroPresentationProfile,
} from "./waveOutroProfiles.js";

export function WaveOutroCinematicOverlay({ outro, palette, reduceMotion = false }) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return null;

  const profile = getWaveOutroPresentationProfile(outro);
  const impact = getWaveOutroImpactState(outro);
  const enemy = outro.lastKill?.enemy;
  const row = Number.isInteger(outro.lastKill?.row) ? outro.lastKill.row : 2;
  const x = Number.isFinite(Number(enemy?.x))
    ? Math.max(0, Math.min(100, Number(enemy.x) / FIELD.width * 100))
    : 64;
  const focusY = VIEWPORT.fieldOffsetY + (row + 0.5) * CELL.height;
  const y = Math.max(0, Math.min(100, focusY / VIEWPORT.height * 100));
  const primary = palette?.primary || "#38bdf8";
  const accent = palette?.accent || "#e0f2fe";

  if (reduceMotion) {
    return profile.letterbox ? (
      <div className="wave-outro-cinematic-layer reduced-motion mission-finale" aria-hidden="true">
        <span className="wave-outro-letterbox top" />
        <span className="wave-outro-letterbox bottom" />
      </div>
    ) : null;
  }

  const ringScale = impact.active
    ? 0.35 + impact.progress * profile.shockwaveScale
    : 1;
  const flashOpacity = impact.active
    ? profile.flashOpacity * Math.max(0, 1 - impact.progress * 1.35)
    : 0;

  return (
    <div
      className={`wave-outro-cinematic-layer ${profile.letterbox ? "mission-finale" : ""}`}
      aria-hidden="true"
      style={{
        "--wave-outro-primary": primary,
        "--wave-outro-accent": accent,
      }}
    >
      {profile.letterbox && <>
        <span className="wave-outro-letterbox top" />
        <span className="wave-outro-letterbox bottom" />
      </>}
      {impact.active && <>
        <span
          className="wave-outro-impact-flash"
          style={{
            opacity: flashOpacity,
            background: `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,.98) 0%, rgba(255,255,255,.38) 7%, transparent 31%)`,
          }}
        />
        <span
          className="wave-outro-impact-ring"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            opacity: impact.opacity,
            transform: `translate(-50%, -50%) scale(${ringScale})`,
          }}
        />
      </>}
    </div>
  );
}

export default WaveOutroCinematicOverlay;
