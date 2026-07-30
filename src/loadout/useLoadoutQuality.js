import { useCampaignQuality } from "../campaign/useCampaignQuality.js";
import { LOADOUT_SCENE_PROFILES } from "./loadoutSceneProfiles.js";

export function useLoadoutQuality(settings) {
  const campaignQuality = useCampaignQuality(settings);
  const profile = LOADOUT_SCENE_PROFILES[campaignQuality.quality] || LOADOUT_SCENE_PROFILES.medium;
  const reduceMotion = campaignQuality.reduceMotion
    || document.documentElement.classList.contains("reduce-motion");
  return {
    ...campaignQuality,
    ...profile,
    reduceMotion,
    particles: reduceMotion ? Math.min(8, profile.particles) : profile.particles,
  };
}
