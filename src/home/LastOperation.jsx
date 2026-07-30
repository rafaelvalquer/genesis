import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { getChapterForPhase, PHASES } from "../game/content.js";
import { formatCommandDate, formatCommandTime } from "./commandMetrics.js";

export default function LastOperation({ operation, reduceMotion }) {
  if (!operation) return <motion.section className="last-operation command-module command-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <header><span className="command-kicker">ARQUIVO DE CAMPO</span><h2>ÚLTIMO RELATÓRIO</h2></header>
    <p>NENHUM RELATÓRIO DE CAMPO REGISTRADO</p>
    <Link to={`/jogar/${PHASES[0].id}`}>PREPARAR PRIMEIRA OPERAÇÃO →</Link>
  </motion.section>;
  const { phase, stats } = operation;
  const chapter = getChapterForPhase(phase);
  return <motion.section className="last-operation command-module" whileHover={reduceMotion ? undefined : { y: -2 }}>
    <header><span className="command-kicker">ARQUIVO DE CAMPO</span><h2>ÚLTIMO RELATÓRIO</h2></header>
    <div className={`last-operation-outcome ${stats.lastOutcome === "victory" ? "victory" : "defeat"}`}>
      <span>{stats.lastOutcome === "victory" ? "VITÓRIA CONFIRMADA" : "RETIRADA REGISTRADA"}</span>
      <b>OPERAÇÃO {phase.id.slice(-2)}</b>
    </div>
    <h3>{phase.name}</h3>
    <p>CAPÍTULO {chapter.number} · {formatCommandDate(stats.lastPlayedAt)}</p>
    <dl>
      <div><dt>ESTRELAS</dt><dd>{Number(stats.bestStars || 0)}/3</dd></div>
      <div><dt>TEMPO</dt><dd>{formatCommandTime(stats.bestTimeMs)}</dd></div>
      <div><dt>INTEGRIDADE</dt><dd>{Number(stats.bestIntegrity || 0)}%</dd></div>
      <div><dt>TENTATIVAS</dt><dd>{Number(stats.attempts || 0)}</dd></div>
    </dl>
    <div className="module-actions">
      <Link to={`/jogar/${phase.id}`}>REPETIR</Link>
      <Link to={`/fases?capitulo=${chapter.number}&fase=${phase.id}`}>VER NO MAPA</Link>
    </div>
  </motion.section>;
}
