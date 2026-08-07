import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import {
  getWaveOutroImpactState,
  getWaveOutroPresentationProfile,
} from "./waveOutroProfiles.js";

const RENDERABLE_STATUSES = new Set([
  "finalKill",
  "cleanup",
  "waveCompleteBanner",
  "decisionIntro",
  "victoryIntro",
]);

function getCopy(outro, phase) {
  if (outro.status === "finalKill") {
    return {
      title: outro.finalWave ? "ÚLTIMO HOSTIL" : "ÚLTIMO ALVO NEUTRALIZADO",
      compact: true,
    };
  }
  if (outro.status === "waveCompleteBanner") {
    return {
      title: outro.finalWave ? "PERÍMETRO ASSEGURADO" : `ONDA ${outro.completedWave} CONCLUÍDA`,
      subtitle: outro.finalWave ? "Hostis neutralizados" : "Perímetro temporariamente seguro",
      detail: `${Number(outro.killed) || 0} HOSTIS NEUTRALIZADOS`,
    };
  }
  if (outro.status === "decisionIntro") {
    return {
      title: "NOVA VANTAGEM TÁTICA",
      subtitle: "Prepare sua defesa para a próxima onda",
    };
  }
  if (outro.status === "victoryIntro") {
    return {
      title: "MISSÃO CONCLUÍDA",
      subtitle: phase?.name || "Perímetro assegurado",
    };
  }
  return {};
}

export function WaveOutroCinematicOverlay({
  outro,
  phase = null,
  palette = null,
  reduceMotion = false,
}) {
  if (!outro || !RENDERABLE_STATUSES.has(outro.status)) return null;

  const profile = getWaveOutroPresentationProfile(outro);
  const impact = getWaveOutroImpactState(outro);
  const effectivePalette = phase?.palette || palette || {};
  const primary = effectivePalette.primary || "#38bdf8";
  const accent = effectivePalette.accent || "#e0f2fe";
  const enemy = outro.lastKill?.enemy;
  const row = Number.isInteger(outro.lastKill?.row) ? outro.lastKill.row : 2;
  const enemyX = Number(enemy?.x);
  const x = Number.isFinite(enemyX)
    ? Math.max(0, Math.min(100, enemyX / FIELD.width * 100))
    : 65;
  const focusY = VIEWPORT.fieldOffsetY + (row + 0.5) * CELL.height;
  const y = Math.max(0, Math.min(100, focusY / VIEWPORT.height * 100));
  const copy = getCopy(outro, phase);
  const decisionCards = outro.status === "decisionIntro" && Array.isArray(outro.decisionOptions)
    ? outro.decisionOptions
    : [];
  const showLetterbox = profile.letterbox
    && !reduceMotion
    && ["finalKill", "cleanup", "waveCompleteBanner"].includes(outro.status);

  const rootClasses = ["wave-outro"];
  if (outro.status === "finalKill") rootClasses.push("final-kill");
  if (outro.status === "cleanup") rootClasses.push("cleanup");
  if (outro.status === "waveCompleteBanner") rootClasses.push("wave-complete");
  if (outro.status === "decisionIntro") rootClasses.push("decision-intro");
  if (outro.status === "victoryIntro") rootClasses.push("victory-intro");
  if (outro.finalWave && outro.status === "finalKill") rootClasses.push("mission-final-kill");
  if (outro.finalWave && outro.status === "waveCompleteBanner") rootClasses.push("mission-secured");
  if (outro.finalWave && outro.status === "victoryIntro") rootClasses.push("mission-finale");

  const ringScale = impact.active
    ? 0.35 + impact.progress * profile.shockwaveScale
    : 1;
  const flashOpacity = impact.active
    ? profile.flashOpacity * Math.max(0, 1 - impact.progress * 1.35)
    : 0;

  return (
    <div className={rootClasses.join(" ")} aria-live="polite">
      {!reduceMotion && (
        <div
          className={`wave-outro-cinematic-layer profile-${profile.id}`}
          aria-hidden="true"
          style={{
            "--wave-outro-primary": primary,
            "--wave-outro-accent": accent,
          }}
        >
          {showLetterbox && <>
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
      )}

      {outro.status === "finalKill"
        ? copy.title && <small>{copy.title}</small>
        : copy.title && <b>{copy.title}</b>}
      {copy.subtitle && <span>{copy.subtitle}</span>}
      {copy.detail && <small>{copy.detail}</small>}

      {decisionCards.length > 0 && (
        <div className="wave-outro-card-preview" aria-hidden="true">
          {decisionCards.map((option) => <div key={option.id}>{option.label || ""}</div>)}
        </div>
      )}
    </div>
  );
}

export default WaveOutroCinematicOverlay;
