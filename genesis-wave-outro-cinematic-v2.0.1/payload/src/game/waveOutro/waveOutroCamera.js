import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import { getWaveOutroProfile } from "./waveOutroProfiles.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
export const smoothStep = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export function getWaveOutroFocusPoint(outro) {
  const enemy = outro?.lastKill?.enemy;
  return {
    x: clamp(enemy?.x ?? FIELD.width * .65, FIELD.width * .25, FIELD.width * .82),
    y: VIEWPORT.fieldOffsetY + ((outro?.lastKill?.row ?? 2) + .5) * CELL.height,
  };
}

function getZoom(outro, profile) {
  const elapsed = Math.max(0, outro.elapsedMs || 0);
  const finale = ["missionFinale", "bossFinale"].includes(profile.id);
  if (!finale) {
    const enterEnd = Math.min(120, profile.impactAtMs);
    if (elapsed < enterEnd) return lerp(1, profile.cameraZoom, easeOutCubic(elapsed / enterEnd));
    if (elapsed < profile.finalKillEndMs) return profile.cameraZoom;
    return lerp(profile.cameraZoom, 1, smoothStep(
      (elapsed - profile.finalKillEndMs) / Math.max(1, profile.cleanupEndMs - profile.finalKillEndMs),
    ));
  }

  if (elapsed < 180) return lerp(1, 1.04, easeOutCubic(elapsed / 180));
  if (elapsed < profile.impactAtMs) return lerp(1.04, profile.cameraZoom,
    easeOutCubic((elapsed - 180) / Math.max(1, profile.impactAtMs - 180)));
  if (elapsed < 1050) return profile.cameraZoom;
  if (elapsed < 2200) return lerp(profile.cameraZoom, 1.08, smoothStep((elapsed - 1050) / 1150));
  const endZoom = profile.pullbackZoom ?? 1;
  return lerp(1.08, endZoom, smoothStep((elapsed - 2200) / Math.max(1, profile.cleanupEndMs - 2200)));
}

export function getWaveOutroCameraTransform(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro || !["finalKill", "cleanup"].includes(outro.status)) return null;
  const profile = getWaveOutroProfile(outro);
  const focus = getWaveOutroFocusPoint(outro);
  const elapsed = Math.max(0, outro.elapsedMs || 0);
  const impactDelta = Math.abs(elapsed - profile.impactAtMs);
  const shakeWindow = profile.freezeMs + 70;
  const impactProgress = clamp01(1 - impactDelta / Math.max(1, shakeWindow));
  const impact = Math.sin((elapsed - profile.impactAtMs) / 12 * Math.PI)
    * profile.impactShake * impactProgress;
  return {
    zoom: getZoom(outro, profile),
    focusX: focus.x,
    focusY: focus.y,
    impactX: impact,
    impactY: -impact * .42,
  };
}
