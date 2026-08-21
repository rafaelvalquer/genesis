import EnemyIntel from "./EnemyIntel.jsx";
import SquadAnalysis from "./SquadAnalysis.jsx";
import { getMissionEncounterCount, getProgressionLabel } from "../game/missionProgression.js";

const formatTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const mechanic = (phase) => {
  if (phase.progressionMode === "convoy") return ["ESCOLTA LOGÍSTICA", "R3 é exclusiva do transporte. Mantenha uma tropa operacional em R2 ou R4 e reorganize a patrulha nos três checkpoints."];
  if (phase.environmentHazard?.id === "tide_cycle") return ["MARÉ DE NEREIDA", "A água avança durante a batalha."];
  if (phase.environmentHazard?.id === "thermal_cycle") return ["TERRENO MAGMÁTICO", "Sem Plataforma Térmica, apenas o Drone Sentinela pode ser implantado no magma."];
  if (phase.chapterMechanic) return ["ECOS DE VIDRO", `${Math.round(phase.chapterMechanic.chance * 100)}% de chance de retorno hostil.`];
  if (phase.environmentHazard?.id === "sandstorm") return ["TEMPESTADE DE AREIA", "Soterramento e redução temporária de alcance e cadência."];
  if (phase.environmentHazard?.id === "wind_current") return ["CORRENTES DE VENTO", "Rajadas podem deslocar formações numerosas."];
  return [`AMBIENTE · ${phase.environment}`, "Sem penalidades ambientais ocultas."];
};

export default function TacticalBrief({ phase, chapter, arenaUrl, troops, unlockedPhaseIndex, canConfirm, confirming, onConfirm }) {
  const [mechanicLabel, mechanicDescription] = mechanic(phase);
  return <aside className="tactical-brief">
    <div className="brief-arena"><img src={arenaUrl} alt={`Campo de batalha ${phase.name}`} /><span>ARENA SINCRONIZADA</span></div>
    <span className="eyebrow amber">INTELIGÊNCIA DA MISSÃO</span>
    <h2>{phase.name}</h2><p className="mission-subtitle">CAP. {chapter.number} · {phase.subtitle}</p>
    <dl className="mission-metrics">
      <div><dt>{getProgressionLabel(phase)}</dt><dd>{getMissionEncounterCount(phase)}</dd></div>
      <div><dt>Energia</dt><dd>{phase.energy}</dd></div>
      {phase.progressionMode === "convoy" && <><div><dt>Reserva</dt><dd>{phase.convoy.reserveInitial} / {phase.convoy.reserveMax}</dd></div><div><dt>Checkpoints</dt><dd>{phase.convoy.checkpointProgress.length}</dd></div><div><dt>Supply</dt><dd>{phase.supplyLimit}</dd></div></>}
      <div><dt>Integridade</dt><dd>{phase.baseIntegrity ?? 100}%</dd></div>
      <div><dt>Cadência</dt><dd>{(phase.cadenceMs / 1000).toFixed(2)}s</dd></div>
      <div><dt>Tempo-alvo</dt><dd>{formatTime(phase.targetDurationMs)}</dd></div>
      <div><dt>Chefe</dt><dd>{phase.boss ? "CONFIRMADO" : "NÃO"}</dd></div>
    </dl>
    <div className={`environment-note ${phase.chapterMechanic || phase.environmentHazard ? "mechanic-warning" : ""}`}><b>{mechanicLabel}</b><span>{mechanicDescription}</span></div>
    {phase.environmentHazard?.id === "tide_cycle" && <div className="tide-brief-details">
      <ul>
        <li>Células alagadas bloqueiam novas implantações.</li>
        <li>Minas podem ser desativadas.</li>
        <li>Reatores podem parar em fases avançadas.</li>
        <li>Inimigos aquáticos ficam mais perigosos.</li>
      </ul>
      <strong>UNIDADES ANFÍBIAS RECOMENDADAS</strong>
    </div>}
    {phase.environmentHazard?.id === "thermal_cycle" && <div className="tide-brief-details"><ul><li>Plataformas acumulam calor durante a atividade vulcânica.</li><li>A 100%, elas perdem HP e reduzem a cadência da tropa para 75%.</li><li>Se o suporte quebrar, instale outro sob a tropa para apagar o fogo.</li></ul><strong>PLATAFORMA TÉRMICA RECOMENDADA</strong></div>}
    <EnemyIntel phase={phase} unlockedPhaseIndex={unlockedPhaseIndex} />
    <SquadAnalysis troops={troops} />
    <button type="button" className="primary-button full loadout-confirm" disabled={!canConfirm || confirming} onClick={onConfirm}>
      {confirming ? "ESQUADRÃO SINCRONIZADO" : "CONFIRMAR LOADOUT"} <span>→</span>
    </button>
  </aside>;
}
