export default function LoadoutHeader({ phase, chapter, selectedCount, limit, onBack, onMissionInfo }) {
  const limitLabel = ({ 4: "quatro", 5: "cinco", 6: "seis", 7: "sete" })[limit] || String(limit);
  return <header className="loadout-header-new">
    <button type="button" className="loadout-back" onClick={onBack}>← CAMPANHA</button>
    <div>
      <span className="eyebrow">CAPÍTULO {chapter.number} · PROTOCOLO {phase.id.replace("_", " ")}</span>
      <h1>Baia de preparação tática</h1>
      <p>{phase.name} · Escolha de uma a {limitLabel} unidades para a operação.</p>
    </div><button type="button" className="loadout-mission-info" onClick={onMissionInfo}>⌁ MISSÃO</button>
    <div className="loadout-counter" aria-label={`${selectedCount} de ${limit} unidades selecionadas`}>
      <strong>{selectedCount}</strong><span>/ {limit}<small>sincronizadas</small></span>
    </div>
  </header>;
}
