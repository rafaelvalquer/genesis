import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate } from "animejs";
import AnimatedTroopPreview from "./AnimatedTroopPreview.jsx";
import LoadoutLoading from "./LoadoutLoading.jsx";
import LoadoutWebGLFallback from "./LoadoutWebGLFallback.jsx";
import { createTroopStageScene } from "./TroopStageScene.js";
import {
  getTroopStageEffectStyle,
  normalizeTroopStageCharacterBounds,
} from "./troopStageEffects.js";
import "./loadout-stage-interactions.css";

const DEFAULT_CHARACTER_BOUNDS = {
  stageWidth: 800,
  stageHeight: 600,
  left: 250,
  top: 80,
  right: 550,
  bottom: 500,
};

export default function TroopStage({
  troop,
  selected,
  quality,
  arenaUrl,
  onRuntimeReady,
  onStageReady,
}) {
  const stageRef = useRef(null);
  const mountRef = useRef(null);
  const scanRef = useRef(null);
  const runtimeRef = useRef(null);
  const reactionTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [characterBounds, setCharacterBounds] = useState(
    DEFAULT_CHARACTER_BOUNDS,
  );
  const [reactionId, setReactionId] = useState(0);
  const [reacting, setReacting] = useState(false);

  const normalizedBounds = useMemo(
    () => normalizeTroopStageCharacterBounds(
      characterBounds,
    ),
    [characterBounds],
  );

  const effectStyle = useMemo(
    () => getTroopStageEffectStyle(
      normalizedBounds,
    ),
    [normalizedBounds],
  );

  const handleCharacterLayout = useCallback((bounds) => {
    if (!bounds) return;

    setCharacterBounds(bounds);
    runtimeRef.current?.setCharacterBounds?.(bounds);
  }, []);

  const activateCharacter = useCallback(() => {
    window.clearTimeout(reactionTimerRef.current);

    setReactionId((current) => current + 1);
    setReacting(true);
    runtimeRef.current?.triggerInteraction?.();

    reactionTimerRef.current = window.setTimeout(
      () => setReacting(false),
      quality.reduceMotion ? 220 : 720,
    );
  }, [quality.reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    let runtime;

    createTroopStageScene({
      mount: mountRef.current,
      quality,
      color: troop?.color || "#22d3ee",
      onFailure: () => {
        if (!cancelled) setFailed(true);
      },
    }).then((nextRuntime) => {
      if (cancelled) {
        nextRuntime?.dispose();
        return;
      }

      runtime = nextRuntime;
      runtimeRef.current = nextRuntime;
      setLoading(false);

      if (nextRuntime) {
        nextRuntime.setCharacterBounds?.(
          normalizedBounds,
        );
        onRuntimeReady?.(nextRuntime);
      }

      onStageReady?.({
        runtime: nextRuntime,
        failed: !nextRuntime,
      });
    });

    return () => {
      cancelled = true;
      runtime?.dispose();
      runtimeRef.current = null;
      onRuntimeReady?.(null);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.setColor?.(
      troop?.color || "#22d3ee",
    );
  }, [troop?.color]);

  useEffect(() => {
    runtimeRef.current?.setCharacterBounds?.(
      normalizedBounds,
    );
  }, [normalizedBounds]);

  useEffect(() => () => {
    window.clearTimeout(reactionTimerRef.current);
  }, []);

  useEffect(() => {
    if (
      quality.reduceMotion
      || !scanRef.current
    ) {
      return undefined;
    }

    const animation = animate(scanRef.current, {
      translateY: ["-120%", "600%"],
      opacity: [.04, .42, .04],
      duration: 3400,
      loop: true,
      ease: "linear",
    });

    return () => animation.cancel();
  }, [quality.reduceMotion]);

  return <section
    ref={stageRef}
    className={[
      "troop-stage",
      reacting ? "is-character-reacting" : "",
    ].filter(Boolean).join(" ")}
    aria-labelledby="troop-stage-title"
    style={{
      "--stage-arena": `url(${arenaUrl})`,
      "--troop-color": troop?.color,
      ...effectStyle,
    }}
  >
    <div
      className="troop-stage-arena"
      aria-hidden="true"
    />
    <div
      ref={mountRef}
      className="troop-stage-canvas"
      aria-hidden="true"
    />

    {failed && <LoadoutWebGLFallback />}
    {loading && !failed && <LoadoutLoading />}

    <div
      className="stage-character-overhead-glow"
      aria-hidden="true"
    />
    <div
      className="stage-character-floor-glow"
      aria-hidden="true"
    />

    {reactionId > 0 && <div
      key={reactionId}
      className="stage-character-click-pulse"
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </div>}

    <div
      className="loadout-stage-sprite"
      data-full-body-preview="true"
    >
      <AnimatedTroopPreview
        troop={troop}
        reduceMotion={quality.reduceMotion}
        fitMode="stage"
        reacting={reacting}
        onLayoutChange={handleCharacterLayout}
        onActivate={activateCharacter}
      />
    </div>

    <span
      ref={scanRef}
      className="loadout-stage-scan"
      aria-hidden="true"
    />

    <div
      className="stage-brackets"
      aria-hidden="true"
    >
      <i /><i /><i /><i />
    </div>

    <div className="stage-status">
      <span className="eyebrow">
        UNIDADE · {troop?.id?.toUpperCase()}
      </span>
      <h2 id="troop-stage-title">
        {troop?.label}
      </h2>
      {troop?.title && <small>{troop.title}</small>}
      <p>{troop?.role}</p>
      <strong className={selected ? "integrated" : ""}>
        {selected
          ? "INTEGRADO AO ESQUADRÃO"
          : "DISPONÍVEL"}
      </strong>
    </div>

    <div
      className="stage-telemetry"
      aria-hidden="true"
    >
      <span>BIO-SINAL 98.4</span>
      <span>LINK TÁTICO ESTÁVEL</span>
    </div>
  </section>;
}
