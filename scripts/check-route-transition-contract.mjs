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

  return fs.readFileSync(filePath, "utf8");
}

const app = read("src/App.jsx");
const campaign = read(
  "src/campaign/CampaignPage.jsx",
);
const missionPanel = read(
  "src/campaign/MissionPanel.jsx",
);
const loadout = read(
  "src/loadout/LoadoutPage.jsx",
);
const troopStage = read(
  "src/loadout/TroopStage.jsx",
);
const provider = read(
  "src/routing/RouteTransitionProvider.jsx",
);
const machine = read(
  "src/routing/routeTransitionMachine.js",
);
const modules = read(
  "src/routing/routeModules.js",
);
const departure = read(
  "src/campaign/campaignDepartureTransition.js",
);

if (
  !app.includes(
    "<BrowserRouter><RouteTransitionProvider><AppLayout>",
  )
) {
  errors.push(
    "RouteTransitionProvider não está dentro de BrowserRouter.",
  );
}

if (
  !app.includes(
    "const LoadoutPicker = lazy(loadLoadoutModule);",
  )
) {
  errors.push(
    "LoadoutPicker não usa o loader reutilizável.",
  );
}

if (
  !provider.includes(
    "activeRef.current",
  )
  || !provider.includes(
    "DESTINATION_TIMEOUT_MS",
  )
  || !provider.includes(
    "completeTransition",
  )
) {
  errors.push(
    "O coordenador não possui bloqueio, timeout e conclusão.",
  );
}

if (
  !machine.includes(
    "Math.max(",
  )
  || !machine.includes(
    "matchesRouteTransition",
  )
) {
  errors.push(
    "A máquina não protege progresso e identificação.",
  );
}

if (
  !modules.includes(
    "loadLoadoutModule.preload()",
  )
  || !modules.includes(
    'import("three")',
  )
) {
  errors.push(
    "A rota de loadout não possui preload completo.",
  );
}

if (
  !campaign.includes(
    'type: "campaign-to-loadout"',
  )
  || !campaign.includes(
    "playCampaignToLoadoutTransition",
  )
  || !campaign.includes(
    "preloadLoadoutRoute",
  )
) {
  errors.push(
    "CampaignPage não usa a transição coordenada.",
  );
}

if (
  campaign.includes(
    'onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}',
  )
) {
  errors.push(
    "CampaignPage ainda contém navegação direta antiga.",
  );
}

if (
  !departure.includes(
    "runtime?.killAuto?.()",
  )
  || !departure.includes(
    "runtime.killTransition",
  )
  || !departure.includes(
    "getCampaignDepartureCameraDistance",
  )
) {
  errors.push(
    "A saída GSAP não controla timelines e câmera.",
  );
}

if (
  !missionPanel.includes(
    "disabled={transitioning}",
  )
) {
  errors.push(
    "MissionPanel não bloqueia clique duplicado.",
  );
}

if (
  !loadout.includes(
    "onStageReady={handleStageReady}",
  )
  || !loadout.includes(
    "completeTransition",
  )
) {
  errors.push(
    "LoadoutPage não conclui a transição pelo palco.",
  );
}

if (
  !troopStage.includes(
    "onStageReady?.({",
  )
) {
  errors.push(
    "TroopStage não sinaliza prontidão.",
  );
}

const packageJsonSource = read("package.json");

if (packageJsonSource) {
  const packageJson = JSON.parse(
    packageJsonSource,
  );

  if (
    !packageJson.scripts?.[
      "verify:route-transitions"
    ]
  ) {
    errors.push(
      "verify:route-transitions ausente no package.json.",
    );
  }

  if (
    !packageJson.scripts?.ci?.includes(
      "verify:route-transitions",
    )
  ) {
    errors.push(
      "verify:route-transitions ausente no CI.",
    );
  }
}

if (errors.length) {
  console.error(
    `Contrato de transição inválido: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else {
  console.log(
    "Coordenador e transição Campanha → Loadout validados.",
  );
}
