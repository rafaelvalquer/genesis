import ConvoyEscortStatus from "./ConvoyEscortStatus.jsx";

export default function ConvoyHud({ convoy, energy, energyMax }) {
  if (!convoy) return null;
  const mode = convoy.state === "checkpointPreparation" ? `CHECKPOINT ${convoy.checkpointsReached}/3 · PREPARAÇÃO` : convoy.state === "sectorCountdown" ? "SETOR INICIANDO" : `SETOR ${convoy.sector} / 4`;
  return <section className={`convoy-hud ${convoy.underAttack ? "danger" : convoy.escorted ? "active" : "warning"}`} aria-label="Status do transporte">
    <div className="convoy-hud-primary"><strong aria-label="Integridade do transporte">🚚 {convoy.hp} / {convoy.hpMax}</strong><span className="convoy-hud-mode">{mode}</span><ConvoyEscortStatus convoy={convoy} compact /><span>⚡ {energy} / {energyMax}</span><span>🚚⚡ {convoy.reserve} / {convoy.reserveMax}</span></div>
    <progress aria-label="Integridade do comboio" max="100" value={convoy.hpPercent}>{convoy.hpPercent}%</progress>
    <div className="convoy-hud-progress"><span>{Math.round(convoy.progress * 100)}%</span><div className="convoy-checkpoints" aria-label={`${convoy.checkpointsReached} de 3 checkpoints alcançados`}>
      {[0, 1, 2].map((index) => <i key={index} className={index < convoy.checkpointsReached ? "reached" : ""}>◆</i>)}<i className={convoy.progress >= 1 ? "reached" : ""}>🏁</i>
    </div></div>
  </section>;
}
