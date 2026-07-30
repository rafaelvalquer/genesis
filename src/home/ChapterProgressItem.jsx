import { motion } from "motion/react";

export default function ChapterProgressItem({ data, selected, onSelect, onPreview, reduceMotion }) {
  const { chapter, completed, total, accessible, percent, stars, state, unlocked, current } = data;
  return <motion.button
    type="button"
    role="tab"
    aria-selected={selected}
    className={`command-chapter ${current ? "current" : ""} ${selected ? "selected" : ""} ${!unlocked ? "locked" : ""}`}
    disabled={!unlocked}
    aria-label={`Capítulo ${chapter.number}, ${chapter.name}. ${state}. ${completed} de ${total} fases concluídas.`}
    onMouseEnter={() => unlocked && onPreview(chapter)}
    onMouseLeave={() => onPreview(null)}
    onFocus={() => unlocked && onPreview(chapter)}
    onBlur={() => onPreview(null)}
    onClick={() => onSelect(data)}
    whileHover={!unlocked && reduceMotion ? undefined : { y: -2 }}
  >
    <span><b>{String(chapter.number).padStart(2, "0")}</b><small>{state}</small></span>
    <strong>{chapter.name}</strong>
    <i className="command-progress-track"><i style={{ width: `${percent}%` }} /></i>
    <span className="command-chapter-data">{completed}/{total} CONCLUÍDAS · {accessible} ACESSÍVEIS · ★ {stars}</span>
  </motion.button>;
}
