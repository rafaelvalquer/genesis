#!/usr/bin/env node
import {
  PHASES,
  getPhaseIndex,
} from "../src/game/content.js";
import {
  planLoadoutForPhase,
  resolveStrategyProfile,
  runBattleSimulation,
} from "../src/game/simulation/index.js";

const phase = PHASES[0];

if (!phase) {
  throw new Error(
    "A campanha não possui fases.",
  );
}

const profile = (
  resolveStrategyProfile("balanced")
);

const plan = planLoadoutForPhase({
  phase,
  phaseIndex: getPhaseIndex(
    phase.id,
  ),
  profile,
  seed: 1001,
});

const result = await runBattleSimulation({
  phase,
  loadout: plan.loadout,
  seed: 1001,
  strategy: "balanced",
  config: {
    maximumDurationMs:
      12 * 60 * 1000,
    actionLogLimit: 20,
  },
});

console.log(
  JSON.stringify(
    {
      phaseId: result.phaseId,
      loadout: result.loadout,
      outcome: result.outcome,
      failureReason:
        result.failureReason,
      durationMs:
        result.durationMs,
      stars: result.stars,
      invalidState:
        result.invalidState,
      deadlock:
        result.deadlock,
      timeout:
        result.timeout,
    },
    null,
    2,
  ),
);

if (
  result.invalidState
  || result.deadlock
  || result.timeout
  || !result.outcome
) {
  process.exitCode = 1;
}
