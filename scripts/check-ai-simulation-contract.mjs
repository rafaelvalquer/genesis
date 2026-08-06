#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

const errors = [];

function read(relativePath) {
  const filePath = path.join(
    repoRoot,
    relativePath,
  );

  if (!fs.existsSync(filePath)) {
    errors.push(
      `Arquivo obrigatório ausente: ${relativePath}`,
    );

    return "";
  }

  return fs.readFileSync(
    filePath,
    "utf8",
  );
}

const runner = read(
  "src/game/simulation/engine/runSimulation.js",
);

const actions = read(
  "src/game/simulation/engine/simulationActions.js",
);

const agent = read(
  "src/game/simulation/ai/StrategicAgent.js",
);

const observation = read(
  "src/game/simulation/observation/createBattleObservation.js",
);

const laneThreat = read(
  "src/game/simulation/observation/laneThreatMap.js",
);

const loadout = read(
  "src/game/simulation/planners/LoadoutPlanner.js",
);

const placement = read(
  "src/game/simulation/planners/PlacementPlanner.js",
);

const optimizer = read(
  "src/game/simulation/optimization/PolicyOptimizer.js",
);

const validation = read(
  "src/game/simulation/engine/simulationValidation.js",
);

const cache = read(
  "src/game/simulation/optimization/SimulationCache.js",
);

const campaignScript = read(
  "scripts/simulate-campaign.mjs",
);

const phaseScript = read(
  "scripts/simulate-phase.mjs",
);

const optimizeCampaignScript = read(
  "scripts/optimize-campaign-strategies.mjs",
);

const report = read(
  "src/game/simulation/metrics/SimulationReport.js",
);

const forbiddenUiImports = [
  "react",
  "react-dom",
  "GameCanvas",
  "CanvasRenderingContext",
  "requestAnimationFrame",
  "document.",
  "window.",
];

const simulationSources = [
  runner,
  actions,
  agent,
  observation,
  laneThreat,
  loadout,
  placement,
  optimizer,
  validation,
].join("\n");

for (const forbidden of forbiddenUiImports) {
  if (simulationSources.includes(forbidden)) {
    errors.push(
      `Dependência de interface encontrada no simulador: ${forbidden}`,
    );
  }
}

[
  "createBattleSession",
  "validateLoadoutForPhase",
].forEach((marker) => {
  const source = read(
    "src/game/simulation/engine/createHeadlessSession.js",
  );

  if (!source.includes(marker)) {
    errors.push(
      `createHeadlessSession não usa ${marker}.`,
    );
  }
});

[
  "advanceWaveOutro",
  "stepBattle",
  "adaptiveAidPausesSimulation",
  "validateSimulationState",
  "StagnationDetector",
  "StrategicAgent",
].forEach((marker) => {
  if (!runner.includes(marker)) {
    errors.push(
      `Runner não usa ${marker}.`,
    );
  }
});

[
  "placeTroop",
  "removeTroop",
  "activateTroopSpecial",
  "startWave",
  "selectDecision",
  "selectAdaptiveAidOption",
  "setEnergyPickupPointer",
].forEach((marker) => {
  if (!actions.includes(marker)) {
    errors.push(
      `Executor de IA não usa a ação real ${marker}.`,
    );
  }
});

[
  "planPlacementActions",
  "planReplacementActions",
  "planSpecialActions",
  "planDecision",
  "calculateWaveReadiness",
].forEach((marker) => {
  if (!agent.includes(marker)) {
    errors.push(
      `Agente estratégico não usa ${marker}.`,
    );
  }
});

if (
  !observation.includes(
    "createLaneThreatMap",
  )
  || !observation.includes(
    "getSnapshot",
  )
) {
  errors.push(
    "Observação não utiliza mapa de ameaça e snapshot real.",
  );
}

if (
  !laneThreat.includes(
    "enemyThreat",
  )
  || !laneThreat.includes(
    "estimateTroopDps",
  )
) {
  errors.push(
    "Mapa de ameaça não considera ameaça inimiga e capacidade das tropas.",
  );
}

if (
  !loadout.includes(
    "getUnlockedTroops",
  )
  || !loadout.includes(
    "generateLoadoutCandidates",
  )
) {
  errors.push(
    "Planejador de loadout não respeita desbloqueio ou candidatos.",
  );
}

if (
  !placement.includes(
    "canPlaceTroop",
  )
  || !placement.includes(
    "calculateEnergyReserve",
  )
) {
  errors.push(
    "Planejador não valida células ou reserva energética.",
  );
}

if (
  !optimizer.includes(
    "mutateGenome",
  )
  || !optimizer.includes(
    "crossover",
  )
  || !optimizer.includes(
    "runBattleSimulation",
  )
  || !optimizer.includes(
    "SimulationCache",
  )
) {
  errors.push(
    "Otimizador evolutivo incompleto.",
  );
}

if (
  !cache.includes(
    "createSimulationCacheKey",
  )
  || !cache.includes(
    "class SimulationCache",
  )
) {
  errors.push(
    "Cache determinístico do otimizador ausente.",
  );
}

if (
  !validation.includes(
    "Number.isFinite",
  )
  || !validation.includes(
    "ID duplicado",
  )
  || !validation.includes(
    "StagnationDetector",
  )
) {
  errors.push(
    "Validação não cobre estado finito, IDs e estagnação.",
  );
}

if (
  !campaignScript.includes("PHASES")
  || !campaignScript.includes("Worker")
  || !campaignScript.includes(
    "campaign-simulation.json",
  )
) {
  errors.push(
    "Script da campanha não percorre fases, workers e relatório.",
  );
}

if (
  !phaseScript.includes(
    "runBattleSimulation",
  )
  || !phaseScript.includes(
    "optimizePhaseStrategy",
  )
) {
  errors.push(
    "Script de fase não suporta execução e otimização.",
  );
}

if (
  !optimizeCampaignScript.includes(
    "phase-strategies.json",
  )
  || !optimizeCampaignScript.includes(
    "optimizePhaseStrategy",
  )
) {
  errors.push(
    "Otimizador da campanha não gera estratégias por fase.",
  );
}

if (
  !report.includes(
    "reportToCsv",
  )
  || !report.includes(
    "reportToMarkdown",
  )
  || !report.includes(
    "buildSimulationReport",
  )
) {
  errors.push(
    "Relatório não possui JSON, CSV e Markdown.",
  );
}

const packageSource = read("package.json");

if (packageSource) {
  const packageJson = JSON.parse(
    packageSource,
  );

  const requiredScripts = [
    "simulate:phase",
    "simulate:campaign",
    "simulate:campaign:quick",
    "optimize:phase",
    "optimize:campaign",
    "verify:simulation",
    "verify:simulation:report",
    "verify:simulation:report:strict",
    "diagnose:simulation",
    "test:simulation",
    "test:simulation:smoke",
  ];

  requiredScripts.forEach((script) => {
    if (!packageJson.scripts?.[script]) {
      errors.push(
        `Script ausente no package.json: ${script}`,
      );
    }
  });

  if (
    !packageJson.scripts?.ci?.includes(
      "verify:simulation",
    )
  ) {
    errors.push(
      "verify:simulation não está integrado ao CI.",
    );
  }

  if (
    packageJson.scripts?.ci?.includes(
      "simulate:campaign",
    )
  ) {
    errors.push(
      "A simulação completa não deve executar no CI padrão.",
    );
  }
}

if (errors.length) {
  console.error(
    `Contrato do simulador inválido: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else {
  console.log(
    "Simulador headless, IA, otimização e relatórios validados.",
  );
}
