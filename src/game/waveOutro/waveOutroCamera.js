import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";

export function getCinematicWaveOutroCameraTransform(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (!outro || ["idle", "completed"].includes(outro.status)) return null;
  if (reduceMotion) return null;

  const elapsed = outro.elapsedMs || 0;
  if (elapsed < 180) return null; // Wait for impact

  // Zoom slowly from 1.0 to 1.15 over 3 seconds
  const cinematicProgress = Math.min(1, (elapsed - 180) / 3000);
  
  // Calculate center of zoom (the last kill)
  const enemy = outro.lastKill?.enemy;
  const row = Number.isInteger(outro.lastKill?.row) ? outro.lastKill.row : 2;
  const targetX = Number.isFinite(Number(enemy?.x)) ? enemy.x : FIELD.width / 2;
  const targetY = VIEWPORT.fieldOffsetY + (row + 0.5) * CELL.height;

  // A subtle pan effect towards the kill
  const panFactor = cinematicProgress * 0.1;
  const impactX = (VIEWPORT.width / 2 - targetX) * panFactor;
  const impactY = (VIEWPORT.height / 2 - targetY) * panFactor;

  return {
    scale: 1 + cinematicProgress * (outro.finalWave ? 0.25 : 0.15),
    impactX,
    impactY,
  };
}
