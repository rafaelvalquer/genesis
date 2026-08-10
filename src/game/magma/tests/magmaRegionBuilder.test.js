import { describe, expect, it } from "vitest";
import { buildMagmaRegions } from "../magmaRegionBuilder.js";

const centralLake = [2, 3].flatMap((row) => Array.from({ length: 9 }, (_, col) => [row, col + 1]));

describe("magmaRegionBuilder", () => {
  it("converte as 18 células centrais das fases 42–44 em uma única região", () => {
    const [region] = buildMagmaRegions(centralLake, { seed: 4242 });
    expect(region.cells).toHaveLength(18);
    expect(region.bounds).toEqual({ x: 100, y: 200, width: 900, height: 200 });
    expect(region.edges).toHaveLength(22);
  });

  it("separa ilhas sem conexão ortogonal", () => {
    expect(buildMagmaRegions([[0, 0], [0, 1], [3, 7]])).toHaveLength(2);
  });

  it("não cria aresta visual entre duas células adjacentes", () => {
    const [region] = buildMagmaRegions([[2, 4], [2, 5]]);
    expect(region.edges.some((edge) => edge.row === 2 && edge.col === 4 && edge.direction === "east")).toBe(false);
    expect(region.edges.some((edge) => edge.row === 2 && edge.col === 5 && edge.direction === "west")).toBe(false);
  });

  it("keeps the artistic mask separate from logical cells", () => {
    const [region] = buildMagmaRegions([[2, 4], [2, 5]]);
    expect(region.visualMask).toMatchObject({ transitionWidth: 30, lowFrequencyAmplitude: 12 });
    expect(region.cellSet.has("2:4")).toBe(true);
    expect(region.cellSet.has("1:4")).toBe(false);
  });

  it("é determinístico independentemente da ordem de entrada", () => {
    const first = buildMagmaRegions(centralLake, { seed: 99 });
    const second = buildMagmaRegions([...centralLake].reverse(), { seed: 99 });
    expect(second).toEqual(first);
  });
});
