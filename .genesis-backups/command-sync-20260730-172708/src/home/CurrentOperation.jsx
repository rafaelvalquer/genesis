import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { getArenaUrl, getEnemyPreviewUrl } from "../game/assetCatalog.js";

function mechanicFor(phase, chapter) {
  if (phase.chapterMechanic) return chapter.mechanic?.label || "Ecos de Vidro";
  if (phase.environmentHazard?.id === "sandstorm") return "Tempestade de Areia";
  if (phase.environmentHazard?.id === "wind_current") return "Correntes de Vento";
  return chapter.mechanic?.label || `Ambiente ${phase.environment}`;
}

function operationStatus(phaseState, previewing) {
  if (phaseState?.current) return "OPERAÇÃO ATUAL";
  if (phaseState?.completed) return "OPERAÇÃO CONCLUÍDA";
  if (phaseState?.accessible && previewing) return "OPERAÇÃO SELECIONADA";
  if (phaseState?.accessible) return "PRÓXIMA OPERAÇÃO";
  return "OPERAÇÃO BLOQUEADA";
}

function actionLabel(phaseState) {
  if (phaseState?.completed) return "REPETIR OPERAÇÃO";
  return "PREPARAR ESQUADRÃO";
}

export default function CurrentOperation({
  phase,
  chapter,
  phaseState,
  enemies,
  previewing,
  reduceMotion,
}) {
  const status = operationStatus(phaseState, previewing);
  const hostileUnits = enemies.reduce(
    (total, entry) => total + Number(entry.count || 0),
    0,
  );
  const accessible = phaseState?.accessible !== false;

  return <motion.article
    layout
    className={`current-operation command-module operation-state-${phaseState?.key || "available"}`}
    data-operation-id={phase.id}
    aria-live="polite"
    aria-label={`${status}: ${phase.name}`}
  >
    <div className="operation-cover">
      <img src={getArenaUrl(phase.arenaId)} alt="" />
      <span>
        {phase.boss
          ? "ALVO PRIORITÁRIO"
          : `CAPÍTULO ${String(chapter.number).padStart(2, "0")}`}
      </span>
    </div>

    <header>
      <div className={`operation-selection-state is-${phaseState?.key || "available"}`}>
        <span>{status}</span>
        {phaseState?.stars > 0 && (
          <small aria-label={`${phaseState.stars} de 3 estrelas`}>
            {"★".repeat(phaseState.stars)}
          </small>
        )}
      </div>
      <span className="command-kicker">
        OPERAÇÃO {phase.id.slice(-2)} · {chapter.name.toUpperCase()}
      </span>
      <h2>{phase.name}</h2>
      <p>{phase.subtitle}</p>
    </header>

    <dl className="operation-parameters">
      <div><dt>ONDAS</dt><dd>{phase.waves.length}</dd></div>
      <div><dt>ENERGIA</dt><dd>{phase.energy}</dd></div>
      <div><dt>INTEGRIDADE</dt><dd>{phase.baseIntegrity}%</dd></div>
      <div><dt>SETOR</dt><dd>{phase.id.slice(-2)}</dd></div>
    </dl>

    <div className="operation-mechanic">
      <span>MECÂNICA AMBIENTAL</span>
      <b>{mechanicFor(phase, chapter)}</b>
    </div>

    <div className="operation-hostiles">
      <div className="operation-hostiles-heading">
        <span>HOSTIS PROJETADOS</span>
        <small>
          {enemies.length} {enemies.length === 1 ? "TIPO" : "TIPOS"}
          {" · "}
          {hostileUnits} {hostileUnits === 1 ? "UNIDADE" : "UNIDADES"}
        </small>
      </div>

      {enemies.length > 0
        ? <div className="operation-hostiles-list">
          {enemies.slice(0, 5).map((entry) => (
            <div
              key={`${entry.id}:${entry.variant || ""}`}
              title={`${entry.enemy?.label || entry.id}: ${entry.count} unidades, primeira onda ${entry.firstWave}`}
            >
              <img
                src={getEnemyPreviewUrl(entry.id)}
                alt={entry.enemy?.label || entry.id}
              />
              <b>{entry.count}</b>
              <small>O{entry.firstWave}</small>
            </div>
          ))}
        </div>
        : <p className="operation-hostiles-empty">
          Nenhum hostil catalogado para esta operação.
        </p>}
    </div>

    <div className="operation-actions">
      {accessible
        ? <motion.div whileTap={reduceMotion ? undefined : { scale: .98 }}>
          <Link
            className={`command-primary-action ${phaseState?.completed ? "is-repeat" : ""}`}
            to={`/jogar/${phase.id}`}
            aria-label={`${actionLabel(phaseState)}: ${phase.name}`}
          >
            {actionLabel(phaseState)} <span>→</span>
          </Link>
        </motion.div>
        : <button
          type="button"
          className="command-primary-action is-disabled"
          disabled
          aria-label={`${phase.name} está bloqueada`}
        >
          OPERAÇÃO BLOQUEADA <span>◇</span>
        </button>}
    </div>
  </motion.article>;
}
