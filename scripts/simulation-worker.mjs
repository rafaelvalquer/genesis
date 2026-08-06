import {
  parentPort,
} from "node:worker_threads";
import {
  PHASES,
  getPhaseIndex,
} from "../src/game/content.js";
import {
  planLoadoutForPhase,
  resolveStrategyProfile,
  runBattleSimulation,
} from "../src/game/simulation/index.js";

if (!parentPort) {
  throw new Error(
    "simulation-worker deve ser iniciado por worker_threads.",
  );
}

parentPort.on(
  "message",
  async (message) => {
    if (message?.type !== "run") {
      return;
    }

    const {
      id,
      task,
    } = message;

    try {
      const phase = PHASES.find(
        (entry) => entry.id === task.phaseId,
      );

      if (!phase) {
        throw new Error(
          `Fase desconhecida: ${task.phaseId}`,
        );
      }

      const phaseIndex = getPhaseIndex(
        phase.id,
      );

      const profile = resolveStrategyProfile(
        task.strategy,
        task.policyOverrides || {},
      );

      const loadout = (
        task.loadout?.length
          ? task.loadout
          : planLoadoutForPhase({
            phase,
            phaseIndex,
            profile,
            seed: task.seed,
          }).loadout
      );

      const result = await runBattleSimulation({
        phase,
        loadout,
        seed: task.seed,
        strategy: task.strategy,
        policyOverrides:
          task.policyOverrides || {},
        config: task.config || {},
      });

      parentPort.postMessage({
        type: "result",
        id,
        result,
      });
    } catch (error) {
      parentPort.postMessage({
        type: "error",
        id,
        error: {
          name: error?.name || "Error",
          message:
            error?.message || String(error),
          stack: error?.stack || null,
        },
      });
    }
  },
);
