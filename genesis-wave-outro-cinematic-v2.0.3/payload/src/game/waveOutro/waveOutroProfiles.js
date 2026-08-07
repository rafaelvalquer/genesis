const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const lerp = (a, b, t) => a + (b - a) * t;

export const STANDARD_OUTRO = Object.freeze({
  id: "standard",
  impactAtMs: 220,
  finalKillEndMs: 620,
  cleanupEndMs: 1150,
  bannerEndMs: 2950,
  completeEndMs: 4050,
  aftermathAtMs: 620,
  cameraZoom: 1.10,
  slowMotionMin: 0.30,
  impactShake: 2.5,
  shockwaveRadius: 130,
  flashRadius: 145,
  freezeMs: 42,
  deathLingerMs: 900,
  skipProtectionMs: 600,
  globalFlash: false,
  letterbox: false,
  audio: [[0, 1], [120, .75], [220, .35], [620, .25], [1000, 0]],
});

export const CINEMATIC_OUTRO = Object.freeze({
  ...STANDARD_OUTRO,
  id: "cinematic",
  impactAtMs: 240,
  finalKillEndMs: 760,
  cleanupEndMs: 1250,
  bannerEndMs: 3050,
  completeEndMs: 4150,
  aftermathAtMs: 760,
  cameraZoom: 1.12,
  slowMotionMin: 0.24,
  impactShake: 4,
  shockwaveRadius: 155,
  flashRadius: 170,
  freezeMs: 60,
  deathLingerMs: 1100,
  audio: [[0, 1], [120, .7], [240, .28], [760, .18], [1120, 0]],
});

export const MISSION_FINALE_OUTRO = Object.freeze({
  id: "missionFinale",
  impactAtMs: 320,
  finalKillEndMs: 1500,
  cleanupEndMs: 3000,
  bannerEndMs: 4200,
  completeEndMs: 6000,
  aftermathAtMs: 1500,
  cameraZoom: 1.13,
  pullbackZoom: 0.98,
  slowMotionMin: 0.18,
  impactShake: 5,
  shockwaveRadius: 220,
  flashRadius: 220,
  freezeMs: 84,
  deathLingerMs: 1300,
  skipProtectionMs: 1500,
  globalFlash: true,
  letterbox: true,
  audio: [[0, 1], [180, .6], [320, .15], [700, .08], [1500, .05], [2200, 0]],
});

export const BOSS_FINALE_OUTRO = Object.freeze({
  ...MISSION_FINALE_OUTRO,
  id: "bossFinale",
  impactAtMs: 340,
  finalKillEndMs: 1800,
  cleanupEndMs: 3200,
  bannerEndMs: 4600,
  completeEndMs: 6500,
  aftermathAtMs: 1800,
  cameraZoom: 1.16,
  slowMotionMin: 0.16,
  impactShake: 7,
  shockwaveRadius: 260,
  flashRadius: 250,
  freezeMs: 90,
  deathLingerMs: 1600,
  skipProtectionMs: 1500,
  audio: [[0, 1], [180, .55], [340, .12], [850, .06], [1800, .04], [2500, 0]],
});

export const WAVE_OUTRO_PROFILES = Object.freeze({
  standard: STANDARD_OUTRO,
  cinematic: CINEMATIC_OUTRO,
  missionFinale: MISSION_FINALE_OUTRO,
  bossFinale: BOSS_FINALE_OUTRO,
});

export function getWaveOutroProfileId(outro) {
  if (outro?.finalWave && outro?.lastKill?.boss) return "bossFinale";
  if (outro?.finalWave) return "missionFinale";
  if (outro?.lastKill?.cinematic) return "cinematic";
  return "standard";
}

export function getWaveOutroProfile(outro) {
  const id = outro?.profileId || getWaveOutroProfileId(outro);
  return WAVE_OUTRO_PROFILES[id] || STANDARD_OUTRO;
}

export function getWaveOutroPhaseEnds(outro) {
  const profile = getWaveOutroProfile(outro);
  return {
    finalKill: profile.finalKillEndMs,
    cleanup: profile.cleanupEndMs,
    banner: profile.bannerEndMs,
    decisionIntro: profile.completeEndMs,
  };
}

export function sampleWaveOutroCurve(keyframes, elapsedMs) {
  if (!keyframes?.length) return 1;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (elapsed <= keyframes[0][0]) return keyframes[0][1];
  for (let index = 1; index < keyframes.length; index += 1) {
    const [rightTime, rightValue] = keyframes[index];
    const [leftTime, leftValue] = keyframes[index - 1];
    if (elapsed <= rightTime) {
      const progress = clamp01((elapsed - leftTime) / Math.max(1, rightTime - leftTime));
      return lerp(leftValue, rightValue, progress);
    }
  }
  return keyframes.at(-1)[1];
}

export function getWaveOutroSlowMotionFactor(outro, reduceMotion = false) {
  if (reduceMotion || !outro || !["finalKill", "cleanup"].includes(outro.status)) return 1;
  const profile = getWaveOutroProfile(outro);
  const elapsed = Math.max(0, outro.elapsedMs || 0);
  const impactAt = profile.impactAtMs;

  if (profile.id === "missionFinale" || profile.id === "bossFinale") {
    const minimum = profile.slowMotionMin;
    if (elapsed <= impactAt) return lerp(.45, minimum, clamp01(elapsed / impactAt));
    if (elapsed <= 700) return lerp(minimum, .25, clamp01((elapsed - impactAt) / Math.max(1, 700 - impactAt)));
    if (elapsed <= 1050) return .25;
    if (elapsed <= 1500) return lerp(.25, .45, clamp01((elapsed - 1050) / 450));
    if (elapsed <= 2200) return lerp(.45, 1, clamp01((elapsed - 1500) / 700));
    return 1;
  }

  if (elapsed <= impactAt) return lerp(.55, profile.slowMotionMin, clamp01(elapsed / impactAt));
  if (elapsed <= profile.finalKillEndMs) return profile.slowMotionMin;
  return lerp(profile.slowMotionMin, 1,
    clamp01((elapsed - profile.finalKillEndMs) / Math.max(1, profile.cleanupEndMs - profile.finalKillEndMs)));
}
