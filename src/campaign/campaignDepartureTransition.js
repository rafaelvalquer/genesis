import gsap from "gsap";
import {
  CAMPAIGN_PHASE_LOCATIONS,
} from "./campaignSceneData.js";
import {
  getTargetRotationForPhase,
} from "../visual/campaignPlanetCoordinates.js";

export function getCampaignDepartureCameraDistance(
  cameraDistance,
) {
  const distance = Number(cameraDistance) || 4.5;

  return Math.max(
    1.68,
    Math.min(
      2.24,
      distance * .48,
    ),
  );
}

export function getCampaignTransitionOrigin(root) {
  const marker = root?.querySelector?.(
    '[data-marker-selected="true"]',
  );

  const rect = marker?.getBoundingClientRect?.();
  const viewport = globalThis.window;

  if (
    !rect
    || !viewport?.innerWidth
    || !viewport?.innerHeight
  ) {
    return {
      originX: "50%",
      originY: "48%",
    };
  }

  const x = (
    rect.left
    + rect.width / 2
  ) / viewport.innerWidth * 100;

  const y = (
    rect.top
    + rect.height / 2
  ) / viewport.innerHeight * 100;

  return {
    originX: (
      `${Math.max(8, Math.min(92, x)).toFixed(2)}%`
    ),
    originY: (
      `${Math.max(8, Math.min(92, y)).toFixed(2)}%`
    ),
  };
}

export function playCampaignToLoadoutTransition({
  runtime,
  root,
  phase,
  reduceMotion = false,
  signal,
  updateProgress,
}) {
  return new Promise((resolve) => {
    let settled = false;
    let killTransition = null;

    const finish = () => {
      if (settled) return;

      settled = true;

      if (runtime) {
        runtime.transitioning = false;

        if (
          runtime.killTransition
          === killTransition
        ) {
          runtime.killTransition = null;
        }
      }

      if (killTransition) {
        signal?.removeEventListener(
          "abort",
          killTransition,
        );
      }

      resolve();
    };

    const uiTargets = root
      ? root.querySelectorAll([
        ".campaign-header",
        ".chapter-rail",
        ".mission-panel",
        ".campaign-biome-label",
      ].join(","))
      : [];

    const selectedMarker = root?.querySelector?.(
      '[data-marker-selected="true"] .phase-marker',
    );

    const otherMarkers = root?.querySelectorAll?.(
      '.phase-marker-anchor:not([data-marker-selected="true"])',
    ) || [];

    runtime?.killAuto?.();
    runtime?.killTransition?.();

    if (
      reduceMotion
      || !runtime
      || !phase
    ) {
      const timeline = gsap.timeline({
        onComplete: finish,
      });

      timeline.to(
        uiTargets,
        {
          opacity: 0,
          duration: .12,
          ease: "power1.out",
        },
        0,
      );

      killTransition = () => {
        timeline.kill();
        finish();
      };

      signal?.addEventListener(
        "abort",
        killTransition,
        { once: true },
      );

      return;
    }

    const location = (
      CAMPAIGN_PHASE_LOCATIONS[phase.id]
    );

    const targetRotation = (
      getTargetRotationForPhase(phase.id)
    );

    const cameraDistance = (
      location?.cameraDistance
      || runtime.camera?.position?.z
      || 4.5
    );

    const zoomDistance = (
      getCampaignDepartureCameraDistance(
        cameraDistance,
      )
    );

    const routeMaterials = (
      runtime.routeGroup?.children
        ?.map((route) => route.material)
        .filter(Boolean)
      || []
    );

    const atmosphere = (
      runtime.atmosphere?.material
    );

    const atmosphereTarget = (
      atmosphere
        ? Math.min(
          1,
          Number(atmosphere.opacity || .35) * 2.2,
        )
        : null
    );

    runtime.transitioning = true;

    const timeline = gsap.timeline({
      defaults: {
        ease: "power3.inOut",
      },
      onComplete: finish,
    });

    timeline.call(
      () => updateProgress?.(24),
      [],
      0,
    );

    if (selectedMarker) {
      timeline.to(
        selectedMarker,
        {
          scale: 1.28,
          filter: "brightness(1.55)",
          duration: .28,
          ease: "power2.out",
        },
        0,
      );
    }

    timeline.to(
      uiTargets,
      {
        opacity: 0,
        y: -14,
        duration: .3,
        stagger: .025,
        ease: "power2.in",
      },
      .02,
    );

    if (otherMarkers.length) {
      timeline.to(
        otherMarkers,
        {
          opacity: 0,
          duration: .28,
          ease: "power2.in",
        },
        .03,
      );
    }

    if (routeMaterials.length) {
      timeline.to(
        routeMaterials,
        {
          opacity: 0,
          duration: .34,
        },
        .08,
      );
    }

    timeline.to(
      runtime.planetGroup.rotation,
      {
        x: targetRotation.x,
        y: targetRotation.y,
        z: targetRotation.z,
        duration: .78,
        overwrite: true,
      },
      0,
    );

    timeline.call(
      () => updateProgress?.(36),
      [],
      .34,
    );

    timeline.to(
      runtime.camera.position,
      {
        z: zoomDistance,
        duration: .86,
        overwrite: true,
      },
      .1,
    );

    if (atmosphere) {
      timeline.to(
        atmosphere,
        {
          opacity: atmosphereTarget,
          duration: .52,
        },
        .24,
      );
    }

    if (runtime.uniforms?.uMotion) {
      timeline.to(
        runtime.uniforms.uMotion,
        {
          value: 0,
          duration: .4,
        },
        .35,
      );
    }

    timeline.call(
      () => updateProgress?.(48),
      [],
      .68,
    );

    killTransition = () => {
      timeline.kill();
      finish();
    };

    runtime.killTransition = killTransition;

    signal?.addEventListener(
      "abort",
      killTransition,
      { once: true },
    );
  });
}
