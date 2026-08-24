export default function ConvoyCheckpointOverlay({ convoy, onReward, onContinue }) {
  if (convoy?.state !== "checkpointDecision" || !convoy.checkpointBriefingPending) return null;

  return (
    <section className="convoy-checkpoint-overlay" role="dialog" aria-modal="true" aria-labelledby="convoy-checkpoint-title">
      <div className="convoy-checkpoint-card">
        <span className="eyebrow">CHECKPOINT {convoy.checkpointsReached}/3 CONCLUÍDO</span>
        <h2 id="convoy-checkpoint-title">SETOR SEGURO</h2>
        <p>Escolha um único recurso para a próxima etapa.</p>
        <div className="convoy-checkpoint-resources">
          <span>TRANSPORTE <b>{Math.ceil(convoy.hp)}/{convoy.hpMax}</b></span>
          <span>RESERVA <b>{convoy.reserve}/{convoy.reserveMax}</b></span>
        </div>
        {!convoy.checkpointOptionChosen ? <div className="convoy-checkpoint-actions">
          <button type="button" className="primary-button" onClick={() => onReward("repair")}>REPARAR BLINDAGEM <small>+{convoy.repairAmount || 200} HP</small></button>
          <button type="button" className="secondary-button" onClick={() => onReward("refill")}>REABASTECER <small>+{convoy.reserveAmount || 40} RESERVA</small></button>
        </div> : <button type="button" className="primary-button convoy-start-button" onClick={onContinue}>PREPARAR SETOR {convoy.nextSector}</button>}
      </div>
    </section>
  );
}
