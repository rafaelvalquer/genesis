import { useCallback, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function useLoadoutAnimations({ scope, runtime, focusedTroop, selectedCount, reduceMotion }) {
  const focusTimelineRef = useRef(null);
  const confirmTimelineRef = useRef(null);
  const previousCount = useRef(selectedCount);

  useGSAP(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("genesis:loadout-intro") === "1";
      sessionStorage.setItem("genesis:loadout-intro", "1");
    } catch {
      seen = true;
    }
    const duration = reduceMotion ? .01 : seen ? .3 : .72;
    gsap.fromTo(
      [".loadout-header-new", ".troop-roster", ".tactical-brief", ".squad-dock"],
      { opacity: 0, y: reduceMotion ? 0 : 18 },
      { opacity: 1, y: 0, duration, stagger: reduceMotion ? 0 : .08, ease: "power2.out" },
    );
  }, { scope, dependencies: [reduceMotion] });

  useGSAP(() => {
    if (!runtime || !focusedTroop) return undefined;
    focusTimelineRef.current?.kill();
    const target = new runtime.THREE.Color(focusedTroop.color);
    const duration = reduceMotion ? .08 : .42;
    const timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    timeline
      .to(".loadout-stage-sprite", { opacity: .18, duration: duration * .28 }, 0)
      .to(runtime.beam.material, { opacity: .025, duration: duration * .28 }, 0)
      .to(runtime.camera.position, { z: reduceMotion ? 6.4 : 6.75, duration: duration * .4 }, 0);
    runtime.accentMaterials.forEach((material) => {
      timeline.to(material.color, { r: target.r, g: target.g, b: target.b, duration }, duration * .2);
    });
    timeline
      .to(runtime.keyLight.color, { r: target.r, g: target.g, b: target.b, duration }, duration * .2)
      .to(runtime.beam.material, { opacity: .075, duration: duration * .38 }, duration * .48)
      .to(runtime.camera.position, { z: 6.4, duration: duration * .38 }, duration * .48)
      .to(".loadout-stage-sprite", { opacity: 1, duration: duration * .3 }, duration * .52);
    focusTimelineRef.current = timeline;
    return () => timeline.kill();
  }, { scope, dependencies: [runtime, focusedTroop?.id, reduceMotion] });

  useGSAP(() => {
    if (!runtime || previousCount.current === selectedCount) return;
    const added = selectedCount > previousCount.current;
    previousCount.current = selectedCount;
    gsap.fromTo(runtime.platform.scale, { x: added ? 1.06 : .96, y: 1, z: added ? 1.06 : .96 }, {
      x: 1, y: 1, z: 1, duration: reduceMotion ? .08 : .34, ease: "back.out(2)",
    });
    gsap.fromTo(runtime.keyLight, { intensity: added ? 24 : 5 }, {
      intensity: 13, duration: reduceMotion ? .08 : .5,
    });
  }, { scope, dependencies: [runtime, selectedCount, reduceMotion] });

  useGSAP(() => () => {
    focusTimelineRef.current?.kill();
    confirmTimelineRef.current?.kill();
  }, { scope });

  const runConfirm = useCallback((onComplete) => {
    confirmTimelineRef.current?.kill();
    if (reduceMotion || !runtime) {
      onComplete();
      return;
    }
    const timeline = gsap.timeline({ onComplete });
    timeline
      .to(".squad-slot.occupied", { borderColor: "#67e8f9", duration: .18, stagger: .035 }, 0);
    runtime.rings.forEach((ring, index) => {
      timeline.to(ring.rotation, {
        x: Math.PI * 1.5,
        duration: .5,
        ease: "power3.inOut",
      }, .08 + index * .025);
    });
    timeline
      .to(runtime.keyLight, { intensity: 34, duration: .22, yoyo: true, repeat: 1 }, .28)
      .to(".loadout-confirm", { filter: "brightness(1.45)", duration: .18, yoyo: true, repeat: 1 }, .44);
    confirmTimelineRef.current = timeline;
  }, [runtime, reduceMotion]);

  return { focusTimelineRef, runConfirm };
}
