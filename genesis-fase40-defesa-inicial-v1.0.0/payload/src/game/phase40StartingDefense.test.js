import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  canPlaceTroop,
  createBattleSession,
  getActiveTroopCount,
  placeTroop,
  removeTroop,
} from "./battleModel.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

describe("fase 40 — defesa inicial da missão", () => {
  it("declara cinco Bastiões na coluna 6 e cinco Fuzileiros na coluna 5", () => {
    const phase = phase40();
    expect(phase).toBeTruthy();
    expect(phase.startingTroops).toHaveLength(10);

    const bastioes = phase.startingTroops.filter((entry) => entry.type === "bastiaoMare");
    const fuzileiros = phase.startingTroops.filter((entry) => entry.type === "fuzileiroVoltaico");
    expect(bastioes).toEqual(Array.from({ length: 5 }, (_, row) => ({
      type: "bastiaoMare", row, col: 6,
    })));
    expect(fuzileiros).toEqual(Array.from({ length: 5 }, (_, row) => ({
      type: "fuzileiroVoltaico", row, col: 5,
    })));
  });

  it("cria a guarnição mesmo sem as tropas no loadout e preserva energia e Supply", () => {
    const phase = phase40();
    const session = createBattleSession(phase, ["marine"], 4040);

    expect(session.energy).toBe(phase.energy);
    expect(session.supply).toBe(phase.supplyLimit);
    expect(session.deployCooldowns).toEqual({});
    expect(session.deployed).toEqual({});
    expect(session.providedTroops).toEqual({ bastiaoMare: 5, fuzileiroVoltaico: 5 });
    expect(session.troops).toHaveLength(10);

    for (const troop of session.troops) {
      expect(troop).toMatchObject({
        missionProvided: true,
        providedByPhaseId: "fase_40",
        providedAtStart: true,
        lockedPlacement: true,
        refundable: false,
        energyCost: 0,
        supplyCost: 0,
      });
      expect(troop.hp).toBe(troop.maxHp);
    }
  });

  it("faz as tropas bônus contarem no limite de implantação", () => {
    const session = createBattleSession(
      phase40(),
      ["bastiaoMare", "fuzileiroVoltaico"],
      4040,
    );

    expect(getActiveTroopCount(session, "bastiaoMare")).toBe(5);
    expect(getActiveTroopCount(session, "fuzileiroVoltaico")).toBe(5);
    expect(canPlaceTroop(session, "bastiaoMare", 0, 3)).toContain("Limite de 5");
    expect(canPlaceTroop(session, "fuzileiroVoltaico", 0, 3)).toContain("Limite de 5");
  });

  it("não permite remover manualmente a defesa fornecida pela missão", () => {
    const phase = phase40();
    const session = createBattleSession(phase, ["marine"], 4040);
    const initialEnergy = session.energy;
    const initialSupply = session.supply;

    const result = removeTroop(session, 0, 6);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("defesa inicial da missão");
    expect(session.energy).toBe(initialEnergy);
    expect(session.supply).toBe(initialSupply);
    expect(session.troops).toHaveLength(10);
  });

  it("libera uma vaga após uma unidade morrer e cobra normalmente pela reposição escolhida", () => {
    const phase = phase40();
    const session = createBattleSession(phase, ["bastiaoMare"], 4040);
    const fallen = session.troops.find((troop) => troop.type === "bastiaoMare" && troop.row === 0);
    fallen.dead = true;
    fallen.hp = 0;

    const energyBefore = session.energy;
    const supplyBefore = session.supply;
    expect(canPlaceTroop(session, "bastiaoMare", 0, 3)).toBeNull();

    const result = placeTroop(session, "bastiaoMare", 0, 3);
    expect(result.ok).toBe(true);
    expect(result.troop.missionProvided).not.toBe(true);
    expect(session.energy).toBe(energyBefore - 28);
    expect(session.supply).toBe(supplyBefore - 8);
    expect(session.deployed.bastiaoMare).toBe(1);
    expect(getActiveTroopCount(session, "bastiaoMare")).toBe(5);
  });

  it("não altera as demais fases do capítulo 5", () => {
    const phase39 = CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_39");
    const session = createBattleSession(phase39, ["marine"], 3939);
    expect(phase39.startingTroops).toBeUndefined();
    expect(session.troops).toHaveLength(0);
    expect(session.providedTroops).toEqual({});
  });
});
