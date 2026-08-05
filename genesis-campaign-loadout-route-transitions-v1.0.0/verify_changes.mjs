#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

let failed = false;

function requireFile(
  relativePath,
  markers = [],
) {
  const filePath = path.join(
    repoRoot,
    relativePath,
  );

  if (!fs.existsSync(filePath)) {
    console.error(
      `[ERRO] Arquivo ausente: ${relativePath}`,
    );
    failed = true;
    return "";
  }

  const source = fs.readFileSync(
    filePath,
    "utf8",
  );

  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(
        `[ERRO] ${relativePath}: marcador ausente: ${marker}`,
      );
      failed = true;
    }
  }

  return source;
}

const app = requireFile(
  "src/App.jsx",
  [
    "RouteTransitionProvider",
    "lazy(loadLoadoutModule)",
  ],
);

const campaign = requireFile(
  "src/campaign/CampaignPage.jsx",
  [
    'type: "campaign-to-loadout"',
    "playCampaignToLoadoutTransition",
    "preloadLoadoutRoute",
    "prepareMission",
  ],
);

const missionPanel = requireFile(
  "src/campaign/MissionPanel.jsx",
  [
    "disabled={transitioning}",
    "ABRINDO BAIA TÁTICA",
  ],
);

const loadout = requireFile(
  "src/loadout/LoadoutPage.jsx",
  [
    "completeTransition",
    "onStageReady={handleStageReady}",
    "route-arrival-campaign",
  ],
);

const troopStage = requireFile(
  "src/loadout/TroopStage.jsx",
  [
    "onStageReady",
    "onStageReady?.({",
  ],
);

requireFile(
  "src/routing/RouteTransitionProvider.jsx",
  [
    "DESTINATION_TIMEOUT_MS",
    "activeRef.current",
    "RouteTransitionLayer",
  ],
);

requireFile(
  "src/routing/RouteTransitionLayer.jsx",
);

requireFile(
  "src/routing/routeTransitionMachine.js",
  [
    "matchesRouteTransition",
    "Math.max(",
  ],
);

requireFile(
  "src/routing/routeModules.js",
  [
    "loadLoadoutModule.preload()",
    'import("three")',
  ],
);

requireFile(
  "src/routing/route-transitions.css",
  [
    ".route-transition-layer",
    ".loadout-page.route-arrival-campaign",
  ],
);

requireFile(
  "src/campaign/campaignDepartureTransition.js",
  [
    "runtime?.killAuto?.()",
    "runtime.killTransition",
    "getCampaignDepartureCameraDistance",
  ],
);

requireFile(
  "scripts/check-route-transition-contract.mjs",
);

if (
  app.includes(
    'const LoadoutPicker = lazy(() => import("./loadout/LoadoutPage.jsx"));',
  )
) {
  console.error(
    "[ERRO] Loader lazy antigo do Loadout ainda presente.",
  );
  failed = true;
}

if (
  campaign.includes(
    'onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}',
  )
) {
  console.error(
    "[ERRO] Navegação direta antiga da Campanha ainda presente.",
  );
  failed = true;
}

const providerOpenCount = (
  app.match(
    /<RouteTransitionProvider>/g,
  ) || []
).length;

const providerCloseCount = (
  app.match(
    /<\/RouteTransitionProvider>/g,
  ) || []
).length;

if (
  providerOpenCount !== 1
  || providerCloseCount !== 1
) {
  console.error(
    "[ERRO] RouteTransitionProvider deve envolver o app exatamente uma vez.",
  );
  failed = true;
}

const stageReadyCount = (
  troopStage.match(
    /onStageReady\?\.\(\{/g,
  ) || []
).length;

if (stageReadyCount !== 1) {
  console.error(
    "[ERRO] TroopStage deve sinalizar prontidão exatamente uma vez.",
  );
  failed = true;
}

const packageJson = JSON.parse(
  requireFile("package.json"),
);

if (
  !packageJson.scripts?.[
    "verify:route-transitions"
  ]
) {
  console.error(
    "[ERRO] verify:route-transitions ausente no package.json.",
  );
  failed = true;
}

if (
  !packageJson.scripts?.ci?.includes(
    "verify:route-transitions",
  )
) {
  console.error(
    "[ERRO] verify:route-transitions ausente no CI.",
  );
  failed = true;
}

if (!failed) {
  const checker = path.join(
    repoRoot,
    "scripts",
    "check-route-transition-contract.mjs",
  );

  const result = spawnSync(
    process.execPath,
    [checker, repoRoot],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    process.stdout.write(
      result.stdout || "",
    );
    process.stderr.write(
      result.stderr || "",
    );
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Verificação estrutural da transição concluída com sucesso.",
  );
}
