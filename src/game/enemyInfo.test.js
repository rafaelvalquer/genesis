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
    expect(getEnemyUnlockAt("silicaDigger")).toBe(16);
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
        label: "Proteção de chegada",
        value: "Reduz 40% do dano recebido por 2 s",
      },
      {
        label: "Grito da Ninhada",
        value: "Até 4 Escavadores a cada 6,5 s; máximo de 8 vivos",
      },
    ]);
  });

  it("detalha a postura e a proteção inicial da Rainha Operária", () => {
    expect(getEnemyInfo(ENEMIES.workerQueen).specials).toEqual([
      { label: "Proteção de chegada", value: "Reduz 40% do dano recebido por 2 s" },
      { label: "Teia Inibidora", value: "1 de dano; reduz a cadência em 30% por 3 s" },
      { label: "Postura de ovos", value: "2 ovos a cada 8 s; eclosão em 3,5 s" },
      { label: "Limites da ninhada", value: "Até 4 ovos e 6 Escavadores vinculados" },
      { label: "Mordida da Matriarca", value: "3 de dano a cada 1,7 s no mesmo tile" },
    ]);
  });

  it("detalha a investida e a recuperação do Besouro-Aríete", () => {
    expect(getEnemyUnlockAt("ramBeetle", ENEMIES.ramBeetle)).toBe(18);
    expect(getEnemyInfo(ENEMIES.ramBeetle).specials).toEqual([
      { label: "Investida inicial", value: "55 de dano após 0,65 s" },
      { label: "Recuperação", value: "2 s sem se mover ou atacar" },
      { label: "Ataque normal", value: "12 de dano a cada 2,2 s" },
    ]);
  });

  it("detalha as três formas do Imperador Escaravelho", () => {
    expect(getEnemyUnlockAt("scarabEmperor", ENEMIES.scarabEmperor)).toBe(23);
    expect(getEnemyInfo(ENEMIES.scarabEmperor).specials).toEqual([
      { label: "Metamorfose irreversível", value: "Fase 2 em 65% de HP; fase 3 em 30% de HP" },
      { label: "Fase 1 · Carapaça Imperial", value: "16 de dano a cada 2,2 s; reduz 40% do dano frontal" },
      { label: "Fase 2 · Carapaça Rompida", value: "10 de dano a cada 1,5 s; recebe 15% mais dano" },
      { label: "Fase 3 · Predador Desencouraçado", value: "6 de dano a cada 0,65 s; recebe 30% mais dano" },
      { label: "Imunidade", value: "Não pode ser deslocado por empurrões" },
    ]);
  });
});
