import { useCallback, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const INTRO_KEY = "genesis:command-intro";

export function useCommandAnimations({ scope, reduceMotion }) {
  const timelineRef = useRef(null);
  const returnCallRef = useRef(null);

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

  const focusRuntime = useCallback((runtime) => {
    if (!runtime) return;
    runtime.killAuto?.();
    if (reduceMotion) {
      runtime.planetAnchor.rotation.set(
        runtime.targetRotation.x,
        runtime.targetRotation.y,
        runtime.targetRotation.z,
      );
      return;
    }
    const tween = gsap.to(runtime.planetAnchor.rotation, {
      ...runtime.targetRotation,
      duration: .62,
      ease: "power2.inOut",
      overwrite: true,
    });
    runtime.killAuto = () => tween.kill();
  }, [reduceMotion]);

  const scheduleReturn = useCallback((runtime) => {
    returnCallRef.current?.kill();
    if (reduceMotion) return;
    returnCallRef.current = gsap.delayedCall(2.4, () => focusRuntime(runtime));
  }, [focusRuntime, reduceMotion]);

  return { focusRuntime, scheduleReturn };
}
