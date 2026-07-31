import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTroopPreviewFrames } from "./useTroopPreviewFrames.js";
import { getLoadoutStageVisual } from "./loadoutVisualCatalog.js";
import {
  calculateFullBodyPreviewLayout,
  measureTroopPreviewSource,
} from "./troopPreviewFit.js";
import {
  translatePreviewLayoutToStage,
} from "./troopStageEffects.js";
import "./loadout-full-body-preview.css";

function sameLayout(left, right) {
  if (!left || !right) return false;

  return ["left", "top", "width", "height"].every(
    (key) => Math.abs(left[key] - right[key]) < .25,
  );
}

function sameBounds(left, right) {
  if (!left || !right) return false;

  return [
    "left",
    "top",
    "right",
    "bottom",
    "stageWidth",
    "stageHeight",
  ].every(
    (key) => Math.abs(left[key] - right[key]) < .5,
  );
}

export default function AnimatedTroopPreview({
  troop,
  reduceMotion,
  className = "",
  fitMode = "default",
  reacting = false,
  onLayoutChange,
  onActivate,
}) {
  const frameRef = useRef(null);
  const reportedBoundsRef = useRef(null);
  const {
    src,
    fitSrc,
    animated,
    visual,
  } = useTroopPreviewFrames(troop, reduceMotion);
  const [layout, setLayout] = useState(null);

  const stageVisual = useMemo(
    () => getLoadoutStageVisual(troop),
    [troop],
  );

  useEffect(() => {
    if (
      fitMode !== "stage"
      || !fitSrc
      || !frameRef.current
    ) {
      setLayout(null);
      reportedBoundsRef.current = null;
      onLayoutChange?.(null);
      return undefined;
    }

    let cancelled = false;
    let measurement = null;
    const frame = frameRef.current;

    const updateLayout = () => {
      if (
        cancelled
        || !measurement
        || !frame.isConnected
      ) {
        return;
      }

      const nextLayout = calculateFullBodyPreviewLayout({
        containerWidth: frame.clientWidth,
        containerHeight: frame.clientHeight,
        imageWidth: measurement.imageWidth,
        imageHeight: measurement.imageHeight,
        bounds: measurement.bounds,
        scale: stageVisual.scale,
        offsetX: stageVisual.offsetX,
        offsetY: stageVisual.offsetY,
        paddingX: stageVisual.paddingX,
        paddingY: stageVisual.paddingY,
      });

      setLayout((current) => (
        sameLayout(current, nextLayout)
          ? current
          : nextLayout
      ));

      const stage = frame.closest(".troop-stage");
      if (!stage) return;

      const nextBounds = translatePreviewLayoutToStage({
        layout: nextLayout,
        frameRect: frame.getBoundingClientRect(),
        stageRect: stage.getBoundingClientRect(),
      });

      if (
        nextBounds
        && !sameBounds(
          reportedBoundsRef.current,
          nextBounds,
        )
      ) {
        reportedBoundsRef.current = nextBounds;
        onLayoutChange?.(nextBounds);
      }
    };

    measureTroopPreviewSource(fitSrc).then((result) => {
      if (cancelled) return;
      measurement = result;
      updateLayout();
    });

    const resizeObserver = (
      typeof ResizeObserver === "function"
    )
      ? new ResizeObserver(updateLayout)
      : null;

    resizeObserver?.observe(frame);
    window.addEventListener("resize", updateLayout);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener(
        "resize",
        updateLayout,
      );
    };
  }, [
    fitMode,
    fitSrc,
    onLayoutChange,
    stageVisual.offsetX,
    stageVisual.offsetY,
    stageVisual.paddingX,
    stageVisual.paddingY,
    stageVisual.scale,
  ]);

  if (!troop || !src) return null;

  const image = <img
    className={[
      "loadout-animated-troop",
      animated ? "is-animated" : "",
      fitMode === "stage"
        ? "is-full-body-preview"
        : "",
      reacting ? "is-reacting" : "",
      className,
    ].filter(Boolean).join(" ")}
    src={src}
    alt={`Projeção holográfica de ${troop.label}`}
    draggable="false"
    data-fit-mode={fitMode}
    data-fit-ready={layout ? "true" : "false"}
    style={fitMode === "stage"
      ? {
        left: layout
          ? `${layout.left}px`
          : undefined,
        top: layout
          ? `${layout.top}px`
          : undefined,
        width: layout
          ? `${layout.width}px`
          : undefined,
        height: layout
          ? `${layout.height}px`
          : undefined,
        "--sprite-flip": stageVisual.flipX
          ? -1
          : 1,
      }
      : {
        "--sprite-scale": visual.scale,
        "--sprite-x": `${visual.offsetX}px`,
        "--sprite-y": `${visual.offsetY}px`,
        "--sprite-flip": visual.flipX ? -1 : 1,
      }}
  />;

  if (fitMode !== "stage") return image;

  const hitboxStyle = layout
    ? {
      left: `${layout.body.left}px`,
      top: `${layout.body.top}px`,
      width: `${layout.body.width}px`,
      height: `${layout.body.height}px`,
    }
    : undefined;

  return <span
    ref={frameRef}
    className={[
      "loadout-full-body-frame",
      reacting ? "is-reacting" : "",
    ].filter(Boolean).join(" ")}
  >
    {image}
    <button
      type="button"
      className="loadout-character-hitbox"
      aria-label={`Ativar projeção de ${troop.label}`}
      title={`Interagir com ${troop.label}`}
      style={hitboxStyle}
      disabled={!layout}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.({
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }}
    />
  </span>;
}
