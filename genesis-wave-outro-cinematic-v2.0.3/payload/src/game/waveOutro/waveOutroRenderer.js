import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import { getWaveOutroProfile } from "./waveOutroProfiles.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export function getWaveOutroOverlayModel(outro, phase = {}) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return null;
  const profile = getWaveOutroProfile(outro);
  const lastKill = outro.lastKill || {};
  const enemy = lastKill.enemy || {};
  const x = clamp(lastKill.impactX ?? enemy.x ?? FIELD.width * .65, 0, FIELD.width);
  const row = clamp(lastKill.row ?? 2, 0, FIELD.rows - 1);
  const y = VIEWPORT.fieldOffsetY + (row + .5) * CELL.height;
  const finalWave = Boolean(outro.finalWave);
  const style = {
    "--outro-impact-x": `${x / FIELD.width * 100}%`,
    "--outro-impact-y": `${y / VIEWPORT.height * 100}%`,
    "--outro-impact-delay": `${profile.impactAtMs}ms`,
    "--outro-shockwave-radius": `${profile.shockwaveRadius}px`,
    "--outro-primary": phase?.palette?.primary || "#22d3ee",
    "--outro-accent": phase?.palette?.accent || "#67e8f9",
  };

  if (outro.status === "finalKill") {
    return {
      className: `last-kill cinematic-shell profile-${profile.id} damage-${lastKill.damageKind || "ballistic"}`,
      title: finalWave ? "ÚLTIMO HOSTIL" : "ÚLTIMO ALVO NEUTRALIZADO",
      subtitle: null,
      detail: null,
      showImpact: true,
      showLetterbox: profile.letterbox,
      style,
    };
  }
  if (outro.status === "cleanup") {
    return {
      className: `cleanup cinematic-shell profile-${profile.id} damage-${lastKill.damageKind || "ballistic"}`,
      title: null,
      subtitle: null,
      detail: null,
      showImpact: true,
      showLetterbox: profile.letterbox,
      style,
    };
  }
  if (outro.status === "victoryIntro") {
    return {
      className: `decision-intro victory-intro profile-${profile.id}`,
      title: "MISSÃO CONCLUÍDA",
      subtitle: phase?.name || "Perímetro assegurado",
      detail: null,
      showImpact: false,
      showLetterbox: profile.letterbox,
      style,
    };
  }
  if (outro.status === "decisionIntro") {
    return {
      className: "decision-intro",
      title: "NOVA VANTAGEM TÁTICA",
      subtitle: "Prepare sua defesa para a próxima onda",
      detail: null,
      showImpact: false,
      showLetterbox: false,
      style,
    };
  }
  return {
    className: `wave-complete ${finalWave ? `mission-secured profile-${profile.id}` : ""}`,
    title: finalWave ? "PERÍMETRO ASSEGURADO" : `ONDA ${outro.completedWave} CONCLUÍDA`,
    subtitle: finalWave ? "Hostis neutralizados" : "Perímetro seguro",
    detail: finalWave ? `${outro.killed} HOSTIS NEUTRALIZADOS` : `${outro.killed} inimigos eliminados`,
    showImpact: false,
    showLetterbox: profile.letterbox,
    style,
  };
}
