import { useState } from "react";
import ConvoyEscortStatus from "./ConvoyEscortStatus.jsx";

export default function ConvoyPreparationPanel({ convoy, supply, supplyMax, onStart }) {
  const [confirming, setConfirming] = useState(false);
  if (!convoy || convoy.state !== "checkpointPreparation") return null;
  const nextSector = Math.min(4, convoy.sector + 1);
  const start = () => {
    if (!convoy.escorted && !confirming) { setConfirming(true); return; }
    setConfirming(false); onStart?.();
  };
  return <aside className="convoy-preparation-panel" aria-labelledby="convoy-preparation-title">
    <span className="eyebrow">SETOR SEGURO</span>
    <h2 id="convoy-preparation-title">CHECKPOINT {convoy.checkpointsReached}/3</h2>
    <ConvoyEscortStatus convoy={convoy} />
    {confirming ? <div className="convoy-start-confirmation" role="alert">
      <strong>⚠ SEM ESCOLTA</strong>
      <p>O comboio permanecerá parado até uma tropa operacional estar na zona.</p>
      <div><button type="button" className="secondary-button" onClick={() => setConfirming(false)}>CANCELAR</button><button type="button" className="primary-button" onClick={start}>INICIAR MESMO ASSIM</button></div>
    </div> : <>
      <p>Reposicione suas tropas na zona ciano antes de avançar.</p>
      <small className="convoy-preparation-resources">🚚 {convoy.hpPercent}% · ⚡ {convoy.reserve}/{convoy.reserveMax} · Supply {supply}/{supplyMax}</small>
      <button type="button" className="primary-button convoy-start-button" onClick={start}>INICIAR SETOR {nextSector}</button>
    </>}
  </aside>;
}
