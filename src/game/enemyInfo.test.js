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
    expect(getEnemyUnlockAt("silicaDigger")).toBe(0);
  });

  it("detalha ataques à distância e unidades flutuantes", () => {
    expect(values("magoAbissal").Alcance).toBe("4,5 células");
    expect(values("refrator").Alcance).toBe("4 células");
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

  it("detalha o impulso do Escavador de Sílica", () => {
    expect(getEnemyInfo(ENEMIES.silicaDigger).specials).toEqual([
      { label: "Impulso de enxame", value: "Com 3+ no mesmo tile: +25% de velocidade" },
    ]);
  });

  it("detalha o Grito da Ninhada do Rasga-Dunas", () => {
    expect(getEnemyUnlockAt("duneRipper", ENEMIES.duneRipper)).toBe(16);
    expect(getEnemyInfo(ENEMIES.duneRipper).specials).toEqual([
      {
        label: "Grito da Ninhada",
        value: "Até 3 Escavadores a cada 8 s; máximo de 6 vivos",
      },
    ]);
  });

  it("detalha a investida e a recuperação do Besouro-Aríete", () => {
    expect(getEnemyUnlockAt("ramBeetle", ENEMIES.ramBeetle)).toBe(16);
    expect(getEnemyInfo(ENEMIES.ramBeetle).specials).toEqual([
      { label: "Investida inicial", value: "55 de dano após 0,65 s" },
      { label: "Recuperação", value: "2 s sem se mover ou atacar" },
      { label: "Ataque normal", value: "12 de dano a cada 2,2 s" },
    ]);
  });
});
