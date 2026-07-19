import { describe, expect, it } from "vitest";
import { ENEMIES } from "./content.js";
import { getEnemyInfo, getEnemyUnlockAt } from "./enemyInfo.js";

const values = (enemyId) => Object.fromEntries(getEnemyInfo(ENEMIES[enemyId]).stats.map((stat) => [stat.label, stat.value]));

describe("apresentação das informações dos inimigos", () => {
  it("formata os atributos básicos e a primeira aparição", () => {
    expect(values("medu")).toMatchObject({
      HP: "28",
      Dano: "5",
      Cadência: "A cada 1,3 s",
      Velocidade: "28 px/s",
      "Dano à base": "10",
      Alcance: "Corpo a corpo",
    });
    expect(getEnemyUnlockAt("medu")).toBe(0);
    expect(getEnemyUnlockAt("crisalio")).toBe(12);
  });

  it("detalha ataques à distância e unidades flutuantes", () => {
    expect(values("magoAbissal").Alcance).toBe("4,5 células");
    expect(getEnemyInfo(ENEMIES.magoAbissal).specials).toEqual([
      { label: "Locomoção", value: "Unidade flutuante" },
      { label: "Conjuração", value: "0,9 s antes do disparo" },
    ]);
  });

  it("detalha as habilidades do Parasita e do Crisálio", () => {
    expect(getEnemyInfo(ENEMIES.parasitaSaltador).specials).toEqual([
      { label: "Salto parasitário", value: "Salta em 0,72 s e se prende a uma tropa" },
      { label: "Interferência", value: "Reduz a velocidade de ataque da tropa em 35%" },
    ]);
    expect(getEnemyInfo(ENEMIES.crisalio).specials).toEqual([
      { label: "Manto prismático", value: "Renova escudos aliados a cada 7 s" },
      { label: "Escudo", value: "18 base + 12% do HP, limite 42" },
    ]);
  });
});
