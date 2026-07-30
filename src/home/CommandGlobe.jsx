import { useEffect, useRef, useState } from "react";
import CommandGlobeToolbar from "./CommandGlobeToolbar.jsx";
import CommandLoading from "./CommandLoading.jsx";
import CommandPhaseMarker from "./CommandPhaseMarker.jsx";
import CommandWebGLFallback from "./CommandWebGLFallback.jsx";
import { createCommandGlobeScene } from "./CommandGlobeScene.js";
import { saveOrbitalTransition } from "./orbitalTransition.js";

export default function CommandGlobe({
  phase, chapter, phases, campaign, quality, previewing,
  onSelectPhase, focusRuntime, scheduleReturn,
}) {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const markerElementsRef = useRef(new Map());
  const pointerRef = useRef({ x: 0, y: 0 });
  const [state, setState] = useState("loading");
  const registerMarker = (phaseId, element) => {
    if (element) markerElementsRef.current.set(phaseId, element);
    else markerElementsRef.current.delete(phaseId);
  };

  useEffect(() => {
    let cancelled = false;
    createCommandGlobeScene({
      mount: mountRef.current, phase, chapter, phases, campaign, quality,
      selectedPhase: phase, markerElements: markerElementsRef.current,
    }).then((runtime) => {
      if (cancelled) return runtime.dispose();
      runtimeRef.current = runtime;
      setState("ready");
    }).catch(() => setState("failed"));
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.setChapter(chapter, phases, campaign, phase);
    focusRuntime(runtime);
  }, [chapter, phases, campaign, phase, focusRuntime]);

  const selectPhase = (selected) => {
    if (selected.id === phase.id) return;
    const runtime = runtimeRef.current;
    runtime?.focusPhase(selected.id);
    focusRuntime(runtime);
    onSelectPhase(selected);
  };
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
    runtime.planetAnchor.rotation.y += runtime.velocityY;
    runtime.planetAnchor.rotation.x = runtime.THREE.MathUtils.clamp(runtime.planetAnchor.rotation.x + runtime.velocityX, -.8, .8);
    pointerRef.current = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = () => {
    if (!runtimeRef.current) return;
    runtimeRef.current.dragging = false;
    scheduleReturn(runtimeRef.current);
  };

  if (state === "failed") return <div className="command-globe-stage command-globe-failed">
    <CommandWebGLFallback chapter={chapter} phase={phase} />
    <div className="command-fallback-phases" aria-label="OperaÃ§Ãµes do capÃ­tulo">
      {phases.map((entry) => <CommandPhaseMarker
        key={entry.id}
        phase={entry}
        campaign={campaign}
        selected={entry.id === phase.id}
        register={() => {}}
        onSelect={selectPhase}
      />)}
    </div>
    <CommandGlobeToolbar
      chapter={chapter}
      phase={phase}
      previewing={previewing}
      onExplore={() => saveOrbitalTransition(runtimeRef.current, chapter.id, phase.id)}
    />
  </div>;
  return <div
    className="command-globe-stage"
    role="application"
    aria-label="Mapa tático orbital. Selecione uma operação ou arraste para girar o planeta."
    tabIndex={0}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    onPointerCancel={pointerUp}
  >
    <div ref={mountRef} className="command-globe-mount" aria-hidden="true" />
    {state === "loading" && <><CommandWebGLFallback chapter={chapter} phase={phase} /><CommandLoading /></>}
    <div className="command-phase-marker-layer">
      {phases.map((entry) => <CommandPhaseMarker
        key={entry.id}
        phase={entry}
        campaign={campaign}
        selected={entry.id === phase.id}
        register={registerMarker}
        onSelect={selectPhase}
      />)}
    </div>
    <CommandGlobeToolbar
      chapter={chapter}
      phase={phase}
      previewing={previewing}
      onExplore={() => saveOrbitalTransition(runtimeRef.current, chapter.id, phase.id)}
    />
    <div className="command-globe-telemetry" aria-hidden="true"><span>ORB-SCAN 98.4</span><span>LINK ESTÁVEL</span></div>
  </div>;
}
