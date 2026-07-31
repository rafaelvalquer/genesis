import { createHivePlanetEffects } from "./effects/createHivePlanetEffects.js";
import { createGlassPlanetEffects } from "./effects/createGlassPlanetEffects.js";
import { createChitinPlanetEffects } from "./effects/createChitinPlanetEffects.js";
import { createStormPlanetEffects } from "./effects/createStormPlanetEffects.js";
import { createEclipsePlanetEffects } from "./effects/createEclipsePlanetEffects.js";

const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({
    structures: 12,
    particles: 26,
    lines: 2,
    rings: 1,
  }),
  medium: Object.freeze({
    structures: 26,
    particles: 72,
    lines: 4,
    rings: 2,
  }),
  high: Object.freeze({
    structures: 44,
    particles: 150,
    lines: 6,
    rings: 2,
  }),
});

export function getGenesisChapterEffectProfile(quality = {}) {
  return QUALITY_PROFILES[quality.quality]
    || QUALITY_PROFILES.high;
}

function collectMaterials(group) {
  const materials = new Set();

  group.traverse((object) => {
    if (!object.isMesh && !object.isLine && !object.isPoints) return;

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.filter(Boolean).forEach((material) => {
      if (!Number.isFinite(
        material.userData.genesisEffectBaseOpacity,
      )) {
        material.userData.genesisEffectBaseOpacity =
          Number.isFinite(material.opacity)
            ? material.opacity
            : 1;
      }
      material.userData.genesisEffectPulse = 1;
      material.transparent = true;
      material.needsUpdate = true;
      materials.add(material);
    });
  });

  return [...materials];
}

function applyGroupOpacity(group, opacity) {
  const safeOpacity = Math.max(0, Math.min(1, opacity));

  group.userData.effectMaterials.forEach((material) => {
    const pulse = Number.isFinite(
      material.userData.genesisEffectPulse,
    )
      ? material.userData.genesisEffectPulse
      : 1;

    material.opacity = (
      material.userData.genesisEffectBaseOpacity
      * safeOpacity
      * pulse
    );
  });

  group.visible = safeOpacity > .008;
}

export function createGenesisChapterEffects({
  THREE,
  parent,
  quality,
  chapterId = "chapter_01",
}) {
  const profile = getGenesisChapterEffectProfile(quality);
  const root = new THREE.Group();
  root.name = "GenesisChapterEffectsRoot";

  const groups = {
    chapter_01: createHivePlanetEffects({ THREE, profile }),
    chapter_02: createGlassPlanetEffects({ THREE, profile }),
    chapter_03: createChitinPlanetEffects({ THREE, profile }),
    chapter_04: createStormPlanetEffects({ THREE, profile }),
    chapter_05: createEclipsePlanetEffects({ THREE, profile }),
  };

  Object.entries(groups).forEach(([id, group]) => {
    group.userData.chapterId = id;
    group.userData.effectMaterials = collectMaterials(group);
    group.userData.opacity = 0;
    group.userData.targetOpacity = 0;
    applyGroupOpacity(group, 0);
    root.add(group);
  });

  parent.add(root);

  const runtime = {
    root,
    groups,
    activeChapterId: null,
    disposed: false,
  };

  runtime.setChapter = (
    nextChapterId,
    { immediate = false } = {},
  ) => {
    runtime.activeChapterId = groups[nextChapterId]
      ? nextChapterId
      : "chapter_01";

    Object.entries(groups).forEach(([id, group]) => {
      group.userData.targetOpacity = (
        id === runtime.activeChapterId ? 1 : 0
      );

      if (immediate) {
        group.userData.opacity =
          group.userData.targetOpacity;
        applyGroupOpacity(
          group,
          group.userData.opacity,
        );
      } else if (group.userData.targetOpacity > 0) {
        group.visible = true;
      }
    });
  };

  runtime.update = (
    delta,
    elapsed,
    reduceMotion = false,
  ) => {
    if (runtime.disposed) return;

    Object.values(groups).forEach((group) => {
      const transitionSpeed = reduceMotion ? 16 : 4.8;
      const blend = 1 - Math.exp(
        -Math.max(0, delta) * transitionSpeed,
      );

      group.userData.opacity += (
        group.userData.targetOpacity
        - group.userData.opacity
      ) * blend;

      if (
        Math.abs(
          group.userData.targetOpacity
          - group.userData.opacity,
        ) < .001
      ) {
        group.userData.opacity =
          group.userData.targetOpacity;
      }

      group.userData.update?.(
        delta,
        elapsed,
        reduceMotion,
      );
      applyGroupOpacity(
        group,
        group.userData.opacity,
      );
    });
  };

  runtime.dispose = () => {
    runtime.disposed = true;
  };

  runtime.setChapter(chapterId, { immediate: true });
  return runtime;
}

export function updateGenesisChapterEffects(
  runtime,
  delta,
  elapsed,
  reduceMotion = false,
) {
  runtime?.update?.(delta, elapsed, reduceMotion);
}
