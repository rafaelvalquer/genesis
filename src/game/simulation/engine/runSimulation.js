import {
  accelerateWaveOutro,
  adaptiveAidPausesSimulation,
  advanceWaveOutro,
  stepBattle,
} from "../../battleModel.js";
import {
  StrategicAgent,
} from "../ai/StrategicAgent.js";
import {
  createPhaseForecast,
} from "../planners/phaseForecast.js";
import {
  executeSimulationAction,
} from "./simulationActions.js";
import {
  createHeadlessSession,
} from "./createHeadlessSession.js";
import {
  normalizeSimulationConfig,
} from "../simulationConfig.js";
import {
  resolveStrategyProfile,
} from "../strategies/strategyProfiles.js";
import {
  SimulationMetrics,
} from "../metrics/SimulationMetrics.js";
import {
  SimulationValidationError,
  StagnationDetector,
  validateSimulationState,
} from "./simulationValidation.js";
import { getMissionEncounterCount } from "../../missionProgression.js";

function activeOutro(session) {
  return (
    session.waveOutro?.status
    && ![
      "idle",
      "completed",
    ].includes(
      session.waveOutro.status,
    )
  );
}

function safeErrorDetails(error) {
  return {
    name: error?.name || "Error",
    message:
      error?.message
      || String(error),
    details:
      error?.details || null,
    stack:
      error?.stack || null,
  };
}

export async function runBattleSimulation({
  phase,
  loadout,
  seed = 1,
  strategy = "balanced",
  policyOverrides = {},
  config: configOverrides = {},
  battleOptions = {},
  onProgress,
}) {
  const config = normalizeSimulationConfig(
    configOverrides,
  );

  const profile = resolveStrategyProfile(
    strategy,
    policyOverrides,
  );

  const forecast = createPhaseForecast(
    phase,
    seed,
  );

  const session = createHeadlessSession({
    phase,
    loadout,
    seed,
    battleOptions,
  });

  const agent = new StrategicAgent({
    phase,
    phaseForecast: forecast,
    profile,
    config,
  });

  const metrics = new SimulationMetrics({
    phase,
    seed,
    strategyId: profile.id,
    loadout,
    actionLogLimit:
      config.actionLogLimit,
  });

  const stagnation = (
    new StagnationDetector(
      config.maximumStagnationMs,
    )
  );

  let controlElapsedMs = 0;
  let nextAgentTickAt = 0;
  let nextValidationAt = 0;
  let lastProgressAt = -Infinity;
  let loopGuard = 0;

  const maximumLoops = Math.ceil(
    config.maximumDurationMs
    / config.stepMs,
  ) * 3;

  try {
    validateSimulationState(session);
    metrics.validationChecks += 1;

    while (
      !session.result
      && !session.outcome
      && session.elapsed
        < config.maximumDurationMs
      && loopGuard < maximumLoops
    ) {
      loopGuard += 1;
      controlElapsedMs += config.stepMs;

      const outroEvents = (
        advanceWaveOutro(
          session,
          config.stepMs,
        )
      );

      metrics.recordEvents(
        outroEvents,
        session,
      );

      if (
        config.accelerateOutros
        && activeOutro(session)
      ) {
        accelerateWaveOutro(session);
      }

      if (
        controlElapsedMs
        >= nextAgentTickAt
      ) {
        nextAgentTickAt = (
          controlElapsedMs
          + config.agentTickMs
        );

        metrics.agentTicks += 1;

        const plan = agent.plan(session);

        for (const action of plan.actions) {
          const result = (
            executeSimulationAction({
              session,
              action,
              observation:
                plan.observation,
              memory: agent.memory,
            })
          );

          metrics.recordAction(
            action,
            result,
            session.elapsed,
          );

          const actionEvents = (
            Array.isArray(result?.events)
              ? result.events
              : result?.event
                ? [result.event]
                : []
          );

          metrics.recordEvents(
            actionEvents,
            session,
          );
        }
      }

      const pausedByAid = (
        adaptiveAidPausesSimulation(
          session.adaptiveAid?.status,
        )
      );

      if (!pausedByAid) {
        const events = stepBattle(
          session,
          config.stepMs,
        );

        metrics.recordEvents(
          events,
          session,
        );
      }

      metrics.recordStep(session);

      const shouldValidate = (
        config.validateEveryStep
        || controlElapsedMs
          >= nextValidationAt
      );

      if (shouldValidate) {
        nextValidationAt = (
          controlElapsedMs
          + config.validationEveryMs
        );

        validateSimulationState(session);
        metrics.validationChecks += 1;

        const stagnationState = (
          stagnation.update(
            session,
            controlElapsedMs,
          )
        );

        if (
          stagnationState.stagnant
          && !session.result
          && !session.outcome
        ) {
          metrics.deadlock = {
            message:
              "Simulação sem progresso além do limite.",
            durationMs:
              stagnationState.durationMs,
            fingerprint:
              stagnationState.fingerprint,
            waveIndex:
              session.waveIndex,
            waveActive:
              session.waveActive,
            enemies:
              session.enemies.length,
            queued:
              session.queue.length,
            waveOutroStatus:
              session.waveOutro?.status,
            adaptiveAidStatus:
              session.adaptiveAid?.status,
          };

          break;
        }
      }

      if (
        typeof onProgress === "function"
        && controlElapsedMs
          - lastProgressAt
          >= 5000
      ) {
        lastProgressAt = controlElapsedMs;

        onProgress({
          phaseId: phase.id,
          seed,
          strategyId: profile.id,
          elapsedMs: session.elapsed,
          waveIndex:
            session.waveIndex,
          totalWaves:
            getMissionEncounterCount(phase),
          integrity:
            session.integrity,
          enemies:
            session.enemies.length,
          queued:
            session.queue.length,
        });
      }
    }

    if (
      !session.result
      && !metrics.deadlock
      && !metrics.invalidState
    ) {
      metrics.timeout = true;
    }
  } catch (error) {
    metrics.invalidState = (
      safeErrorDetails(error)
    );

    if (
      !(error
        instanceof SimulationValidationError)
    ) {
      metrics.invalidState.unexpected = true;
    }
  }

  return metrics.finalize(
    session,
    agent.summary(),
  );
}
