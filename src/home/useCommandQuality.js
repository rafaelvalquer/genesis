import { useCampaignQuality } from "../campaign/useCampaignQuality.js";
import { COMMAND_SCENE_PROFILES } from "./commandSceneProfiles.js";

export function useCommandQuality(settings) {
  const shared = useCampaignQuality(settings);
  const profile = COMMAND_SCENE_PROFILES[shared.quality] || COMMAND_SCENE_PROFILES.medium;
  const reduceMotion = shared.reduceMotion
    || document.documentElement.classList.contains("reduce-motion");
  return {
    ...shared,
    ...profile,
    reduceMotion,
    orbitalParticles: reduceMotion ? Math.min(6, profile.orbitalParticles) : profile.orbitalParticles,
  };
}
