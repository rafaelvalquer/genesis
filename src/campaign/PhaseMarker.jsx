import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { motion } from "motion/react";

export default function PhaseMarker({
  phase, index, locked, selected, completed, stars, current, registerMarker, onSelect, reduceMotion,
}) {
  const pulseRef = useRef(null);

  useEffect(() => {
    if (reduceMotion || locked || completed || !pulseRef.current) return undefined;
    const animation = animate(pulseRef.current, {
      scale: [0.75, 1.65],
      opacity: [0.75, 0],
      duration: 1600,
      loop: true,
      ease: "out(3)",
    });
    return () => animation.cancel();
  }, [completed, locked, reduceMotion]);

  const state = locked ? "bloqueada" : completed ? "concluída" : "disponível";
  return <div ref={(node) => registerMarker(phase.id, node)} className="phase-marker-anchor">
    <motion.button
      type="button"
      className={[
        "phase-marker",
        locked && "is-locked",
        selected && "is-selected",
        completed && "is-completed",
        stars === 3 && "is-perfect",
        phase.boss && "is-boss",
        current && "is-current",
      ].filter(Boolean).join(" ")}
      disabled={locked}
      aria-label={`${phase.name}, fase ${index + 1}, ${state}, ${stars} de 3 estrelas`}
      aria-pressed={selected}
      title={locked ? "Setor bloqueado — conclua a operação anterior" : `${phase.name} — ${phase.subtitle}`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(phase);
      }}
      whileHover={reduceMotion ? undefined : { scale: 1.1 }}
      whileTap={reduceMotion ? undefined : { scale: .92 }}
    >
      <span ref={pulseRef} className="marker-pulse" aria-hidden="true" />
      <span className="marker-beam" aria-hidden="true" />
      <span className="marker-core" aria-hidden="true">{locked ? "◆" : phase.boss ? "◉" : String(index + 1).padStart(2, "0")}</span>
      {stars === 3 && <span className="marker-perfect" aria-hidden="true">★</span>}
      <span className="marker-tooltip" role="tooltip">{locked ? "DADOS CRIPTOGRAFADOS" : phase.name}</span>
    </motion.button>
  </div>;
}
