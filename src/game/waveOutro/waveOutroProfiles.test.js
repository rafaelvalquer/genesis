import { describe, expect, it } from "vitest";
import {
  getWaveOutroImpactState,
  getWaveOutroPresentationProfile,
} from "./waveOutroProfiles.js";

describe("perfis cinematográficos do final de onda", () => {
  it("usa finalWave em vez de tipos inexistentes", () => {
    const profile = getWaveOutroPresentationProfile({
      finalWave: true,
      lastKill: { cinematic: false, enemy: { type: "voltriz" } },
    });
    expect(profile.letterbox).toBe(true);
    expect(["missionFinale", "bossFinale"]).toContain(profile.id);
  });

  it("ativa impacto durante finalKill usando elapsedMs", () => {
    const outro = {
      status: "finalKill",
      elapsedMs: 230,
      finalWave: false,
      lastKill: { cinematic: false, enemy: { type: "voltriz" } },
    };
    expect(getWaveOutroImpactState(outro).active).toBe(true);
  });

  it("não depende do estado inexistente impact", () => {
    const outro = {
      status: "cleanup",
      elapsedMs: 610,
      finalWave: true,
      lastKill: { cinematic: true, enemy: { type: "leviathanNereida" } },
    };
    const state = getWaveOutroImpactState(outro);
    expect(typeof state.active).toBe("boolean");
  });
});
