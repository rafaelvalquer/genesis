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

const page = read(
  "src/campaign/CampaignPage.jsx",
);

const planet = read(
  "src/campaign/CampaignPlanet.jsx",
);

const marker = read(
  "src/campaign/PhaseMarker.jsx",
);

const effects = read(
  "src/visual/createGenesisChapterEffects.js",
);

const animations = read(
  "src/campaign/useCampaignAnimations.js",
);

const fallback = read(
  "src/campaign/CampaignWebGLFallback.jsx",
);

const departure = read(
  "src/campaign/campaignDepartureTransition.js",
);

const css = read(
  "src/campaign/campaign-map.css",
);

const selection = read(
  "src/campaign/campaignSelection.js",
);

const visuals = read(
  "src/campaign/campaignChapterVisuals.js",
);

if (
  !page.includes(
    "resolveCampaignSelection",
  )
  || !page.includes(
    "createPhaseSelectionParams",
  )
) {
  errors.push(
    "CampaignPage não usa a seleção global e atômica.",
  );
}

if (
  !/<CampaignWebGLFallback[\s\S]*?chapters=\{CHAPTERS\}[\s\S]*?\/>/
    .test(page)
) {
  errors.push(
    "CampaignWebGLFallback não recebe chapters={CHAPTERS}.",
  );
}

if (
  !/<CampaignPlanet[\s\S]*?chapters=\{CHAPTERS\}[\s\S]*?\/>/
    .test(page)
) {
  errors.push(
    "CampaignPlanet não recebe chapters={CHAPTERS}.",
  );
}

if (
  !page.includes(
    'data-all-chapters-visible="true"',
  )
) {
  errors.push(
    "CampaignPage não declara o contrato visual multicapítulo.",
  );
}

if (
  !selection.includes(
    "requestedPhaseChapter",
  )
  || !selection.includes(
    "phases: PHASES",
  )
) {
  errors.push(
    "A fase selecionada não é a fonte de verdade do capítulo.",
  );
}

if (
  !planet.includes(
    "initializeCampaignChapterVisuals",
  )
  || !planet.includes(
    "updateCampaignChapterVisuals",
  )
  || !planet.includes(
    "persistentChapters: true",
  )
) {
  errors.push(
    "CampaignPlanet não mantém capítulos e efeitos persistentes.",
  );
}

if (
  planet.includes(
    "markerVectors.clear();\n    while (routeGroup.children.length)",
  )
) {
  errors.push(
    "CampaignPlanet ainda destrói as rotas ao trocar capítulo.",
  );
}

if (
  !marker.includes(
    "is-chapter-inactive",
  )
  || !marker.includes(
    "data-chapter-active",
  )
) {
  errors.push(
    "PhaseMarker não diferencia capítulo ativo e inativo.",
  );
}

if (
  !effects.includes(
    "persistentChapters",
  )
  || !effects.includes(
    "runtime.inactiveOpacity",
  )
  || !effects.includes(
    "runtime.lockedOpacity",
  )
) {
  errors.push(
    "Os efeitos de capítulos inativos podem voltar a desaparecer.",
  );
}

if (
  animations.includes(
    "runtime.routeGroup.children.map",
  )
) {
  errors.push(
    "useCampaignAnimations ainda assume rotas planas por capítulo.",
  );
}

if (
  !fallback.includes(
    "campaign-fallback-all-chapters",
  )
  || !fallback.includes(
    "getChapterForPhase",
  )
) {
  errors.push(
    "O fallback WebGL não mostra todos os capítulos.",
  );
}

if (
  !departure.includes(
    "getCampaignRouteMaterials",
  )
) {
  errors.push(
    "A transição para Loadout não suporta grupos persistentes de rotas.",
  );
}

if (
  !css.includes(
    "GENESIS_ALL_CHAPTERS_VISIBLE_V1",
  )
  || !css.includes(
    '[data-chapter-active="false"]',
  )
) {
  errors.push(
    "Os estados escurecidos não foram adicionados ao CSS.",
  );
}

if (
  !visuals.includes(
    "CAMPAIGN_CHAPTER_VISUAL_PROFILES",
  )
  || !visuals.includes(
    "campaignTargetOpacity",
  )
  || !visuals.includes(
    "runtime.transitioning",
  )
) {
  errors.push(
    "O registro visual não protege perfis, transição e interpolação.",
  );
}

const packageJsonSource = read(
  "package.json",
);

if (packageJsonSource) {
  const packageJson = JSON.parse(
    packageJsonSource,
  );

  if (
    !packageJson.scripts?.[
      "verify:campaign-all-chapters"
    ]
  ) {
    errors.push(
      "verify:campaign-all-chapters ausente no package.json.",
    );
  }

  if (
    !packageJson.scripts?.ci?.includes(
      "verify:campaign-all-chapters",
    )
  ) {
    errors.push(
      "verify:campaign-all-chapters ausente no CI.",
    );
  }
}

if (errors.length) {
  console.error(
    `Contrato multicapítulo inválido: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else {
  console.log(
    "Todos os capítulos, fases, rotas e efeitos persistentes foram validados.",
  );
}
