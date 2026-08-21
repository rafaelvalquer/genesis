export default function ConvoyCheckpointOverlay({ convoy, supply, energy, onStart }) {
  if (convoy?.state !== "checkpointPreparation") return null;
  const nextSector = Math.min(4, convoy.sector + 1);
  return <section className="convoy-checkpoint-overlay" role="dialog" aria-modal="false" aria-labelledby="checkpoint-title">
    <span>SETOR SEGURO</span><h2 id="checkpoint-title">CHECKPOINT {convoy.checkpointsReached}/3</h2>
    <dl><div><dt>Comboio</dt><dd>{convoy.hpPercent}%</dd></div><div><dt>Energia</dt><dd>{energy}</dd></div><div><dt>Reserva</dt><dd>{convoy.reserve}/{convoy.reserveMax}</dd></div><div><dt>Supply</dt><dd>{supply}</dd></div></dl>
    <p>Selecione uma tropa no campo e depois um destino válido para reposicioná-la sem custo.</p>
    <button type="button" autoFocus onClick={onStart} aria-keyshortcuts="Enter">INICIAR SETOR {nextSector}</button>
  </section>;
}
