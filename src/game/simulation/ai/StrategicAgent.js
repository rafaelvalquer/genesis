import {
  ENEMIES,
} from "../../content.js";
import {
  createBattleObservation,
} from "../observation/createBattleObservation.js";
import {
  planDecision,
} from "../planners/DecisionPlanner.js";
import {
  planSpecialActions,
} from "../planners/AbilityPlanner.js";
import {
  planPlacementActions,
} from "../planners/PlacementPlanner.js";
import {
  calculateWaveReadiness,
} from "../planners/WaveStartPlanner.js";
import {
  planReplacementActions,
} from "../planners/ReplacementPlanner.js";
import {
  rankAdaptiveAidOptions,
} from "../planners/AdaptiveAidPlanner.js";
import {
  AgentMemory,
} from "./AgentMemory.js";

function waveOutroActive(
  observation,
) {
  return ![
    "idle",
    "completed",
  ].includes(
    observation.state.waveOutroStatus,
  );
}

export class StrategicAgent {
  constructor({
    phase,
    phaseForecast,
    profile,
    config,
  }) {
    this.phase = phase;
    this.phaseForecast = phaseForecast;
    this.profile = profile;
    this.config = config;
    this.memory = new AgentMemory();
    this.enemyConfigs = ENEMIES;
  }

  createContext() {
    return {
      phaseForecast:
        this.phaseForecast,
      enemyConfigs:
        this.enemyConfigs,
    };
  }

  observe(session) {
    this.memory.update(session);

    return createBattleObservation(
      session,
      this.createContext(),
    );
  }

  planAdaptiveAid(
    observation,
  ) {
    if (!this.config.allowAdaptiveAid) {
      return [];
    }

    const status = (
      observation.adaptiveAid.status
    );

    if (
      status === "landed"
      || status === "available"
      || status === "capsule"
    ) {
      return [{
        type: "openAdaptiveAid",
        priority: 200,
        reason: "adaptiveAidAvailable",
      }];
    }

    if (
      status === "choosing"
      || status === "targeting"
    ) {
      const ranked = (
        rankAdaptiveAidOptions(
          observation,
        )
      );

      return ranked.length
        ? [{
          type: "selectAdaptiveAid",
          optionId:
            ranked[0].option.id,
          priority: 195,
          reason: "adaptiveAidChoice",
        }]
        : [];
    }

    return [];
  }

  planPendingDecision(
    session,
    observation,
  ) {
    if (
      !observation.state.pendingDecision
    ) {
      return [];
    }

    const planned = planDecision(
      session,
      observation,
      this.profile,
    );

    return planned
      ? [{
        type: "selectDecision",
        option: planned.option,
        target: planned.target,
        priority: 180,
        reason: "tacticalDecision",
        score: planned.score,
      }]
      : [];
  }

  planWaveStart(
    observation,
  ) {
    if (
      observation.state.waveActive
      || observation.state.pendingDecision
      || waveOutroActive(observation)
      || observation.state.outcome
    ) {
      return [];
    }

    const preparationElapsed = (
      this.memory
        .getPreparationElapsed({
          elapsed:
            observation.phase.elapsedMs,
        })
    );

    const readiness = (
      calculateWaveReadiness(
        observation,
        this.profile,
        preparationElapsed,
      )
    );

    const forcedByTimeout = (
      preparationElapsed
      >= (
        observation.phase.waveIndex === 0
          ? this.config.preparationLimitMs
          : this.config.intermissionLimitMs
      )
    );

    if (
      readiness.shouldStart
      || forcedByTimeout
    ) {
      return [{
        type: "startWave",
        priority: forcedByTimeout
          ? 170
          : 85 + readiness.readiness * 40,
        reason: forcedByTimeout
          ? "preparationTimeout"
          : "readiness",
        readiness,
      }];
    }

    return [];
  }

  plan(
    session,
  ) {
    const observation = this.observe(
      session,
    );

    if (
      observation.state.outcome
      || session.result
    ) {
      return {
        observation,
        actions: [],
      };
    }

    const actions = [];

    if (
      this.config.collectEnergyPickups
      && session.energyPickups?.length
    ) {
      actions.push({
        type: "collectPickup",
        priority: 210,
        reason: "energyPickup",
      });
    }

    actions.push(
      ...this.planAdaptiveAid(
        observation,
      ),
    );

    if (
      actions.some(
        (action) => (
          action.priority >= 190
        ),
      )
    ) {
      return {
        observation,
        actions: actions.sort(
          (left, right) => (
            right.priority
            - left.priority
          ),
        ),
      };
    }

    actions.push(
      ...this.planPendingDecision(
        session,
        observation,
      ),
    );

    if (
      observation.state.pendingDecision
      || waveOutroActive(observation)
    ) {
      return {
        observation,
        actions: actions.sort(
          (left, right) => (
            right.priority
            - left.priority
          ),
        ),
      };
    }

    actions.push(
      ...planSpecialActions(
        session,
        observation,
        this.profile,
      ),
    );

    const replacementActions = (
      planReplacementActions(
        session,
        observation,
        this.profile,
        Math.max(
          1,
          this.config.maximumActionsPerTick - 1,
        ),
      )
    );

    actions.push(
      ...replacementActions.map(
        (action) => ({
          ...action,
          priority:
            130 + action.score,
        }),
      ),
    );

    const placementPlan = (
      planPlacementActions(
        session,
        observation,
        this.profile,
        Math.max(
          1,
          this.config.maximumActionsPerTick - 1,
        ),
      )
    );

    actions.push(
      ...placementPlan.actions.map(
        (action) => ({
          ...action,
          priority:
            60 + action.score,
        }),
      ),
    );

    actions.push(
      ...this.planWaveStart(
        observation,
      ),
    );

    return {
      observation,
      reserve:
        placementPlan.reserve,
      emergency:
        placementPlan.emergency,
      actions: actions
        .sort(
          (left, right) => (
            right.priority
            - left.priority
          ),
        )
        .slice(
          0,
          this.config.maximumActionsPerTick,
        ),
    };
  }

  summary() {
    return this.memory.summary();
  }
}
