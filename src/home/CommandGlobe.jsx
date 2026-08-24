import { useEffect, useRef, useState } from "react";
import CommandGlobeToolbar from "./CommandGlobeToolbar.jsx";
import CommandLoading from "./CommandLoading.jsx";
import CommandPhaseMarker from "./CommandPhaseMarker.jsx";
import CommandWebGLFallback from "./CommandWebGLFallback.jsx";
import { createCommandGlobeScene } from "./CommandGlobeScene.js";
import {
  getCommandGlobeZoomPercent,
  getPointerPinchDistance,
  initializeCommandGlobeZoom,
  normalizeCommandWheelDelta,
  resetCommandGlobeZoom,
  zoomCommandGlobeBy,
} from "./commandGlobeZoom.js";
import { saveOrbitalTransition } from "./orbitalTransition.js";
import "./command-globe-interactions.css";

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[data-prevent-globe-drag='true']",
].join(",");

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.(INTERACTIVE_SELECTOR));
}

export default function CommandGlobe({
  phase,
  chapter,
  phases,
  campaign,
  quality,
  previewing,
  onSelectPhase,
  focusRuntime,
  scheduleReturn,
}) {
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const runtimeRef = useRef(null);
  const markerElementsRef = useRef(new Map());
  const pointerRef = useRef({ id: null, x: 0, y: 0 });
  const activePointersRef = useRef(new Map());
  const pinchRef = useRef({ distance: null });
  const [state, setState] = useState("loading");
  const [zoomPercent, setZoomPercent] = useState(100);

  const registerMarker = (phaseId, element) => {
    if (element) markerElementsRef.current.set(phaseId, element);
    else markerElementsRef.current.delete(phaseId);
  };

  const syncZoomIndicator = (runtime) => {
    if (!runtime) return;
    setZoomPercent(getCommandGlobeZoomPercent(runtime));
  };

  const applyZoom = (delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.killAuto?.();
    zoomCommandGlobeBy(runtime, delta);
    syncZoomIndicator(runtime);
  };

  const resetZoom = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.killAuto?.();
    resetCommandGlobeZoom(runtime);
    syncZoomIndicator(runtime);
  };

  useEffect(() => {
    let cancelled = false;

    createCommandGlobeScene({
      mount: mountRef.current,
      phase,
      chapter,
      phases,
      campaign,
      quality,
      selectedPhase: phase,
      markerElements: markerElementsRef.current,
    }).then((runtime) => {
      if (cancelled) return runtime.dispose();

      initializeCommandGlobeZoom(runtime);
      runtimeRef.current = runtime;
      syncZoomIndicator(runtime);
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
    /*
     * Mesmo capítulos concluídos continuam selecionáveis. O estado "completed"
     * não deve impedir a inspeção da missão; somente "locked" fica desabilitado.
     */
    if (selected.id === phase.id) return;

    const runtime = runtimeRef.current;
    runtime?.focusPhase(selected.id);
    focusRuntime(runtime);
    onSelectPhase(selected);
  };

  const pointerDown = (event) => {
    /*
     * Botões de missão e controles de zoom não podem iniciar o arraste nem
     * transferir a captura do ponteiro para o palco orbital.
     */
    if (isInteractiveTarget(event.target)) return;

    const runtime = runtimeRef.current;
    if (!runtime) return;

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
    runtime.killAuto?.();

    if (activePointersRef.current.size >= 2) {
      runtime.dragging = false;
      pinchRef.current.distance = getPointerPinchDistance(
        activePointersRef.current,
      );
      return;
    }

    if (quality.reduceMotion) return;

    runtime.dragging = true;
    runtime.velocityX = 0;
    runtime.velocityY = 0;
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const pointerMove = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime || !activePointersRef.current.has(event.pointerId)) return;

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointersRef.current.size >= 2) {
      event.preventDefault();

      const nextDistance = getPointerPinchDistance(
        activePointersRef.current,
      );
      const previousDistance = pinchRef.current.distance;

      if (previousDistance && nextDistance) {
        /*
         * Abrir os dedos aproxima a câmera; fechar os dedos afasta.
         */
        zoomCommandGlobeBy(
          runtime,
          (previousDistance - nextDistance) * .012,
        );
        syncZoomIndicator(runtime);
      }

      pinchRef.current.distance = nextDistance;
      runtime.dragging = false;
      return;
    }

    if (!runtime.dragging || pointerRef.current.id !== event.pointerId) return;

    const dx = event.clientX - pointerRef.current.x;
    const dy = event.clientY - pointerRef.current.y;

    runtime.velocityY = dx * .0038;
    runtime.velocityX = dy * .003;
    runtime.planetAnchor.rotation.y += runtime.velocityY;
    runtime.planetAnchor.rotation.x = runtime.THREE.MathUtils.clamp(
      runtime.planetAnchor.rotation.x + runtime.velocityX,
      -.8,
      .8,
    );

    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const pointerUp = (event) => {
    const runtime = runtimeRef.current;
    const wasDragging = Boolean(runtime?.dragging);

    activePointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!runtime) return;

    runtime.dragging = false;
    pointerRef.current.id = null;

    if (activePointersRef.current.size < 2) {
      pinchRef.current.distance = null;
    }

    if (wasDragging) {
      scheduleReturn(runtime);
    }
  };

  const wheel = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = normalizeCommandWheelDelta(
      event.deltaY,
      event.deltaMode,
    );

    applyZoom(delta * .0028);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => stage.removeEventListener("wheel", wheel, { passive: false });
  });

  const keyDown = (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyZoom(-.45);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      applyZoom(.45);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      resetZoom();
    }
  };

  if (state === "failed") {
    return <div className="command-globe-stage command-globe-failed">
      <CommandWebGLFallback chapter={chapter} phase={phase} />
      <div
        className="command-fallback-phases"
        aria-label="Operações do capítulo"
      >
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
        onExplore={() => saveOrbitalTransition(
          runtimeRef.current,
          chapter.id,
          phase.id,
        )}
      />
    </div>;
  }

  return <div
    className="command-globe-stage"
    role="application"
    aria-label={[
      "Mapa tático orbital.",
      "Selecione uma operação, arraste para girar,",
      "use a roda do mouse ou pinça para aplicar zoom.",
    ].join(" ")}
    tabIndex={0}
    onKeyDown={keyDown}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    onPointerCancel={pointerUp}
    ref={stageRef}
  >
    <div
      ref={mountRef}
      className="command-globe-mount"
      aria-hidden="true"
    />

    {state === "loading" && <>
      <CommandWebGLFallback chapter={chapter} phase={phase} />
      <CommandLoading />
    </>}

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

    {state === "ready" && (
      <div
        className="command-globe-zoom-controls"
        data-prevent-globe-drag="true"
        aria-label="Controles de zoom do planeta"
      >
        <button
          type="button"
          aria-label="Aproximar planeta"
          title="Aproximar (+)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            applyZoom(-.45);
          }}
        >
          +
        </button>
        <button
          type="button"
          className="command-globe-zoom-reset"
          aria-label={`Restaurar zoom. Zoom atual ${zoomPercent}%`}
          title="Restaurar zoom (0)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            resetZoom();
          }}
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          aria-label="Afastar planeta"
          title="Afastar (-)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            applyZoom(.45);
          }}
        >
          −
        </button>
      </div>
    )}

    <CommandGlobeToolbar
      chapter={chapter}
      phase={phase}
      previewing={previewing}
      onExplore={() => saveOrbitalTransition(
        runtimeRef.current,
        chapter.id,
        phase.id,
      )}
    />

    <div className="command-globe-telemetry" aria-hidden="true">
      <span>ORB-SCAN 98.4</span>
      <span>LINK ESTÁVEL</span>
    </div>
  </div>;
}
