import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";
import { getTroopInfo } from "./troopInfo.js";

const values = (troopId) => Object.fromEntries(getTroopInfo(TROOPS[troopId]).stats.map((stat) => [stat.label, stat.value]));

describe("apresentação das informações das tropas", () => {
  it.each([
    ["marine", 2000, "A cada 2 s"],
    ["caçador", 1420, "A cada 1,42 s"],
    ["sniper", 3000, "A cada 3 s"],
    ["krio", 1420, "A cada 1,42 s"],
    ["ranger", 1500, "A cada 1,5 s"],
    ["bombardeiro", 2300, "A cada 2,3 s"],
    ["artilheiraMorteiro", 3000, "A cada 3 s"],
    ["guarda", 1800, "A cada 1,8 s"],
  ])("apresenta a cadência rebalanceada de %s", (troopId, attackEveryMs, cadence) => {
    expect(TROOPS[troopId].attackEveryMs).toBe(attackEveryMs);
    expect(values(troopId).Cadência).toBe(cadence);
  });

  it("formata os atributos básicos e o ataque convencional", () => {
    expect(values("colono")).toMatchObject({
      HP: "34", Energia: "10", Supply: "3", Alcance: "0,9 células",
      Ataque: "Corpo a corpo", Dano: "8", Cadência: "A cada 1 s", Cooldown: "4 s",
    });
  });

  it("detalha rajada, pellets e dano contínuo", () => {
    expect(values("marine").Dano).toBe("4 por disparo");
    expect(getTroopInfo(TROOPS.marine).specials).toContainEqual({ label: "Rajada", value: "3 tiros · intervalo 0,12 s" });
    expect(values("caçador").Dano).toBe("5 por pellet");
    expect(getTroopInfo(TROOPS["caçador"]).specials).toContainEqual({ label: "Dispersão", value: "5 pellets por ataque" });
    expect(getTroopInfo(TROOPS["caçador"]).specials).toContainEqual({ label: "Cone da escopeta", value: "3 alvos · dano 11 / 7 / 4" });
    expect(values("incinerador")).toMatchObject({ Dano: "1 por tick", Cadência: "A cada 0,2 s" });
    expect(getTroopInfo(TROOPS.incinerador).specials).toContainEqual({ label: "Canalização", value: "Até 4 alvos simultâneos" });
  });

  it("substitui dano por produção no Reator", () => {
    expect(values("reator")).toMatchObject({ Ataque: "Geração de energia", Dano: "—", Cadência: "1 energia a cada 6 s" });
    expect(getTroopInfo(TROOPS.reator).specials).toEqual([
      { label: "Limite", value: "5 simultâneos" },
      { label: "Bônus de onda", value: "+8 energia" },
    ]);
  });

  it("indica corretamente que a Muralha não ataca", () => {
    expect(values("muralhaReforcada")).toMatchObject({ Ataque: "Não ataca", Dano: "—", Cadência: "Não ataca" });
  });

  it("detalha a mina e a defesa próxima da Demolidora", () => {
    expect(values("demolidora")).toMatchObject({
      HP: "20", Energia: "16", Supply: "5", Alcance: "3 células",
      Ataque: "Armadilha magnética", Dano: "36", Cadência: "A cada 8 s", Cooldown: "6 s",
    });
    expect(getTroopInfo(TROOPS.demolidora).specials).toEqual([
      { label: "Área de impacto", value: "58 px" },
      { label: "Campo minado", value: "Até 5 minas por Demolidora" },
      { label: "Defesa próxima", value: "2 de dano a cada 0,65 s · 2 células" },
    ]);
  });

  it("expõe a janela cega e o dano colateral do morteiro", () => {
    expect(values("artilheiraMorteiro")).toMatchObject({
      HP: "18", Energia: "22", Supply: "6", Alcance: "3–6 células",
      Ataque: "Morteiro indireto", Dano: "28", Cadência: "A cada 3 s", Cooldown: "7 s",
    });
    expect(getTroopInfo(TROOPS.artilheiraMorteiro).specials).toContainEqual({
      label: "Dano colateral",
      value: "30% nos demais inimigos do tile",
    });
  });

  it("informa o Corte de Arco do Vórtice nos protocolos especiais", () => {
    expect(getTroopInfo(TROOPS.executorArco).specials).toContainEqual({
      label: "Corte de Arco",
      value: "4 de dano a até 2 células · alvo único terrestre",
    });
  });
});
