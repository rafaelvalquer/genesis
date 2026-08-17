import {
  createHivePlanetEffects,
} from "./effects/createHivePlanetEffects.js";
import {
  createGlassPlanetEffects,
} from "./effects/createGlassPlanetEffects.js";
import {
  createChitinPlanetEffects,
} from "./effects/createChitinPlanetEffects.js";
import {
  createStormPlanetEffects,
} from "./effects/createStormPlanetEffects.js";
import {
  createOceanPlanetEffects,
} from "./effects/createOceanPlanetEffects.js";
import { createMagmaPlanetEffects } from "./effects/createMagmaPlanetEffects.js";
import { createGenesisMicroEvents } from "./createGenesisMicroEvents.js";

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

export function getGenesisChapterEffectProfile(
  quality = {},
) {
  return (
    QUALITY_PROFILES[quality.quality]
    || QUALITY_PROFILES.high
  );
}

function collectMaterials(group) {
  const materials = new Set();

  group.traverse((object) => {
    if (
      !object.isMesh
      && !object.isLine
      && !object.isPoints
    ) {
      return;
    }

    const entries = Array.isArray(
      object.material,
    )
      ? object.material
      : [object.material];

    entries
      .filter(Boolean)
      .forEach((material) => {
        if (
          !Number.isFinite(
            material.userData
              .genesisEffectBaseOpacity,
          )
        ) {
          material.userData
            .genesisEffectBaseOpacity = (
              Number.isFinite(material.opacity)
                ? material.opacity
                : 1
            );
        }

        material.userData.genesisEffectPulse = 1;
        material.transparent = true;
        material.needsUpdate = true;
        materials.add(material);
      });
  });

  return [...materials];
}

function applyGroupOpacity(
  group,
  opacity,
) {
  const safeOpacity = Math.max(
    0,
    Math.min(1, opacity),
  );

  group.userData.effectMaterials
    .forEach((material) => {
      const pulse = Number.isFinite(
        material.userData.genesisEffectPulse,
      )
        ? material.userData.genesisEffectPulse
        : 1;

      material.opacity = (
        material.userData
          .genesisEffectBaseOpacity
        * safeOpacity
        * pulse
      );
    });

  group.visible = safeOpacity > .008;
}

function targetOpacityForGroup(
  runtime,
  chapterId,
) {
  if (chapterId === runtime.activeChapterId) {
    return 1;
  }

  if (!runtime.persistentChapters) {
    return 0;
  }

  return runtime.unlockedChapterIds.has(
    chapterId,
  )
    ? runtime.inactiveOpacity
    : runtime.lockedOpacity;
}

const EFFECT_FACTORIES = Object.freeze({
  chapter_01: createHivePlanetEffects,
  chapter_02: createGlassPlanetEffects,
  chapter_03: createChitinPlanetEffects,
  chapter_04: createStormPlanetEffects,
  chapter_05: createOceanPlanetEffects,
  chapter_06: createMagmaPlanetEffects,
});

export function createGenesisChapterEffects({
  THREE,
  parent,
  quality,
  chapterId = "chapter_01",
  persistentChapters = false,
  inactiveOpacity = .2,
  lockedOpacity = .055,
  unlockedChapterIds = [],
}) {
  const profile = (
    getGenesisChapterEffectProfile(quality)
  );

  const root = new THREE.Group();
  root.name = "GenesisChapterEffectsRoot";

  const groups = {};

  parent.add(root);

  const runtime = {
    root,
    groups,
    activeChapterId: null,
    disposed: false,
    persistentChapters,
    inactiveOpacity: Math.max(
      0,
      Math.min(1, inactiveOpacity),
    ),
    lockedOpacity: Math.max(
      0,
      Math.min(1, lockedOpacity),
    ),
    unlockedChapterIds: new Set(
      unlockedChapterIds,
    ),
    frameIndex: 0,
  };

  const createGroup = (id) => {
    if (groups[id]) return groups[id];
    const factory = EFFECT_FACTORIES[id];
    if (!factory) return null;
    const group = factory({ THREE, profile });
    const microEvents = createGenesisMicroEvents({ THREE, chapterId: id, profile });
    const updateChapterEffects = group.userData.update;
    group.add(microEvents);
    group.userData.update = (delta, elapsed, reduceMotion) => {
      updateChapterEffects?.(delta, elapsed, reduceMotion);
      microEvents.userData.update?.(elapsed, reduceMotion);
    };
    group.userData.chapterId = id;
    group.userData.effectMaterials = collectMaterials(group);
    group.userData.opacity = 0;
    group.userData.targetOpacity = 0;
    applyGroupOpacity(group, 0);
    root.add(group);
    groups[id] = group;
    return group;
  };

  runtime.ensureChapter = createGroup;

  runtime.setChapter = (
    nextChapterId,
    {
      immediate = false,
      unlockedChapterIds:
        nextUnlockedChapterIds,
      inactiveOpacity:
        nextInactiveOpacity,
      lockedOpacity:
        nextLockedOpacity,
    } = {},
  ) => {
    runtime.activeChapterId = EFFECT_FACTORIES[nextChapterId]
      ? nextChapterId
      : "chapter_01";
    createGroup(runtime.activeChapterId);

    if (nextUnlockedChapterIds) {
      runtime.unlockedChapterIds = new Set(
        nextUnlockedChapterIds,
      );
    }

    if (
      Number.isFinite(nextInactiveOpacity)
    ) {
      runtime.inactiveOpacity = Math.max(
        0,
        Math.min(1, nextInactiveOpacity),
      );
    }

    if (
      Number.isFinite(nextLockedOpacity)
    ) {
      runtime.lockedOpacity = Math.max(
        0,
        Math.min(1, nextLockedOpacity),
      );
    }

    Object.entries(groups).forEach(
      ([id, group]) => {
        group.userData.targetOpacity = (
          targetOpacityForGroup(
            runtime,
            id,
          )
        );

        if (immediate) {
          group.userData.opacity = (
            group.userData.targetOpacity
          );

          applyGroupOpacity(
            group,
            group.userData.opacity,
          );
        } else if (
          group.userData.targetOpacity > 0
        ) {
          group.visible = true;
        }
      },
    );
  };

  runtime.fadeOut = () => {
    Object.values(groups).forEach((group) => {
      group.userData.targetOpacity = 0;
    });
  };

  runtime.update = (
    delta,
    elapsed,
    reduceMotion = false,
  ) => {
    if (runtime.disposed) return;

    runtime.frameIndex += 1;

    Object.entries(groups).forEach(
      ([id, group]) => {
        if (
          group.userData.opacity <= .001
          && group.userData.targetOpacity <= 0
        ) {
          return;
        }

        const active = (
          id === runtime.activeChapterId
        );

        const blend = 1 - Math.exp(
          -Math.max(0, delta)
          * (reduceMotion ? 16 : 4.8),
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
          group.userData.opacity = (
            group.userData.targetOpacity
          );
        }

        const updateCadence = active
          ? 1
          : reduceMotion
            ? 8
            : 4;

        if (
          runtime.frameIndex
            % updateCadence
          === 0
        ) {
          group.userData.update?.(
            delta * updateCadence,
            elapsed,
            reduceMotion,
          );
        }

        applyGroupOpacity(
          group,
          group.userData.opacity,
        );
      },
    );
  };

  runtime.dispose = () => {
    runtime.disposed = true;
  };

  runtime.setChapter(
    chapterId,
    {
      immediate: true,
      unlockedChapterIds,
    },
  );

  return runtime;
}

export function updateGenesisChapterEffects(
  runtime,
  delta,
  elapsed,
  reduceMotion = false,
) {
  runtime?.update?.(
    delta,
    elapsed,
    reduceMotion,
  );
}
