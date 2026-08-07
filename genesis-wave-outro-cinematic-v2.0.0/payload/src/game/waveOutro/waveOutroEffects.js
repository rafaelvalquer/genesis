import { getWaveOutroProfile } from "./waveOutroProfiles.js";

const DAMAGE_KINDS = new Set(["ballistic", "explosive", "electric", "energy", "melee", "ice"]);

export function inferWaveOutroDamageKind(sourceTroopType, sourceConfig = {}, context = {}) {
  const explicit = context.damageKind || context.kind;
  if (DAMAGE_KINDS.has(explicit)) return explicit;
  if (context.explosive || ["mortar", "rocket", "explosive"].includes(context.weapon)) return "explosive";
  if (context.electric || /volt|electric|tesla/i.test(`${sourceTroopType || ""} ${context.weapon || ""}`)) return "electric";
  if (context.ice || /krio|cryo|ice|frost/i.test(`${sourceTroopType || ""} ${context.weapon || ""}`)) return "ice";
  const attack = sourceConfig.attack || "";
  if (["melee", "tileMelee", "arcCombo"].includes(attack)) return "melee";
  if (["mortar", "explosive", "rocket"].includes(attack)) return "explosive";
  if (["energy", "beam", "pulse"].includes(attack)) return "energy";
  if (/electric|voltaic/i.test(attack)) return "electric";
  return "ballistic";
}

export function getFinalImpactIntensity(outro) {
  let intensity = 1;
  if (outro?.lastKill?.cinematic) intensity += .25;
  if (outro?.lastKill?.boss) intensity += .35;
  if (outro?.finalWave) intensity += .4;
  return Math.min(1.8, intensity);
}

export function buildWaveOutroImpactEvent(outro) {
  const profile = getWaveOutroProfile(outro);
  const lastKill = outro?.lastKill || {};
  const enemy = lastKill.enemy || {};
  const intensity = getFinalImpactIntensity(outro);
  return {
    type: outro?.finalWave ? "missionFinalImpact" : "waveFinalImpact",
    wave: outro?.completedWave,
    finalWave: Boolean(outro?.finalWave),
    enemyId: enemy.id || null,
    x: Number.isFinite(lastKill.impactX) ? lastKill.impactX : enemy.x,
    y: Number.isFinite(lastKill.impactY) ? lastKill.impactY : enemy.y,
    row: lastKill.row,
    sourceTroopId: lastKill.sourceTroopId || null,
    sourceTroopType: lastKill.sourceTroopType || null,
    weapon: lastKill.weapon || null,
    damageKind: lastKill.damageKind || "ballistic",
    cinematic: Boolean(lastKill.cinematic),
    boss: Boolean(lastKill.boss),
    elite: Boolean(lastKill.elite),
    alpha: Boolean(lastKill.alpha),
    intensity,
    shake: profile.impactShake * Math.min(1.25, intensity),
    lightRadius: Math.round(profile.flashRadius * intensity),
    shockwaveRadius: Math.round(profile.shockwaveRadius * intensity),
    freezeMs: profile.freezeMs,
    deathLingerMs: profile.deathLingerMs,
  };
}

export function buildWaveOutroAftermathEvent(outro) {
  return {
    type: outro?.finalWave ? "missionFinalAftermath" : "waveFinalAftermath",
    wave: outro?.completedWave,
    finalWave: Boolean(outro?.finalWave),
    x: outro?.lastKill?.impactX ?? outro?.lastKill?.enemy?.x,
    y: outro?.lastKill?.impactY ?? outro?.lastKill?.enemy?.y,
  };
}
