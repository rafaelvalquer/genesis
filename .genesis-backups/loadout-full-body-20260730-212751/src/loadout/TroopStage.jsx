import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import AnimatedTroopPreview from "./AnimatedTroopPreview.jsx";
import LoadoutLoading from "./LoadoutLoading.jsx";
import LoadoutWebGLFallback from "./LoadoutWebGLFallback.jsx";
import { createTroopStageScene } from "./TroopStageScene.js";

export default function TroopStage({ troop, selected, quality, arenaUrl, onRuntimeReady }) {
  const mountRef = useRef(null);
  const scanRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let runtime;
    createTroopStageScene({
      mount: mountRef.current,
      quality,
      color: troop?.color || "#22d3ee",
      onFailure: () => { if (!cancelled) setFailed(true); },
    }).then((nextRuntime) => {
      if (cancelled) {
        nextRuntime?.dispose();
        return;
      }
      runtime = nextRuntime;
      setLoading(false);
      if (nextRuntime) onRuntimeReady(nextRuntime);
    });
    return () => {
      cancelled = true;
      runtime?.dispose();
      onRuntimeReady(null);
    };
  }, []);

  useEffect(() => {
    if (quality.reduceMotion || !scanRef.current) return undefined;
    const animation = animate(scanRef.current, {
      translateY: ["-120%", "600%"],
      opacity: [.04, .42, .04],
      duration: 3400,
      loop: true,
      ease: "linear",
    });
    return () => animation.cancel();
  }, [quality.reduceMotion]);

  return <section className="troop-stage" aria-labelledby="troop-stage-title" style={{ "--stage-arena": `url(${arenaUrl})`, "--troop-color": troop?.color }}>
    <div className="troop-stage-arena" aria-hidden="true" />
    <div ref={mountRef} className="troop-stage-canvas" aria-hidden="true" />
    {failed && <LoadoutWebGLFallback />}
    {loading && !failed && <LoadoutLoading />}
    <div className="loadout-stage-sprite">
      <AnimatedTroopPreview troop={troop} reduceMotion={quality.reduceMotion} />
    </div>
    <span ref={scanRef} className="loadout-stage-scan" aria-hidden="true" />
    <div className="stage-brackets" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="stage-status">
      <span className="eyebrow">UNIDADE · {troop?.id?.toUpperCase()}</span>
      <h2 id="troop-stage-title">{troop?.label}</h2>
      {troop?.title && <small>{troop.title}</small>}
      <p>{troop?.role}</p>
      <strong className={selected ? "integrated" : ""}>{selected ? "INTEGRADO AO ESQUADRÃO" : "DISPONÍVEL"}</strong>
    </div>
    <div className="stage-telemetry" aria-hidden="true"><span>BIO-SINAL 98.4</span><span>LINK TÁTICO ESTÁVEL</span></div>
  </section>;
}
