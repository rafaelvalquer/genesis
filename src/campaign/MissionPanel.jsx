import { AnimatePresence, motion } from "motion/react";
import { ENEMIES } from "../game/content.js";
import { getArenaUrl } from "../game/assets/arenaCatalog.js";

const formatTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const total = Math.floor(milliseconds / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function mechanicFor(phase, chapter) {
  if (phase.chapterMechanic) return chapter.mechanic?.label || "Ecos de Vidro";
  if (phase.environmentHazard?.id === "sandstorm") return "Tempestade de Areia";
  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";
  if (phase.environmentHazard?.id === "tide_cycle") return "Maré Territorial Progressiva";
  return chapter.mechanic?.label || `Ambiente ${phase.environment}`;
}

export default function MissionPanel({ phase, chapter, stats, onPrepare, reduceMotion }) {
  const enemyTypes = [...new Set(phase.waves.flatMap((wave) => wave.enemies.map((enemy) => enemy.type)))];
  const stars = Number(stats.bestStars || 0);
  return <AnimatePresence>
    <motion.article
      key={phase.id}
      className="mission-panel"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
      transition={{ type: reduceMotion ? "tween" : "spring", stiffness: 220, damping: 26 }}
    >
      <div className="mission-preview">
        <img src={getArenaUrl(phase.arenaId)} alt="" />
        <span className="mission-preview-grid" aria-hidden="true" />
        <small>{phase.boss ? "ALVO PRIORITÁRIO" : "SETOR SELECIONADO"}</small>
      </div>
      <div className="mission-copy">
        <header>
          <span className="eyebrow">OPERAÇÃO {phase.id.replace("_", " ").toUpperCase()}</span>
          <h2>{phase.name}</h2>
          <p>{phase.subtitle}</p>
        </header>
        <dl className="mission-stats">
          <div><dt>Ondas</dt><dd>{phase.waves.length}</dd></div>
          <div><dt>Energia</dt><dd>{phase.energy}</dd></div>
          <div><dt>Melhor tempo</dt><dd>{formatTime(stats.bestTimeMs)}</dd></div>
          <div><dt>Integridade</dt><dd>{Number(stats.bestIntegrity || 0)}%</dd></div>
        </dl>
        <div className="mission-stars" aria-label={`${stars} de 3 estrelas`}>
          <span>AVALIAÇÃO</span>{[0, 1, 2].map((index) => <i key={index} className={index < stars ? "earned" : ""}>★</i>)}
        </div>
        <div className="mission-enemies"><span>HOSTIS ENCONTRADOS</span><p>{enemyTypes.slice(0, 5).map((type) => ENEMIES[type]?.label || type).join(" · ") || "Sem registros"}</p></div>
        <div className="mission-mechanic"><span>◇ MECÂNICA AMBIENTAL</span><b>{mechanicFor(phase, chapter)}</b></div>
        <motion.button
          type="button"
          className="prepare-operation"
          onClick={onPrepare}
          whileHover={reduceMotion ? undefined : { scale: 1.015 }}
          whileTap={reduceMotion ? undefined : { scale: .97 }}
        >PREPARAR OPERAÇÃO <span>→</span></motion.button>
      </div>
    </motion.article>
  </AnimatePresence>;
}
