import { motion } from "motion/react";

export default function ChapterProgressItem({
  data,
  selected,
  onSelect,
  reduceMotion,
}) {
  const {
    chapter,
    completed,
    total,
    accessible,
    percent,
    stars,
    state,
    unlocked,
    current,
  } = data;

  return <motion.button
    type="button"
    role="tab"
    id={`command-chapter-tab-${chapter.id}`}
    aria-controls="command-orbital-preview"
    aria-selected={selected}
    className={[
      "command-chapter",
      current ? "current" : "",
      selected ? "selected" : "",
      !unlocked ? "locked" : "",
    ].filter(Boolean).join(" ")}
    disabled={!unlocked}
    aria-label={`Capítulo ${chapter.number}, ${chapter.name}. ${state}. ${completed} de ${total} fases concluídas.`}
    onClick={() => onSelect(data)}
    whileHover={unlocked && !reduceMotion ? { y: -2 } : undefined}
    whileTap={unlocked && !reduceMotion ? { scale: .985 } : undefined}
  >
    <span>
      <b>{String(chapter.number).padStart(2, "0")}</b>
      <small>{selected ? "SELECIONADO" : state}</small>
    </span>
    <strong>{chapter.name}</strong>
    <i className="command-progress-track" aria-hidden="true">
      <i style={{ width: `${percent}%` }} />
    </i>
    <span className="command-chapter-data">
      {completed}/{total} CONCLUÍDAS · {accessible} ACESSÍVEIS · ★ {stars}
    </span>
  </motion.button>;
}
