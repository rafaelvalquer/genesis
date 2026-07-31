import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { getArenaUrl, getEnemyPreviewUrl } from "../game/assetCatalog.js";

function mechanicFor(phase, chapter) {
  if (phase.chapterMechanic) return chapter.mechanic?.label || "Ecos de Vidro";
  if (phase.environmentHazard?.id === "sandstorm") return "Tempestade de Areia";
  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";
  return chapter.mechanic?.label || `Ambiente ${phase.environment}`;
}

export default function CurrentOperation({ phase, chapter, enemies, reduceMotion }) {
  return <motion.article layout className="current-operation command-module" aria-live="polite">
    <div className="operation-cover">
      <img src={getArenaUrl(phase.arenaId)} alt="" />
      <span>{phase.boss ? "ALVO PRIORITÁRIO" : `CAPÍTULO ${String(chapter.number).padStart(2, "0")}`}</span>
    </div>
    <header>
      <span className="command-kicker">PRÓXIMA OPERAÇÃO · {phase.id.toUpperCase().replace("_", " ")}</span>
      <h2>{phase.name}</h2>
      <p>{phase.subtitle}</p>
    </header>
    <dl className="operation-parameters">
      <div><dt>ONDAS</dt><dd>{phase.waves.length}</dd></div>
      <div><dt>ENERGIA</dt><dd>{phase.energy}</dd></div>
      <div><dt>INTEGRIDADE</dt><dd>{phase.baseIntegrity}%</dd></div>
      <div><dt>SETOR</dt><dd>{phase.id.slice(-2)}</dd></div>
    </dl>
    <div className="operation-mechanic"><span>MECÂNICA AMBIENTAL</span><b>{mechanicFor(phase, chapter)}</b></div>
    <div className="operation-hostiles">
      <span>HOSTIS PROJETADOS</span>
      <div>
        {enemies.slice(0, 5).map((entry) => <div key={`${entry.id}:${entry.variant || ""}`} title={`${entry.enemy?.label || entry.id}: ${entry.count} unidades, primeira onda ${entry.firstWave}`}>
          <img src={getEnemyPreviewUrl(entry.id)} alt={entry.enemy?.label || entry.id} />
          <b>{entry.count}</b><small>O{entry.firstWave}</small>
        </div>)}
      </div>
    </div>
    <div className="operation-actions">
      <motion.div whileTap={reduceMotion ? undefined : { scale: .98 }}>
        <Link className="command-primary-action" to={`/jogar/${phase.id}`} aria-label={`Preparar esquadrão para ${phase.name}`}>
          PREPARAR ESQUADRÃO <span>→</span>
        </Link>
      </motion.div>
    </div>
  </motion.article>;
}
