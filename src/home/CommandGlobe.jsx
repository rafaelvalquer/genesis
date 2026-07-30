import { useEffect, useRef, useState } from "react";
import CommandLoading from "./CommandLoading.jsx";
import CommandWebGLFallback from "./CommandWebGLFallback.jsx";
import { createCommandGlobeScene } from "./CommandGlobeScene.js";

export default function CommandGlobe({ phase, chapter, quality, onOpenMap, onRuntimeReady, scheduleReturn }) {
  const mountRef = useRef(null);
  const markerRef = useRef(null);
  const runtimeRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    createCommandGlobeScene({
      mount: mountRef.current, phase, chapter, quality, markerElement: markerRef.current,
    }).then((runtime) => {
      if (cancelled) return runtime.dispose();
      runtimeRef.current = runtime;
      setState("ready");
      onRuntimeReady(runtime);
    }).catch(() => setState("failed"));
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const pointerDown = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime || quality.reduceMotion) return;
    runtime.killAuto?.();
    runtime.dragging = true;
    runtime.velocityX = 0;
    runtime.velocityY = 0;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime?.dragging) return;
    const dx = event.clientX - pointerRef.current.x;
    const dy = event.clientY - pointerRef.current.y;
    runtime.velocityY = dx * .0038;
    runtime.velocityX = dy * .003;
    runtime.planetGroup.rotation.y += runtime.velocityY;
    runtime.planetGroup.rotation.x = runtime.THREE.MathUtils.clamp(runtime.planetGroup.rotation.x + runtime.velocityX, -.72, .72);
    pointerRef.current = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = () => {
    if (!runtimeRef.current) return;
    runtimeRef.current.dragging = false;
    scheduleReturn(runtimeRef.current);
  };

  if (state === "failed") return <CommandWebGLFallback chapter={chapter} phase={phase} onOpenMap={onOpenMap} />;
  return <div
    className="command-globe-stage"
    role="application"
    aria-label="Visualização orbital. Arraste para girar o planeta; o marcador abre o mapa da operação atual."
    tabIndex={0}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    onPointerCancel={pointerUp}
  >
    <div ref={mountRef} className="command-globe-mount" aria-hidden="true" />
    {state === "loading" && <><CommandWebGLFallback chapter={chapter} phase={phase} onOpenMap={onOpenMap} /><CommandLoading /></>}
    <button
      ref={markerRef}
      type="button"
      className="command-orbital-marker"
      title={`Abrir ${phase.name} no mapa orbital`}
      aria-label={`Operação ${phase.id.slice(-2)}, ${phase.name}. Abrir mapa orbital.`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpenMap}
    >
      <span>{phase.boss ? "ALVO PRIORITÁRIO" : "SETOR ATIVO"}</span>
      <b>OPERAÇÃO {phase.id.slice(-2)}</b>
      <small>{phase.name}</small>
    </button>
    <div className="command-globe-telemetry" aria-hidden="true"><span>ORB-SCAN 98.4</span><span>LINK ESTÁVEL</span></div>
  </div>;
}
