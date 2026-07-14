import { describe, expect, it } from "vitest";
import { createFireTrailParticles, createIceTrailParticles, pushEventParticles } from "./projectileRenderer.js";

describe("efeitos dos projeteis", () => {
  it("gera efeitos reproduziveis a partir da semente do evento", () => {
    const event = { type: "explosion", x: 300, y: 200, color: "#fb923c", seed: 77 };
    const first = pushEventParticles([], [event], 1000, { quality: "high" });
    const second = pushEventParticles([], [event], 1000, { quality: "high" });
    expect(second).toEqual(first);
  });

  it("reduz densidade e respeita o teto de particulas na qualidade baixa", () => {
    const events = Array.from({ length: 30 }, (_, index) => ({ type: "explosion", x: index * 10, y: 100, seed: index + 1 }));
    const low = pushEventParticles([], events, 0, { quality: "low" });
    const high = pushEventParticles([], events, 0, { quality: "high" });
    expect(low.length).toBeLessThan(high.length);
    expect(low.length).toBeLessThanOrEqual(140);
    expect(high.length).toBeLessThanOrEqual(440);
  });

  it("cria os emissores especializados das armas instantaneas", () => {
    const particles = pushEventParticles([], [
      { type: "beam", x0: 10, y0: 20, x1: 300, y1: 20, seed: 1 },
      { type: "shotgun", x0: 10, y0: 30, x1: 250, y1: 30, pellets: 5, seed: 2 },
      { type: "flame", x0: 10, y0: 40, x1: 180, y1: 40, seed: 3 },
    ], 0, { quality: "high" });
    expect(particles.some((particle) => particle.kind === "laser")).toBe(true);
    expect(particles.some((particle) => particle.kind === "shotgun")).toBe(true);
    expect(particles.some((particle) => particle.kind === "flame")).toBe(true);
  });

  it("emite flocos persistentes do krio como no efeito original", () => {
    const shortEvent = { type: "iceTrail", variant: "short", x: 180, y: 60, seed: 91 };
    const longEvent = { ...shortEvent, variant: "long", seed: 92 };
    const high = createIceTrailParticles(shortEvent, 1000, { quality: "high" });
    const low = createIceTrailParticles(shortEvent, 1000, { quality: "low" });
    const long = createIceTrailParticles(longEvent, 1000, { quality: "high" });
    expect(createIceTrailParticles(shortEvent, 1000, { quality: "high" })).toEqual(high);
    expect(high.length).toBeGreaterThan(low.length);
    expect(long).toHaveLength(1);
    expect(long[0].life).toBeGreaterThan(high[0].life);
    expect(long[0].vy).toBeGreaterThan(0);
    expect(long[0].gravity).toBeGreaterThan(0);
    expect(long[0].sway).toBeGreaterThan(0);
    expect(createIceTrailParticles(longEvent, 1000, { quality: "high", reduceMotion: true })[0].sway).toBe(0);
  });

  it("reproduz o rastro compacto da bola de fogo conforme a qualidade", () => {
    const event = { type: "fireTrail", variant: "ember", x: 180, y: 60, seed: 47 };
    const high = createFireTrailParticles(event, 1000, { quality: "high" });
    const low = createFireTrailParticles(event, 1000, { quality: "low" });
    expect(createFireTrailParticles(event, 1000, { quality: "high" })).toEqual(high);
    expect(high.length).toBeGreaterThan(low.length);
    expect(high.every((particle) => particle.kind === "spark")).toBe(true);
    expect(createFireTrailParticles({ ...event, variant: "smoke" }, 1000, { quality: "high" })[0].kind).toBe("smoke");
    expect(createFireTrailParticles({ ...event, variant: "smoke" }, 1000, { quality: "low" })).toEqual([]);
    const impact = pushEventParticles([], [{ type: "fireImpact", x: 250, y: 60, seed: 48 }], 1000, { quality: "high" });
    expect(impact.some((particle) => particle.kind === "ring")).toBe(true);
  });
});
