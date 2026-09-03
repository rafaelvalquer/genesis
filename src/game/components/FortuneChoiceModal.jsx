const RARITY_LABELS = { common: "COMUM", rare: "RARA", epic: "ÉPICA" };

export function FortuneChoiceModal({ tier, options, onChoose }) {
  return <div className="modal-backdrop fortune-overlay" role="dialog" aria-modal="true" aria-labelledby="fortune-title">
    <section className="decision-modal fortune-modal">
      <span className="eyebrow amber">PROTOCOLO FORTUNA · {tier === "critical" ? "SITUAÇÃO CRÍTICA" : "SITUAÇÃO DIFÍCIL"}</span>
      <h2 id="fortune-title">Transmissão aliada interceptada.</h2>
      <p>Selecione um recurso de emergência.</p>
      <div className="fortune-options">{options.map((option) => <button key={option.id} type="button" className={`fortune-option rarity-${option.rarity}`} onClick={() => onChoose(option.id)}>
        <small>{RARITY_LABELS[option.rarity]}</small><b>{option.label}</b><span>{option.description}</span>{option.requiresTarget && <em>REQUER SELEÇÃO DE ROTA</em>}
      </button>)}</div>
    </section>
  </div>;
}

export default FortuneChoiceModal;
