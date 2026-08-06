import {
  useEffect,
  useRef,
} from "react";
import { animate } from "animejs";
import { motion } from "motion/react";
import {
  getProjectedMarkerPriority,
} from "../visual/declutterProjectedMarkers.js";

export default function PhaseMarker({
  phase,
  chapter,
  index,
  locked,
  selected,
  completed,
  stars,
  current,
  chapterActive,
  chapterUnlocked,
  registerMarker,
  onSelect,
  reduceMotion,
}) {
  const pulseRef = useRef(null);

  useEffect(() => {
    if (
      reduceMotion
      || locked
      || !chapterActive
      || (!current && !selected)
      || !pulseRef.current
    ) {
      return undefined;
    }

    const animation = animate(
      pulseRef.current,
      {
        scale: [.75, 1.65],
        opacity: [.75, 0],
        duration: 1600,
        loop: true,
        ease: "out(3)",
      },
    );

    return () => animation.cancel();
  }, [
    chapterActive,
    current,
    locked,
    reduceMotion,
    selected,
  ]);

  const state = locked
    ? "bloqueada"
    : completed
      ? "concluída"
      : "disponível";

  const priority = (
    getProjectedMarkerPriority({
      current: current && chapterActive,
      selected,
      boss: phase.boss,
      accessible: !locked,
      completed,
    })
  );

  const symbol = locked
    ? "·"
    : current || selected
      ? String(index + 1).padStart(2, "0")
      : phase.boss
        ? "◇"
        : completed
          ? "•"
          : "○";

  return (
    <div
      ref={(node) => (
        registerMarker(phase.id, node)
      )}
      className="phase-marker-anchor"
      data-marker-priority={priority}
      data-marker-current={
        current ? "true" : "false"
      }
      data-marker-selected={
        selected ? "true" : "false"
      }
      data-chapter-id={chapter?.id}
      data-chapter-active={
        chapterActive ? "true" : "false"
      }
      data-chapter-unlocked={
        chapterUnlocked ? "true" : "false"
      }
      style={{
        "--marker-chapter-color": (
          chapter?.palette?.primary
          || "#67e8f9"
        ),
      }}
    >
      <motion.button
        type="button"
        className={[
          "phase-marker",
          locked && "is-locked",
          selected && "is-selected",
          completed && "is-completed",
          phase.boss && "is-boss",
          current && "is-current",
          chapterActive
            ? "is-chapter-active"
            : "is-chapter-inactive",
          !chapterUnlocked
            && "is-chapter-locked",
        ].filter(Boolean).join(" ")}
        disabled={locked}
        aria-label={[
          chapter?.name,
          phase.name,
          `fase ${index + 1}`,
          state,
          `${stars} de 3 estrelas`,
        ].filter(Boolean).join(", ")}
        aria-pressed={selected}
        aria-current={
          current ? "step" : undefined
        }
        title={
          locked
            ? "Setor bloqueado — conclua a operação anterior"
            : `${chapter?.name || "Capítulo"} · ${phase.name} — ${phase.subtitle}`
        }
        onPointerDown={(event) => (
          event.stopPropagation()
        )}
        onPointerMove={(event) => (
          event.stopPropagation()
        )}
        onPointerUp={(event) => (
          event.stopPropagation()
        )}
        onPointerCancel={(event) => (
          event.stopPropagation()
        )}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(phase);
        }}
        whileHover={
          reduceMotion || locked
            ? undefined
            : {
              scale: chapterActive
                ? 1.1
                : 1.18,
            }
        }
        whileTap={
          reduceMotion || locked
            ? undefined
            : { scale: .92 }
        }
      >
        <span
          ref={pulseRef}
          className="marker-pulse"
          aria-hidden="true"
        />
        <span
          className="marker-beam"
          aria-hidden="true"
        />
        <span
          className="marker-core"
          aria-hidden="true"
        >
          {symbol}
        </span>

        {selected && stars > 0 && (
          <span
            className="marker-perfect"
            aria-hidden="true"
          >
            {"★".repeat(stars)}
          </span>
        )}

        {(
          selected
          || (current && chapterActive)
        ) && (
          <span className="marker-label">
            {selected
              ? phase.name
              : "OPERAÇÃO ATUAL"}
          </span>
        )}

        <span
          className="marker-tooltip"
          role="tooltip"
        >
          {locked
            ? "DADOS CRIPTOGRAFADOS"
            : `${chapter?.name || "CAPÍTULO"} · ${phase.name}`}
        </span>
      </motion.button>
    </div>
  );
}
