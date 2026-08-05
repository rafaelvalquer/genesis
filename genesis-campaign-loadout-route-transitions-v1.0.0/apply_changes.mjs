#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(
  fileURLToPath(import.meta.url),
);
const payloadRoot = path.join(
  packageRoot,
  "payload",
);
const repoRoot = path.resolve(
  process.argv[2] || process.cwd(),
);

class PatchError extends Error {}

function read(relativePath) {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

function write(relativePath, content) {
  const target = path.join(
    repoRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );
}

function copyPayload(relativePath) {
  const source = path.join(
    payloadRoot,
    relativePath,
  );

  const destination = path.join(
    repoRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(
    source,
    destination,
  );
}

function replaceOnce(
  source,
  search,
  replacement,
  label,
) {
  if (source.includes(replacement)) {
    return source;
  }

  const occurrences = (
    source.split(search).length - 1
  );

  if (occurrences !== 1) {
    throw new PatchError(
      `${label}: esperado 1 marcador, encontrado ${occurrences}.`,
    );
  }

  return source.replace(
    search,
    replacement,
  );
}

function patchApp() {
  const relativePath = "src/App.jsx";
  let source = read(relativePath);

  const retryableImport = (
    'import { createRetryableLazyModule } from "./routing/retryableLazyModule.js";'
  );

  const transitionImports = (
    `${retryableImport}\n`
    + 'import { RouteTransitionProvider } from "./routing/RouteTransitionProvider.jsx";\n'
    + 'import { loadLoadoutModule } from "./routing/routeModules.js";'
  );

  source = replaceOnce(
    source,
    retryableImport,
    transitionImports,
    "App/imports do coordenador",
  );

  source = replaceOnce(
    source,
    'const LoadoutPicker = lazy(() => import("./loadout/LoadoutPage.jsx"));',
    "const LoadoutPicker = lazy(loadLoadoutModule);",
    "App/loader do loadout",
  );

  source = replaceOnce(
    source,
    "return <BrowserRouter><AppLayout>",
    "return <BrowserRouter><RouteTransitionProvider><AppLayout>",
    "App/abertura do provider",
  );

  source = replaceOnce(
    source,
    "</AppLayout></BrowserRouter>;",
    "</AppLayout></RouteTransitionProvider></BrowserRouter>;",
    "App/fechamento do provider",
  );

  write(relativePath, source);
}

function patchCampaignPage() {
  const relativePath = (
    "src/campaign/CampaignPage.jsx"
  );

  let source = read(relativePath);

  source = replaceOnce(
    source,
    'import { useNavigate, useSearchParams } from "react-router-dom";',
    'import { useSearchParams } from "react-router-dom";',
    "CampaignPage/import do router",
  );

  const arenaImport = (
    'import { getArenaUrl } from "../game/assets/arenaCatalog.js";'
  );

  const campaignTransitionImports = (
    `${arenaImport}\n`
    + 'import { preloadLoadoutRoute } from "../routing/routeModules.js";\n'
    + 'import { useRouteTransition } from "../routing/RouteTransitionProvider.jsx";\n'
    + 'import {\n'
    + '  getCampaignTransitionOrigin,\n'
    + '  playCampaignToLoadoutTransition,\n'
    + '} from "./campaignDepartureTransition.js";'
  );

  source = replaceOnce(
    source,
    arenaImport,
    campaignTransitionImports,
    "CampaignPage/imports da transição",
  );

  const refsAndNavigate = `  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();`;

  const refsAndTransition = `  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const {
    isTransitioning,
    transition,
    transitionTo,
  } = useRouteTransition();
  const [searchParams, setSearchParams] = useSearchParams();`;

  source = replaceOnce(
    source,
    refsAndNavigate,
    refsAndTransition,
    "CampaignPage/coordenador",
  );

  const campaignAnimationsCall = `  useCampaignAnimations({
    scope: rootRef,
    runtime,
    chapter: activeChapter,
    selectedPhase,
    reduceMotion: quality.reduceMotion,
    sceneReady,
  });`;

  const campaignAnimationsAndPreload = `${campaignAnimationsCall}

  useEffect(() => {
    if (!selectedPhase) return undefined;

    const controller = new AbortController();

    preloadLoadoutRoute({
      arenaUrl: getArenaUrl(selectedPhase.arenaId),
      signal: controller.signal,
    }).catch((error) => {
      if (error?.name !== "AbortError") {
        console.warn(
          "Preload do loadout não foi concluído.",
          error,
        );
      }
    });

    return () => controller.abort();
  }, [selectedPhase?.arenaId]);`;

  source = replaceOnce(
    source,
    campaignAnimationsCall,
    campaignAnimationsAndPreload,
    "CampaignPage/preload por seleção",
  );

  const biomeDeclaration = `  const biome = getCampaignBiome(activeChapter.id);

  return <main`;

  const prepareAndBiome = `  const campaignTransitioning = (
    isTransitioning
    && transition.type === "campaign-to-loadout"
  );

  const prepareMission = () => {
    if (
      !selectedPhase
      || campaignTransitioning
    ) {
      return;
    }

    const arenaUrl = getArenaUrl(
      selectedPhase.arenaId,
    );

    const origin = (
      getCampaignTransitionOrigin(
        rootRef.current,
      )
    );

    transitionTo({
      type: "campaign-to-loadout",
      to: \`/jogar/\${selectedPhase.id}\`,
      reduceMotion: quality.reduceMotion,
      payload: {
        phaseId: selectedPhase.id,
        chapterId: activeChapter.id,
        label: selectedPhase.name,
        arenaUrl,
        primary: (
          selectedPhase.palette?.primary
          || activeChapter.palette.primary
        ),
        accent: (
          selectedPhase.palette?.accent
          || activeChapter.palette.accent
        ),
        ...origin,
      },
      preload: ({ signal }) => (
        preloadLoadoutRoute({
          arenaUrl,
          signal,
        })
      ),
      exit: ({
        signal,
        updateProgress,
      }) => (
        playCampaignToLoadoutTransition({
          runtime,
          root: rootRef.current,
          phase: selectedPhase,
          reduceMotion: quality.reduceMotion,
          signal,
          updateProgress,
        })
      ),
    });
  };

  const biome = getCampaignBiome(activeChapter.id);

  return <main`;

  source = replaceOnce(
    source,
    biomeDeclaration,
    prepareAndBiome,
    "CampaignPage/prepareMission",
  );

  source = replaceOnce(
    source,
    'className={`campaign-map campaign-biome-${biome.key}`}',
    'className={`campaign-map campaign-biome-${biome.key} ${campaignTransitioning ? "is-route-transitioning" : ""}`}',
    "CampaignPage/classe da transição",
  );

  source = replaceOnce(
    source,
    '    data-world-signature={biome.planetEffects.signature}\n',
    '    data-world-signature={biome.planetEffects.signature}\n    aria-busy={campaignTransitioning}\n',
    "CampaignPage/aria-busy",
  );

  source = replaceOnce(
    source,
    '          onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}\n',
    '          onPrepare={prepareMission}\n          transitioning={campaignTransitioning}\n',
    "CampaignPage/ação de preparação",
  );

  write(relativePath, source);
}

function patchMissionPanel() {
  const relativePath = (
    "src/campaign/MissionPanel.jsx"
  );

  let source = read(relativePath);

  source = replaceOnce(
    source,
    "export default function MissionPanel({ phase, chapter, stats, onPrepare, reduceMotion }) {",
    "export default function MissionPanel({ phase, chapter, stats, onPrepare, reduceMotion, transitioning = false }) {",
    "MissionPanel/assinatura",
  );

  source = replaceOnce(
    source,
    '          className="prepare-operation"\n          onClick={onPrepare}\n',
    '          className={`prepare-operation ${transitioning ? "is-transitioning" : ""}`}\n          onClick={onPrepare}\n          disabled={transitioning}\n          aria-busy={transitioning}\n',
    "MissionPanel/botão bloqueado",
  );

  source = replaceOnce(
    source,
    '        >PREPARAR OPERAÇÃO <span>→</span></motion.button>',
    '        >{transitioning ? "ABRINDO BAIA TÁTICA" : "PREPARAR OPERAÇÃO"} <span>→</span></motion.button>',
    "MissionPanel/rótulo da transição",
  );

  write(relativePath, source);
}

function patchLoadoutPage() {
  const relativePath = (
    "src/loadout/LoadoutPage.jsx"
  );

  let source = read(relativePath);

  const settingsImport = (
    'import { loadSettings } from "../campaign/storage.js";'
  );

  source = replaceOnce(
    source,
    settingsImport,
    `${settingsImport}\nimport { useRouteTransition } from "../routing/RouteTransitionProvider.jsx";`,
    "LoadoutPage/import do coordenador",
  );

  const qualityDeclaration = (
    "  const quality = useLoadoutQuality(settings);\n"
  );

  const qualityAndTransition = `  const quality = useLoadoutQuality(settings);
  const {
    completeTransition,
    matchesTransition,
  } = useRouteTransition();
  const arrivingFromCampaign = (
    matchesTransition({
      type: "campaign-to-loadout",
      phaseId: phase.id,
    })
  );
`;

  source = replaceOnce(
    source,
    qualityDeclaration,
    qualityAndTransition,
    "LoadoutPage/estado de chegada",
  );

  const closeInfo = (
    '  const closeInfo = useCallback(() => setInfoTroop(null), []);\n'
  );

  const closeInfoAndReady = `${closeInfo}
  const handleStageReady = useCallback(() => {
    if (
      !matchesTransition({
        type: "campaign-to-loadout",
        phaseId: phase.id,
      })
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        completeTransition();
      });
    });
  }, [
    completeTransition,
    matchesTransition,
    phase.id,
  ]);
`;

  source = replaceOnce(
    source,
    closeInfo,
    closeInfoAndReady,
    "LoadoutPage/prontidão da entrada",
  );

  source = replaceOnce(
    source,
    'className={`loadout-page loadout-bay chapter-${chapter.number} ${quality.reduceMotion ? "loadout-reduce-motion" : ""}`}',
    'className={`loadout-page loadout-bay chapter-${chapter.number} ${quality.reduceMotion ? "loadout-reduce-motion" : ""} ${arrivingFromCampaign ? "route-arrival-campaign" : ""}`}',
    "LoadoutPage/classe de chegada",
  );

  source = replaceOnce(
    source,
    '        onRuntimeReady={setRuntime}\n',
    '        onRuntimeReady={setRuntime}\n        onStageReady={handleStageReady}\n',
    "LoadoutPage/prontidão do palco",
  );

  write(relativePath, source);
}

function patchTroopStage() {
  const relativePath = (
    "src/loadout/TroopStage.jsx"
  );

  let source = read(relativePath);

  source = replaceOnce(
    source,
    `  arenaUrl,
  onRuntimeReady,
}) {`,
    `  arenaUrl,
  onRuntimeReady,
  onStageReady,
}) {`,
    "TroopStage/prop onStageReady",
  );

  source = replaceOnce(
    source,
    `      if (nextRuntime) {
        nextRuntime.setCharacterBounds?.(
          normalizedBounds,
        );
        onRuntimeReady?.(nextRuntime);
      }
    });`,
    `      if (nextRuntime) {
        nextRuntime.setCharacterBounds?.(
          normalizedBounds,
        );
        onRuntimeReady?.(nextRuntime);
      }

      onStageReady?.({
        runtime: nextRuntime,
        failed: !nextRuntime,
      });
    });`,
    "TroopStage/sinal de prontidão",
  );

  write(relativePath, source);
}

function patchPackageJson() {
  const packageJson = JSON.parse(
    read("package.json"),
  );

  packageJson.scripts ||= {};

  packageJson.scripts[
    "verify:route-transitions"
  ] = (
    "node scripts/check-route-transition-contract.mjs"
  );

  const ci = packageJson.scripts.ci || "";

  if (
    ci
    && !ci.includes(
      "verify:route-transitions",
    )
  ) {
    if (
      ci.includes(
        "npm run verify:play-route",
      )
    ) {
      packageJson.scripts.ci = ci.replace(
        "npm run verify:play-route",
        "npm run verify:play-route && npm run verify:route-transitions",
      );
    } else if (ci.includes("npm run test")) {
      packageJson.scripts.ci = ci.replace(
        "npm run test",
        "npm run verify:route-transitions && npm run test",
      );
    } else {
      packageJson.scripts.ci = (
        `npm run verify:route-transitions && ${ci}`
      );
    }
  }

  write(
    "package.json",
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
}

function assertRepository() {
  const required = [
    "package.json",
    "src/App.jsx",
    "src/campaign/CampaignPage.jsx",
    "src/campaign/MissionPanel.jsx",
    "src/loadout/LoadoutPage.jsx",
    "src/loadout/TroopStage.jsx",
    "src/routing/retryableLazyModule.js",
  ];

  const missing = required.filter(
    (relativePath) => !fs.existsSync(
      path.join(repoRoot, relativePath),
    ),
  );

  if (missing.length) {
    throw new PatchError(
      "Estrutura esperada não encontrada:\n"
      + missing.join("\n"),
    );
  }
}

function main() {
  assertRepository();

  const payloadFiles = [
    "src/routing/routeTransitionMachine.js",
    "src/routing/routeModules.js",
    "src/routing/RouteTransitionLayer.jsx",
    "src/routing/RouteTransitionProvider.jsx",
    "src/routing/route-transitions.css",
    "src/campaign/campaignDepartureTransition.js",
    "src/routing/routeTransitionMachine.test.js",
    "src/campaign/campaignDepartureTransition.test.js",
    "src/routing/routeTransitionContract.test.js",
    "scripts/check-route-transition-contract.mjs",
  ];

  payloadFiles.forEach(copyPayload);

  patchApp();
  patchCampaignPage();
  patchMissionPanel();
  patchLoadoutPage();
  patchTroopStage();
  patchPackageJson();

  console.log("Transição Campanha → Loadout aplicada:");
  console.log("- coordenador global de transições instalado");
  console.log("- preload compartilhado do módulo de loadout");
  console.log("- zoom GSAP no ponto da missão");
  console.log("- overlay orbital persistente entre as rotas");
  console.log("- entrada da baia sincronizada com o palco");
  console.log("- timeout, bloqueio de clique duplo e reduceMotion");
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
