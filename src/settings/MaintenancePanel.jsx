import { useState } from "react";

export default function MaintenancePanel({ onReset }) {
  const [resetComplete, setResetComplete] = useState(false);
  const reset = () => {
    const completed = onReset?.();
    setResetComplete(completed !== false);
  };
  return <section className="maintenance-panel" aria-labelledby="maintenance-title">
    <span className="eyebrow">MANUTENÇÃO DO SISTEMA</span>
    <h2 id="maintenance-title">Dados locais da campanha</h2>
    <p>O progresso está salvo somente neste dispositivo. Esta ação é irreversível e restaura a campanha ao primeiro setor.</p>
    <button type="button" onClick={reset}>APAGAR PROGRESSO LOCAL</button>
    <span className="maintenance-feedback" role="status">{resetComplete ? "PROGRESSO LOCAL RESTAURADO" : ""}</span>
  </section>;
}
