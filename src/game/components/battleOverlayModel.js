import { getReadyColossusControls } from "./ColossusSpecialButtons.jsx";
import { getDematerializationPulseControls } from "./DematerializationPulseControls.jsx";

/**
 * Produces the read-only data contract consumed by BattleOverlays.
 * Rendering components never receive the mutable battle session itself.
 */
export function createBattleOverlayModel({
  snapshot,
  notification,
  fortuneBlocksIntermission,
  session,
}) {
  return {
    snapshot,
    notification,
    fortuneBlocksIntermission,
    dematerializationPulseControls: getDematerializationPulseControls(session),
    colossusControls: getReadyColossusControls(session),
  };
}
