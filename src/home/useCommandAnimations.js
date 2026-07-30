import { useCallback, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useNavigate } from "react-router-dom";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { saveOrbitalTransition } from "./orbitalTransition.js";

const INTRO_KEY = "genesis:command-intro";

export function useCommandAnimations({ scope, runtime, chapter, phase, reduceMotion, setTransitioning }) {
  const navigate = useNavigate();
  const timelineRef = useRef(null);
  const returnCallRef = useRef(null);
  const navigatingRef = useRef(false);

  useGSAP(() => {
    let firstVisit = true;
    try {
      firstVisit = sessionStorage.getItem(INTRO_KEY) !== "1";
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // The command remains usable when session storage is blocked.
    }
    const duration = reduceMotion ? .01 : firstVisit ? .9 : .28;
    timelineRef.current?.kill();
    timelineRef.current = gsap.timeline()
      .fromTo(".command-header", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: duration * .35 })
      .fromTo(".command-primary-grid > *", { opacity: 0, y: 18 }, {
        opacity: 1, y: 0, duration: duration * .45, stagger: reduceMotion ? 0 : .06,
      }, "<.05")
      .fromTo(".command-module", { opacity: 0, y: 12 }, {
        opacity: 1, y: 0, duration: duration * .4, stagger: reduceMotion ? 0 : .04,
      }, "<.08");
    return () => timelineRef.current?.kill();
  }, { scope, dependencies: [reduceMotion] });

  useEffect(() => () => {
    timelineRef.current?.kill();
    returnCallRef.current?.kill();
  }, []);

  const scheduleReturn = useCallback((targetRuntime) => {
    returnCallRef.current?.kill();
    if (reduceMotion) return;
    returnCallRef.current = gsap.delayedCall(2.4, () => {
      targetRuntime.killAuto?.();
      const tween = gsap.to(targetRuntime.planetGroup.rotation, {
        ...targetRuntime.targetRotation, duration: .9, ease: "power2.out", overwrite: true,
      });
      targetRuntime.killAuto = () => tween.kill();
    });
  }, [reduceMotion]);

  const previewChapter = useCallback((preview) => {
    if (!runtime) return;
    const biome = getCampaignBiome((preview || chapter).id);
    gsap.to(runtime.atmosphere.material.color, {
      r: runtime.THREE.Color.NAMES ? new runtime.THREE.Color(biome.atmosphere).r : 0,
      g: new runtime.THREE.Color(biome.atmosphere).g,
      b: new runtime.THREE.Color(biome.atmosphere).b,
      duration: reduceMotion ? 0 : .3,
      overwrite: true,
    });
    gsap.to(runtime.keyLight.color, {
      r: new runtime.THREE.Color(biome.light).r,
      g: new runtime.THREE.Color(biome.light).g,
      b: new runtime.THREE.Color(biome.light).b,
      duration: reduceMotion ? 0 : .3,
      overwrite: true,
    });
  }, [runtime, chapter, reduceMotion]);

  const openCampaign = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setTransitioning(true);
    const destination = `/fases?capitulo=${chapter.number}&fase=${phase.id}`;
    if (!runtime || reduceMotion) {
      saveOrbitalTransition(runtime, chapter.id, phase.id);
      navigate(destination);
      return;
    }
    timelineRef.current?.kill();
    timelineRef.current = gsap.timeline({
      onComplete: () => {
        saveOrbitalTransition(runtime, chapter.id, phase.id);
        navigate(destination);
      },
    })
      .to(scope.current, { "--command-dim": .72, duration: .25, overwrite: true })
      .to(".command-lower-grid", { opacity: 0, y: 16, duration: .2 }, 0)
      .to(".current-operation", { opacity: 0, x: 22, duration: .25 }, 0)
      .to(runtime.camera.position, { z: 3.75, duration: .72, ease: "power2.inOut" }, .04)
      .to(runtime.planetGroup.rotation, { ...runtime.targetRotation, duration: .62, ease: "power2.inOut" }, .04)
      .to(runtime.atmosphere.material, { opacity: .42, duration: .45 }, .2)
      .to(runtime.markerRing.scale, { x: 1.7, y: 1.7, duration: .2, yoyo: true, repeat: 1 }, .3)
      .to(".command-transition-overlay", { opacity: 1, duration: .22 }, .58);
  }, [runtime, chapter, phase, reduceMotion, navigate, scope, setTransitioning]);

  return { openCampaign, previewChapter, scheduleReturn };
}
