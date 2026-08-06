import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const repoRoot = process.cwd();

function source(relativePath) {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

describe("contrato do planeta com todos os capítulos", () => {
  it("usa todas as fases na CampaignPage", () => {
    const page = source(
      "src/campaign/CampaignPage.jsx",
    );

    expect(page).toContain(
      "resolveCampaignSelection",
    );

    expect(page).toContain(
      "createPhaseSelectionParams",
    );

    expect(page).toContain(
      "chapters={CHAPTERS}",
    );

    expect(page).toContain(
      'data-all-chapters-visible="true"',
    );
  });

  it("não limpa e recria as rotas ao trocar capítulo", () => {
    const planet = source(
      "src/campaign/CampaignPlanet.jsx",
    );

    expect(planet).toContain(
      "initializeCampaignChapterVisuals",
    );

    expect(planet).toContain(
      "updateCampaignChapterVisuals",
    );

    expect(planet).not.toContain(
      "markerVectors.clear();\n    while (routeGroup.children.length)",
    );
  });

  it("mantém efeitos inativos visíveis", () => {
    const effects = source(
      "src/visual/createGenesisChapterEffects.js",
    );

    expect(effects).toContain(
      "persistentChapters",
    );

    expect(effects).toContain(
      "runtime.inactiveOpacity",
    );

    expect(effects).toContain(
      "runtime.lockedOpacity",
    );
  });

  it("mantém a transição Campanha para Loadout compatível", () => {
    const departure = source(
      "src/campaign/campaignDepartureTransition.js",
    );

    expect(departure).toContain(
      "getCampaignRouteMaterials",
    );
  });
});
