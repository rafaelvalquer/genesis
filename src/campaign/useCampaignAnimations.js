import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { getCampaignBiome } from "./campaignBiomes.js";
import { CAMPAIGN_PHASE_LOCATIONS } from "./campaignSceneData.js";

gsap.registerPlugin(useGSAP);

function colorTarget(THREE, value) {
  const color = new THREE.Color(value);
  return { r: color.r, g: color.g, b: color.b };
}

export function useCampaignAnimations({
  scope, runtime, chapter, selectedPhase, reduceMotion, sceneReady,
}) {
  const timelineRef = useRef(null);
  const previousChapterRef = useRef(null);

  useGSAP(() => {
    if (!runtime || !sceneReady) return undefined;
    const biome = getCampaignBiome(chapter.id);
    const chapterChanged = previousChapterRef.current !== chapter.id;
    previousChapterRef.current = chapter.id;
    timelineRef.current?.kill();
    const duration = reduceMotion ? .12 : 1.05;
    const location = selectedPhase ? CAMPAIGN_PHASE_LOCATIONS[selectedPhase.id] : null;
    const targetRotation = location ? {
      x: location.latitude * Math.PI / 180,
      y: -(location.longitude + 90) * Math.PI / 180,
      z: biome.rotation.z,
    } : biome.rotation;
    const cameraDistance = location?.cameraDistance || biome.cameraDistance;
    const timeline = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    const routeMaterials = runtime.routeGroup.children.map((line) => line.material);
    const routeTargets = routeMaterials.map((material) => material.opacity);
    timeline
      .to(runtime.camera.position, { z: reduceMotion ? cameraDistance : cameraDistance + .5, duration: duration * .35 }, 0)
      .to(runtime.planetGroup.rotation, {
        x: targetRotation.x, y: targetRotation.y, z: targetRotation.z,
        duration, overwrite: true,
      }, reduceMotion ? 0 : .12)
      .to(runtime.uniforms.uDark.value, { ...colorTarget(runtime.THREE, biome.surface[0]), duration }, .08)
      .to(runtime.uniforms.uMid.value, { ...colorTarget(runtime.THREE, biome.surface[1]), duration }, .08)
      .to(runtime.uniforms.uBright.value, { ...colorTarget(runtime.THREE, biome.surface[2]), duration }, .08)
      .to(runtime.uniforms.uAccent.value, { ...colorTarget(runtime.THREE, biome.accent), duration }, .08)
      .to(runtime.atmosphere.material.color, { ...colorTarget(runtime.THREE, biome.atmosphere), duration }, .08)
      .to(runtime.keyLight.color, { ...colorTarget(runtime.THREE, biome.light), duration }, .08)
      .to(runtime.particles.material.color, { ...colorTarget(runtime.THREE, biome.particle), duration }, .08)
      .to(runtime.uniforms.uBiome, { value: chapter.number, duration }, .08)
      .to(runtime.camera.position, { z: cameraDistance, duration: duration * .42 }, duration * .68);
    if (chapterChanged) {
      timeline
        .fromTo(".campaign-marker-layer", { opacity: reduceMotion ? 1 : .18 }, {
          opacity: 1,
          duration: duration * .28,
        }, duration * .72);
    }
    routeMaterials.forEach((material, index) => {
      timeline.fromTo(material, { opacity: 0 }, {
        opacity: routeTargets[index],
        duration: reduceMotion ? .01 : .22,
      }, reduceMotion ? 0 : duration * .7 + index * .07);
    });
    timelineRef.current = timeline;
    runtime.killAuto = () => timeline.kill();
    return () => {
      timeline.kill();
      if (runtime.killAuto) runtime.killAuto = null;
    };
  }, { scope, dependencies: [runtime, sceneReady, chapter.id, selectedPhase?.id, reduceMotion] });

  useGSAP(() => {
    if (!sceneReady) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem("genesis:campaign-intro") === "1";
      sessionStorage.setItem("genesis:campaign-intro", "1");
    } catch {
      seen = true;
    }
    const duration = reduceMotion ? .01 : seen ? .35 : .85;
    gsap.fromTo(
      [".campaign-header", ".chapter-rail", ".mission-panel"],
      { opacity: 0, y: reduceMotion ? 0 : 18 },
      { opacity: 1, y: 0, duration, stagger: reduceMotion ? 0 : .12, ease: "power2.out" },
    );
  }, { scope, dependencies: [sceneReady, reduceMotion] });

  return () => timelineRef.current?.kill();
}
