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

describe("contrato da transição Campanha para Loadout", () => {
  it("instala o provider dentro do BrowserRouter", () => {
    const app = source("src/App.jsx");

    expect(app).toContain(
      "<BrowserRouter><RouteTransitionProvider><AppLayout>",
    );

    expect(app).toContain(
      "const LoadoutPicker = lazy(loadLoadoutModule);",
    );
  });

  it("substitui a navegação direta pela transição coordenada", () => {
    const campaign = source(
      "src/campaign/CampaignPage.jsx",
    );

    expect(campaign).toContain(
      'type: "campaign-to-loadout"',
    );

    expect(campaign).toContain(
      "playCampaignToLoadoutTransition",
    );

    expect(campaign).toContain(
      "preloadLoadoutRoute",
    );

    expect(campaign).not.toContain(
      'onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}',
    );
  });

  it("só revela o loadout quando o palco sinaliza prontidão", () => {
    const loadout = source(
      "src/loadout/LoadoutPage.jsx",
    );

    const stage = source(
      "src/loadout/TroopStage.jsx",
    );

    expect(loadout).toContain(
      "completeTransition",
    );

    expect(loadout).toContain(
      "onStageReady={handleStageReady}",
    );

    expect(stage).toContain(
      "onStageReady?.({",
    );
  });

  it("impede confirmações duplicadas durante a saída", () => {
    const missionPanel = source(
      "src/campaign/MissionPanel.jsx",
    );

    expect(missionPanel).toContain(
      "disabled={transitioning}",
    );

    expect(missionPanel).toContain(
      "ABRINDO BAIA TÁTICA",
    );
  });
});
