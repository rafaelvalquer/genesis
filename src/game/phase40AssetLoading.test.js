import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  loadBattleAssets,
  releaseBattleAssets,
  resolveTroopFrame,
} from "./assets/battleAssetLoader.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

describe("carregamento real da defesa inicial da Fase 40", () => {
  it("carrega estados essenciais mesmo quando as tropas não estão no loadout", async () => {
    const assets = await loadBattleAssets(
      phase40(),
      ["marine"],
      () => {},
      { enemyIds: [], skipDefenses: true, assetConcurrency: 4 },
    );

    try {
      expect(assets.troops.bastiaoMare.idle.some(Boolean)).toBe(true);
      expect(assets.troops.bastiaoMare.attack.some(Boolean)).toBe(true);
      expect(assets.troops.fuzileiroVoltaico.attack.some(Boolean)).toBe(true);
      expect(resolveTroopFrame(
        assets.troops.fuzileiroVoltaico,
        "death",
        0,
      )).toBeTruthy();
      expect(assets.troops.medicaNanites.idle.some(Boolean)).toBe(true);
      expect(assets.troops.medicaNanites.heal.some(Boolean)).toBe(true);
      expect(assets.troops.medicaNanites.attack.some(Boolean)).toBe(true);
    } finally {
      releaseBattleAssets(assets);
    }
  });
});
