import EnemyIntel from "./EnemyIntel.jsx";
import SquadAnalysis from "./SquadAnalysis.jsx";

const formatTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const mechanic = (phase) => {
  if (phase.environmentHazard?.id === "tide_cycle") return ["MARÉ DE NEREIDA", "A água avança durante a batalha."];
  if (phase.chapterMechanic) return ["ECOS DE VIDRO", `${Math.round(phase.chapterMechanic.chance * 100)}% de chance de retorno hostil.`];
  if (phase.environmentHazard?.id === "sandstorm") return ["TEMPESTADE DE AREIA", "Soterramento e redução temporária de alcance e cadência."];
  if (phase.environmentHazard?.id === "wind_current") return ["CORRENTES DE VENTO", "Rajadas podem deslocar formações numerosas."];
  return [`AMBIENTE · ${phase.environment}`, "Sem penalidades ambientais ocultas."];
};

export default function TacticalBrief({ phase, chapter, arenaUrl, troops, canConfirm, confirming, onConfirm }) {
  const [mechanicLabel, mechanicDescription] = mechanic(phase);
  return <aside className="tactical-brief">
    <div className="brief-arena"><img src={arenaUrl} alt={`Campo de batalha ${phase.name}`} /><span>ARENA SINCRONIZADA</span></div>
    <span className="eyebrow amber">INTELIGÊNCIA DA MISSÃO</span>
    <h2>{phase.name}</h2><p className="mission-subtitle">CAP. {chapter.number} · {phase.subtitle}</p>
    <dl className="mission-metrics">
      <div><dt>Ondas</dt><dd>{phase.waves.length}</dd></div>
      <div><dt>Energia</dt><dd>{phase.energy}</dd></div>
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
    <EnemyIntel phase={phase} />
    <SquadAnalysis troops={troops} />
    <button type="button" className="primary-button full loadout-confirm" disabled={!canConfirm || confirming} onClick={onConfirm}>
      {confirming ? "ESQUADRÃO SINCRONIZADO" : "CONFIRMAR LOADOUT"} <span>→</span>
    </button>
  </aside>;
}
