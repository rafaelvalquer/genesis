import { useMemo } from "react";

const STATUS_LABELS = Object.freeze({
  exiting: "Travando coordenadas da missão",
  covering: "Abrindo corredor orbital",
  navigating: "Transferindo comando",
  waiting: "Sincronizando baia tática",
  entering: "Baia tática disponível",
  error: "Transição interrompida",
});

export default function RouteTransitionLayer({
  transition,
}) {
  const payload = transition.payload || {};

  const style = useMemo(
    () => ({
      "--route-transition-primary": (
        payload.primary || "#22d3ee"
      ),
      "--route-transition-accent": (
        payload.accent || "#38bdf8"
      ),
      "--route-transition-origin-x": (
        payload.originX || "50%"
      ),
      "--route-transition-origin-y": (
        payload.originY || "48%"
      ),
      "--route-transition-image": (
        payload.arenaUrl
          ? `url("${payload.arenaUrl}")`
          : "none"
      ),
      "--route-transition-progress": (
        `${transition.progress}%`
      ),
    }),
    [
      payload.accent,
      payload.arenaUrl,
      payload.originX,
      payload.originY,
      payload.primary,
      transition.progress,
    ],
  );

  const hidden = transition.status === "idle";
  const statusLabel = (
    STATUS_LABELS[transition.status]
    || "Sincronizando rota"
  );

  return (
    <div
      className={[
        "route-transition-layer",
        `is-${transition.status}`,
        transition.reduceMotion
          ? "reduce-motion"
          : "",
      ].filter(Boolean).join(" ")}
      style={style}
      aria-hidden={hidden}
      aria-busy={!hidden}
    >
      <div
        className="route-transition-atmosphere"
        aria-hidden="true"
      />
      <div
        className="route-transition-grid"
        aria-hidden="true"
      />
      <div
        className="route-transition-content"
        role={hidden ? undefined : "status"}
        aria-live="polite"
      >
        <span className="route-transition-kicker">
          TRANSFERÊNCIA ORBITAL
        </span>
        <strong>
          {payload.label || "Operação selecionada"}
        </strong>
        <small>{statusLabel}</small>
        <div
          className="route-transition-progress"
          aria-hidden="true"
        >
          <i />
        </div>
      </div>
    </div>
  );
}
