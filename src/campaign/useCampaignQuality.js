import { useMemo } from "react";

const PROFILES = {
  high: { pixelRatio: 1.75, stars: 760, particles: 150, detailCount: 72, segments: 5 },
  medium: { pixelRatio: 1.35, stars: 480, particles: 85, detailCount: 45, segments: 4 },
  low: { pixelRatio: 1, stars: 260, particles: 35, detailCount: 24, segments: 3 },
};

export function useCampaignQuality(settings) {
  return useMemo(() => {
    const reduced = settings.reduceMotion ||
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const base = PROFILES[settings.quality] || PROFILES.medium;
    return {
      ...base,
      quality: settings.quality || "medium",
      reduceMotion: Boolean(reduced),
      particles: reduced ? Math.min(24, base.particles) : base.particles,
    };
  }, [settings.quality, settings.reduceMotion]);
}
