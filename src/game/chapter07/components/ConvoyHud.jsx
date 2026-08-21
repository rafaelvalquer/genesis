export default function ConvoyHud({ convoy, energy, energyMax }) {
  if (!convoy) return null;
  const label = convoy.underAttack ? "SOB ATAQUE" : convoy.escorted ? "ESCOLTADO" : "SEM ESCOLTA";
  return <section className={`convoy-hud ${convoy.underAttack ? "danger" : convoy.escorted ? "active" : "warning"}`} aria-label="Status do transporte" aria-live="polite">
    <div><span>TRANSPORTE</span><strong>{convoy.hp} / {convoy.hpMax}</strong></div>
    <progress aria-label="Integridade do comboio" max="100" value={convoy.hpPercent}>{convoy.hpPercent}%</progress>
    <div className="convoy-hud-grid"><span>Progresso <b>{Math.round(convoy.progress * 100)}%</b></span><span>Setor <b>{convoy.sector} / 4</b></span><span>Escolta <b>{label}</b></span><span>Energia <b>{energy} / {energyMax}</b></span><span>Reserva <b>{convoy.reserve} / {convoy.reserveMax}</b></span></div>
    <div className="convoy-checkpoints" aria-label={`${convoy.checkpointsReached} de 3 checkpoints alcançados`}>
      {[0, 1, 2].map((index) => <i key={index} className={index < convoy.checkpointsReached ? "reached" : ""}>◆</i>)}<i className={convoy.progress >= 1 ? "reached" : ""}>🏁</i>
    </div>
  </section>;
}
