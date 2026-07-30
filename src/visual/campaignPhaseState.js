import { getPhaseIndex } from "../game/content.js";

export function getCampaignPhaseState(phase, campaign) {
  const completed = Number(campaign.phaseStats?.[phase.id]?.victories || 0) > 0;
  const current = campaign.currentPhaseId === phase.id;
  const accessible = getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex;
  return {
    completed,
    current,
    accessible,
    locked: !accessible,
    boss: Boolean(phase.boss),
    stars: Number(campaign.phaseStats?.[phase.id]?.bestStars || 0),
    key: current ? "current" : completed ? "completed" : accessible ? "available" : "locked",
  };
}
