import {
  applyGenesisLightState,
} from "./createGenesisPlanetLights.js";
import {
  applyGenesisPlanetChapterState,
} from "./genesisPlanetAsset.js";

function worldValue(
  biome,
  key,
  fallback,
) {
  const value = biome?.world?.[key];
  return Number.isFinite(value) ? value : fallback;
}

export function applyGenesisWorldTheme({
  THREE,
  runtime,
  chapter,
  biome,
  mode = "command",
  immediate = false,
}) {
  if (!runtime || !biome || !chapter) return;

  runtime.currentBiome = biome;
  runtime.currentThemeMode = mode;

  const uniforms = runtime.uniforms || {};
  uniforms.uDark?.value?.set?.(biome.surface[0]);
  uniforms.uMid?.value?.set?.(biome.surface[1]);
  uniforms.uBright?.value?.set?.(biome.surface[2]);
  uniforms.uAccent?.value?.set?.(biome.accent);

  if (uniforms.uBiome) {
    uniforms.uBiome.value = chapter.number;
  }

  const atmosphereOpacityKey = mode === "campaign"
    ? "atmosphereOpacityCampaign"
    : "atmosphereOpacityCommand";
  const fogDensityKey = mode === "campaign"
    ? "fogDensityCampaign"
    : "fogDensityCommand";

  runtime.atmosphereBaseOpacity = worldValue(
    biome,
    atmosphereOpacityKey,
    mode === "campaign" ? .14 : .15,
  );

  if (runtime.atmosphere?.material) {
    runtime.atmosphere.material.color.set(
      biome.atmosphere,
    );

    if (
      !runtime.planetParts?.atmosphere
      || runtime.glbFade < 1
    ) {
      runtime.atmosphere.material.opacity =
        runtime.atmosphereBaseOpacity;
    }
  }

  if (runtime.particles?.material) {
    runtime.particles.material.color.set(
      biome.particle,
    );
    runtime.particles.material.opacity = worldValue(
      biome,
      "particleOpacity",
      .65,
    );
    runtime.particles.material.size = worldValue(
      biome,
      "particleSize",
      runtime.particles.material.size,
    );
  }

  if (runtime.scene?.fog) {
    runtime.scene.fog.color.set(
      biome.world?.fogColor || biome.fog,
    );

    if ("density" in runtime.scene.fog) {
      runtime.scene.fog.density = worldValue(
        biome,
        fogDensityKey,
        runtime.scene.fog.density,
      );
    }
  }

  applyGenesisLightState(
    runtime,
    biome,
    {
      immediate,
      renderer: runtime.renderer,
    },
  );

  runtime.chapterEffects?.setChapter?.(
    chapter.id,
    { immediate },
  );

  applyGenesisPlanetChapterState({
    THREE,
    parts: runtime.planetParts,
    chapter,
    biome,
  });

  if (runtime.rocket?.engineGlow) {
    runtime.rocket.engineGlow.material.color.set(
      biome.atmosphere,
    );
  }

  if (runtime.mount) {
    runtime.mount.dataset.worldTheme = biome.key;
    runtime.mount.dataset.worldChapter = chapter.id;
  }
}
