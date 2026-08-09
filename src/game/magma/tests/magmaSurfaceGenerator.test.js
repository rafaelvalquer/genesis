import { describe, expect, it } from "vitest";
import { buildMagmaRegions } from "../magmaRegionBuilder.js";
import {
  buildMajorChannels,
  calibrateMagmaCrustThreshold,
  getChannelPoint,
  sampleMagmaField,
} from "../magmaSurfaceGenerator.js";
import { MAGMA_VISUAL_CONFIG } from "../magmaVisualConfig.js";

const cells = [2, 3].flatMap((row) => Array.from({ length: 9 }, (_, col) => [row, col + 1]));

function fixture(seed = 4242) {
  const region = buildMagmaRegions(cells, { seed })[0];
  const channels = buildMajorChannels(region, 4, region.seed);
  const calibratedCrustThreshold = calibrateMagmaCrustThreshold(region, channels, MAGMA_VISUAL_CONFIG);
  return { region, channels, config: { ...MAGMA_VISUAL_CONFIG, calibratedCrustThreshold } };
}

function sampleAt(data, x, y, time = 0, thermalState = "stable") {
  return sampleMagmaField({
    worldX: x,
    worldY: y,
    localX: x - data.region.bounds.x,
    localY: y - data.region.bounds.y,
    region: data.region,
    channels: data.channels,
    time,
    config: data.config,
    thermalState,
  });
}

describe("magmaSurfaceGenerator", () => {
  it("mantém o campo contínuo ao atravessar uma fronteira de coluna", () => {
    const data = fixture();
    const left = sampleAt(data, 499.9, 262);
    const right = sampleAt(data, 500.1, 262);
    expect(Math.abs(left.heat - right.heat)).toBeLessThan(0.015);
  });

  it("calibra crosta dominante próxima de 48% nas oito sementes do capítulo", () => {
    for (const seed of [4141, 4242, 4343, 4444, 4545, 4646, 4747, 4848]) {
      const data = fixture(seed);
      let crust = 0;
      let total = 0;
      for (let y = 205; y < 400; y += 10) {
        for (let x = 105; x < 1000; x += 10) {
          total += 1;
          if (sampleAt(data, x, y).heat < 0.38) crust += 1;
        }
      }
      expect(crust / total).toBeGreaterThanOrEqual(0.44);
      expect(crust / total).toBeLessThanOrEqual(0.56);
    }
  });

  it("deforma o material ao longo do tempo sem substituir sua estrutura ancorada", () => {
    const data = fixture();
    const before = [
      sampleAt(data, 245, 252, 0).heat,
      sampleAt(data, 525, 338, 0).heat,
      sampleAt(data, 842, 279, 0).heat,
    ];
    const after = [
      sampleAt(data, 245, 252, 5).heat,
      sampleAt(data, 525, 338, 5).heat,
      sampleAt(data, 842, 279, 5).heat,
    ];
    const averageChange = before.reduce((sum, value, index) => sum + Math.abs(value - after[index]), 0) / before.length;
    expect(averageChange).toBeGreaterThan(0.0001);
    expect(averageChange).toBeLessThan(0.15);
  });

  it("move a camada líquida em dois segundos e preserva a crosta em cinco", () => {
    const data = fixture();
    let liquidChange = 0;
    let liquidSamples = 0;
    let preservedCrust = 0;
    let crustSamples = 0;

    for (let y = 205; y < 400; y += 10) {
      for (let x = 105; x < 1000; x += 10) {
        const initial = sampleAt(data, x, y, 0);
        if (initial.heat >= 0.46) {
          liquidChange += Math.abs(initial.heat - sampleAt(data, x, y, 2).heat);
          liquidSamples += 1;
        }
        if (initial.heat < 0.34) {
          if (sampleAt(data, x, y, 5).heat < 0.38) preservedCrust += 1;
          crustSamples += 1;
        }
      }
    }

    expect(liquidChange / liquidSamples).toBeGreaterThan(0.025);
    expect(preservedCrust / crustSamples).toBeGreaterThan(0.93);
  });

  it("gera quatro canais Bézier largos atravessando a região inteira", () => {
    const { region, channels } = fixture();
    expect(channels).toHaveLength(4);
    for (const channel of channels) {
      const start = getChannelPoint(channel, 0);
      const middle = getChannelPoint(channel, 0.5);
      const end = getChannelPoint(channel, 1);
      expect(start.x).toBeLessThan(0);
      expect(middle.x).toBeGreaterThan(0);
      expect(end.x).toBeGreaterThan(region.bounds.width);
      expect(channel.radius * 2).toBeGreaterThanOrEqual(15);
      expect(channel.radius * 2).toBeLessThanOrEqual(45);
    }
  });

  it("a erupção aumenta a fração líquida aparente", () => {
    const data = fixture();
    let stableCrust = 0;
    let eruptionCrust = 0;
    for (let y = 215; y < 395; y += 20) {
      for (let x = 115; x < 995; x += 20) {
        if (sampleAt(data, x, y, 2, "stable").heat < 0.38) stableCrust += 1;
        if (sampleAt(data, x, y, 2, "eruption").heat < 0.38) eruptionCrust += 1;
      }
    }
    expect(eruptionCrust).toBeLessThan(stableCrust);
  });
});
