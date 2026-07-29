import { motion } from "motion/react";
import { getPhaseIndex } from "../game/content.js";

export default function ChapterRail({ chapters, activeChapter, campaign, onSelect }) {
  return <aside className="chapter-rail" aria-label="Capítulos da campanha">
    <header><span>TEATROS DE OPERAÇÃO</span><small>{chapters.length} BIOMAS MAPEADOS</small></header>
    <div className="chapter-rail-list">
      {chapters.map((chapter) => {
        const locked = getPhaseIndex(chapter.phaseIds[0]) > campaign.unlockedPhaseIndex;
        const complete = chapter.phaseIds.filter((id) => Number(campaign.phaseStats[id]?.victories || 0) > 0).length;
        const active = activeChapter.id === chapter.id;
        const previousPhase = chapters[chapter.number - 2]?.phaseIds.at(-1);
        return <motion.button
          key={chapter.id}
          type="button"
          className={active ? "active" : ""}
          disabled={locked}
          aria-current={active ? "page" : undefined}
          aria-label={locked ? `${chapter.name}, bloqueado. Conclua ${previousPhase?.replace("_", " ")}` : `${chapter.name}, ${complete} de ${chapter.phaseIds.length} concluídas`}
          title={locked ? `Conclua ${previousPhase?.replace("_", " ")} para liberar` : chapter.subtitle}
          onClick={() => onSelect(chapter)}
          whileHover={locked ? undefined : { x: -5 }}
          whileTap={locked ? undefined : { scale: .98 }}
        >
          {active && <motion.span className="chapter-active-indicator" layoutId="active-chapter" />}
          <span className="chapter-rail-number">{String(chapter.number).padStart(2, "0")}</span>
          <span className="chapter-rail-copy">
            <small>{locked ? "◆ ACESSO BLOQUEADO" : `${complete}/${chapter.phaseIds.length} CONCLUÍDAS`}</small>
            <b>{chapter.name}</b>
            <em>{chapter.subtitle}</em>
            <i><span style={{ width: `${complete / chapter.phaseIds.length * 100}%` }} /></i>
          </span>
        </motion.button>;
      })}
    </div>
  </aside>;
}
