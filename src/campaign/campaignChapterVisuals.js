import {
  getPhaseIndex,
} from "../game/content.js";
import {
  CAMPAIGN_PHASE_LOCATIONS,
  latLonToCartesian,
} from "./campaignSceneData.js";

export const CAMPAIGN_CHAPTER_VISUAL_PROFILES = Object.freeze({
  active: Object.freeze({
    reachedOpacity: .88,
    lockedOpacity: .3,
    effectOpacity: 1,
    colorDarken: 0,
  }),

  inactive: Object.freeze({
    reachedOpacity: .24,
    lockedOpacity: .1,
    effectOpacity: .2,
    colorDarken: .62,
  }),

  locked: Object.freeze({
    reachedOpacity: .08,
    lockedOpacity: .055,
    effectOpacity: .055,
    colorDarken: .84,
  }),
});

function collectMaterials(root) {
  const materials = [];

  root?.traverse?.((object) => {
    const entries = Array.isArray(
      object.material,
    )
      ? object.material
      : [object.material];

    entries
      .filter(Boolean)
      .forEach((material) => {
        materials.push(material);
      });
  });

  return materials;
}

function routeStateForChapter(
  chapter,
  activeChapterId,
  unlockedPhaseIndex,
) {
  if (chapter.id === activeChapterId) {
    return "active";
  }

  return (
    getPhaseIndex(chapter.phaseIds[0])
      <= unlockedPhaseIndex
      ? "inactive"
      : "locked"
  );
}

function setMaterialTarget(
  material,
  profile,
  immediate,
) {
  const reached = Boolean(
    material.userData.campaignRouteReached,
  );

  const targetOpacity = reached
    ? profile.reachedOpacity
    : profile.lockedOpacity;

  material.userData.campaignTargetOpacity = (
    targetOpacity
  );

  const baseColor = (
    material.userData.campaignBaseColor
  );

  const darkColor = (
    material.userData.campaignDarkColor
  );

  if (baseColor && darkColor) {
    material.userData.campaignTargetColor
      .copy(baseColor)
      .lerp(
        darkColor,
        profile.colorDarken,
      );
  }

  if (immediate) {
    material.opacity = targetOpacity;

    if (
      material.userData.campaignTargetColor
    ) {
      material.color.copy(
        material.userData.campaignTargetColor,
      );
    }
  }
}

export function initializeCampaignChapterVisuals({
  runtime,
  chapters,
  unlockedPhaseIndex,
}) {
  const {
    THREE,
    routeGroup,
    markerVectors,
  } = runtime;

  markerVectors.clear();

  while (routeGroup.children.length) {
    const child = routeGroup.children.pop();

    child.traverse?.((object) => {
      object.geometry?.dispose?.();

      const materials = Array.isArray(
        object.material,
      )
        ? object.material
        : [object.material];

      materials
        .filter(Boolean)
        .forEach((material) => (
          material.dispose?.()
        ));
    });
  }

  runtime.chapterRouteGroups = new Map();
  runtime.campaignRouteMaterials = [];

  chapters.forEach((chapter) => {
    const chapterGroup = new THREE.Group();

    chapterGroup.name = (
      `CampaignRoutes_${chapter.id}`
    );

    chapterGroup.userData.chapterId = (
      chapter.id
    );

    const points = chapter.phaseIds.map(
      (phaseId) => {
        const location = (
          CAMPAIGN_PHASE_LOCATIONS[phaseId]
        );

        const point = latLonToCartesian(
          location.latitude,
          location.longitude,
          1.02 + location.elevation,
        );

        const vector = new THREE.Vector3(
          point.x,
          point.y,
          point.z,
        );

        markerVectors.set(
          phaseId,
          vector,
        );

        return vector;
      },
    );

    for (
      let index = 1;
      index < points.length;
      index += 1
    ) {
      const curvePoints = [];

      for (
        let step = 0;
        step <= 16;
        step += 1
      ) {
        curvePoints.push(
          points[index - 1]
            .clone()
            .lerp(
              points[index],
              step / 16,
            )
            .normalize()
            .multiplyScalar(1.045),
        );
      }

      const geometry = (
        new THREE.BufferGeometry()
          .setFromPoints(curvePoints)
      );

      const destinationPhaseId = (
        chapter.phaseIds[index]
      );

      const reached = (
        getPhaseIndex(destinationPhaseId)
        <= unlockedPhaseIndex
      );

      const material = (
        new THREE.LineBasicMaterial({
          color: reached
            ? chapter.palette.primary
            : "#334155",
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );

      material.userData.campaignChapterId = (
        chapter.id
      );

      material.userData.campaignRouteReached = (
        reached
      );

      material.userData.campaignBaseColor = (
        material.color.clone()
      );

      material.userData.campaignDarkColor = (
        new THREE.Color("#07101c")
      );

      material.userData.campaignTargetColor = (
        material.color.clone()
      );

      material.userData.campaignTargetOpacity = 0;

      const route = new THREE.Line(
        geometry,
        material,
      );

      route.renderOrder = 4;
      chapterGroup.add(route);
      runtime.campaignRouteMaterials.push(
        material,
      );
    }

    runtime.chapterRouteGroups.set(
      chapter.id,
      chapterGroup,
    );

    routeGroup.add(chapterGroup);
  });

  runtime.setActiveChapter = (
    activeChapterId,
    options = {},
  ) => {
    setCampaignActiveChapter(
      runtime,
      activeChapterId,
      unlockedPhaseIndex,
      options,
    );
  };

  runtime.updateCampaignChapterVisuals = (
    delta,
    reduceMotion,
  ) => {
    updateCampaignChapterVisuals(
      runtime,
      delta,
      reduceMotion,
    );
  };
}

export function setCampaignActiveChapter(
  runtime,
  activeChapterId,
  unlockedPhaseIndex,
  {
    immediate = false,
  } = {},
) {
  runtime.activeCampaignChapterId = (
    activeChapterId
  );

  runtime.campaignChapters?.forEach?.(
    (chapter) => {
      const state = routeStateForChapter(
        chapter,
        activeChapterId,
        unlockedPhaseIndex,
      );

      const group = (
        runtime.chapterRouteGroups?.get(
          chapter.id,
        )
      );

      if (!group) return;

      group.userData.visualState = state;

      const profile = (
        CAMPAIGN_CHAPTER_VISUAL_PROFILES[state]
      );

      collectMaterials(group).forEach(
        (material) => {
          setMaterialTarget(
            material,
            profile,
            immediate,
          );
        },
      );
    },
  );

  const unlockedChapterIds = (
    runtime.campaignChapters
      ?.filter((chapter) => (
        getPhaseIndex(chapter.phaseIds[0])
        <= unlockedPhaseIndex
      ))
      .map((chapter) => chapter.id)
    || []
  );

  runtime.chapterEffects?.setChapter?.(
    activeChapterId,
    {
      immediate,
      unlockedChapterIds,
      inactiveOpacity: (
        CAMPAIGN_CHAPTER_VISUAL_PROFILES
          .inactive
          .effectOpacity
      ),
      lockedOpacity: (
        CAMPAIGN_CHAPTER_VISUAL_PROFILES
          .locked
          .effectOpacity
      ),
    },
  );
}

export function updateCampaignChapterVisuals(
  runtime,
  delta,
  reduceMotion = false,
) {
  if (
    !runtime
    || runtime.transitioning
  ) {
    return;
  }

  const blend = 1 - Math.exp(
    -Math.max(0, delta)
    * (reduceMotion ? 18 : 6.5),
  );

  runtime.campaignRouteMaterials
    ?.forEach((material) => {
      const targetOpacity = Number(
        material.userData
          .campaignTargetOpacity,
      );

      if (Number.isFinite(targetOpacity)) {
        material.opacity += (
          targetOpacity - material.opacity
        ) * blend;
      }

      const targetColor = (
        material.userData
          .campaignTargetColor
      );

      if (targetColor) {
        material.color.lerp(
          targetColor,
          blend,
        );
      }
    });
}

export function getCampaignRouteMaterials(
  runtime,
) {
  return [
    ...(runtime?.campaignRouteMaterials || []),
  ];
}
