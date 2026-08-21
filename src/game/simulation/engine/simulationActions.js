import {
  activateTroopSpecial,
  activateDematerializationPulse,
  isCapsuleClickable,
  openAdaptiveAidCapsule,
  placeTroop,
  removeTroop,
  repositionTroop,
  selectAdaptiveAidOption,
  selectDecision,
  setEnergyPickupPointer,
  startWave,
} from "../../battleModel.js";
import {
  getAdaptiveAidTargets,
  rankAdaptiveAidOptions,
} from "../planners/AdaptiveAidPlanner.js";

function actionKey(action) {
  switch (action.type) {
    case "place":
      return [
        "place",
        action.troopId,
        action.row,
        action.col,
      ].join(":");

    case "remove":
      return [
        "remove",
        action.row,
        action.col,
      ].join(":");

    case "reposition":
      return ["reposition", action.troopId, action.row, action.col].join(":");

    case "activateSpecial":
      return [
        "special",
        action.troopId,
      ].join(":");

    case "activateDematerializationPulse":
      return ["pulse", action.row].join(":");

    case "selectDecision":
      return [
        "decision",
        action.option?.id,
      ].join(":");

    case "selectAdaptiveAid":
      return [
        "aid",
        action.optionId,
      ].join(":");

    default:
      return action.type;
  }
}

function normalizeResult(result) {
  if (
    result
    && typeof result === "object"
  ) {
    return result;
  }

  return {
    ok: Boolean(result),
  };
}

export function collectNearestEnergyPickup(
  session,
) {
  if (!session.energyPickups?.length) {
    setEnergyPickupPointer(
      session,
      null,
    );

    return {
      ok: false,
      reason: "noPickups",
    };
  }

  const pickup = [...session.energyPickups]
    .sort(
      (left, right) => (
        Number(right.amount || 0)
          - Number(left.amount || 0)
        || Number(left.ageMs || 0)
          - Number(right.ageMs || 0)
      ),
    )[0];

  const ok = setEnergyPickupPointer(
    session,
    {
      x: pickup.x,
      y: pickup.y,
    },
  );

  return {
    ok,
    pickupId: pickup.id,
  };
}

function executeAdaptiveAidSelection(
  session,
  action,
  observation,
) {
  const ranked = action.optionId
    ? [{
      option: (
        observation.adaptiveAid
          .availableOptions
          .find(
            (option) => (
              option.id
              === action.optionId
            ),
          )
      ),
    }]
    : rankAdaptiveAidOptions(
      observation,
    );

  for (const entry of ranked) {
    if (!entry.option) continue;

    const requiresTarget = Boolean(
      entry.option.requiresTarget
      || entry.option.positional
    );

    const targets = requiresTarget
      ? getAdaptiveAidTargets(
        observation,
      )
      : [null];

    for (const target of targets) {
      const result = normalizeResult(
        selectAdaptiveAidOption(
          session,
          entry.option.id,
          target,
        ),
      );

      if (result.ok) {
        return {
          ...result,
          optionId: entry.option.id,
          target,
        };
      }
    }
  }

  return {
    ok: false,
    reason: "Nenhuma assistência pôde ser aplicada.",
  };
}

export function executeSimulationAction({
  session,
  action,
  observation,
  memory,
}) {
  const key = action.key
    || actionKey(action);

  action.key = key;

  if (
    !memory.canAttempt(
      key,
      session.elapsed,
    )
  ) {
    return {
      ok: false,
      skipped: true,
      reason: "cooldown",
    };
  }

  let result;

  switch (action.type) {
    case "place":
      result = placeTroop(
        session,
        action.troopId,
        action.row,
        action.col,
      );
      break;

    case "remove":
      result = removeTroop(
        session,
        action.row,
        action.col,
      );
      break;

    case "reposition":
      result = repositionTroop(
        session,
        action.troopId,
        action.row,
        action.col,
      );
      break;

    case "activateSpecial":
      result = activateTroopSpecial(
        session,
        action.troopId,
      );
      break;

    case "activateDematerializationPulse":
      result = activateDematerializationPulse(
        session,
        action.row,
        { source: "ai", reason: action.reason || "aiTactical" },
      );
      break;

    case "startWave":
      result = {
        ok: startWave(session),
      };
      break;

    case "selectDecision":
      result = {
        ok: selectDecision(
          session,
          action.option,
          action.target || null,
        ),
      };
      break;

    case "openAdaptiveAid":
      result = isCapsuleClickable(session)
        ? openAdaptiveAidCapsule(session)
        : {
          ok: false,
          reason: "capsuleNotClickable",
        };
      break;

    case "selectAdaptiveAid":
      result = executeAdaptiveAidSelection(
        session,
        action,
        observation,
      );
      break;

    case "collectPickup":
      result = collectNearestEnergyPickup(
        session,
      );
      break;

    default:
      result = {
        ok: false,
        reason: (
          `Ação desconhecida: ${action.type}`
        ),
      };
      break;
  }

  const normalized = normalizeResult(result);

  if (normalized.ok) {
    memory.recordSuccess(
      action,
      session.elapsed,
      normalized,
    );
  } else if (!normalized.skipped) {
    memory.recordFailure(
      key,
      session.elapsed,
      normalized.reason || "falha",
    );
  }

  return normalized;
}
