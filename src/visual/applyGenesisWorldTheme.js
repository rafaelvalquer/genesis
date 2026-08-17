import {
  applyGenesisLightState,
} from "./createGenesisPlanetLights.js";
import {
  applyGenesisPlanetChapterState,
} from "./genesisPlanetAsset.js";
import { syncGenesisAtmosphereWithLight } from "./createGenesisAtmosphereMaterial.js";

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
  stagger = false,
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

  const applyFog = () => {
    if (!runtime.scene?.fog) return;
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
  };

  applyGenesisLightState(
    runtime,
    biome,
    {
      immediate,
      renderer: runtime.renderer,
    },
  );
  syncGenesisAtmosphereWithLight(runtime.atmosphere, runtime.keyLight);
  syncGenesisAtmosphereWithLight(runtime.planetParts?.atmosphere, runtime.keyLight);

  const fadeEffects = () => runtime.chapterEffects?.fadeOut?.();
  const applyEffects = () => runtime.chapterEffects?.setChapter?.(chapter.id, { immediate });
  if (stagger && !immediate) {
    runtime.worldThemeTransition = {
      elapsed: 0,
      applyFog,
      fadeEffects,
      applyEffects,
      fogApplied: false,
      effectsFaded: false,
      effectsApplied: false,
    };
  } else {
    applyFog();
    applyEffects();
  }

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

export function updateGenesisWorldThemeTransition(runtime, delta) {
  const transition = runtime?.worldThemeTransition;
  if (!transition) return false;
  transition.elapsed += Math.max(0, delta) * 1000;
  if (!transition.fogApplied && transition.elapsed >= 150) { transition.applyFog(); transition.fogApplied = true; }
  if (!transition.effectsFaded && transition.elapsed >= 300) { transition.fadeEffects(); transition.effectsFaded = true; }
  if (!transition.effectsApplied && transition.elapsed >= 450) { transition.applyEffects(); transition.effectsApplied = true; }
  if (transition.effectsApplied) runtime.worldThemeTransition = null;
  return true;
}
