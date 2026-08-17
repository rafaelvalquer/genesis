import { useEffect, useRef, useState } from "react";
import { getTroopPreviewUrl } from "../assets/troopPreviewCatalog.js";
import { TROOPS } from "../content.js";

export default function BattlePauseMenu({ phase, snapshot, loadout, onContinue, onRestart, onExit, reduceMotion }) {
  const [mode, setMode] = useState("menu");
  const firstButtonRef = useRef(null);
  const phaseNumber = Number(String(phase.id).match(/\d+$/)?.[0] || phase.id);
  const title = mode === "confirmRestart" ? "REINICIAR OPERAÇÃO?" : mode === "restarting" ? "REINICIALIZANDO OPERAÇÃO" : "SIMULAÇÃO PAUSADA";
  useEffect(() => { firstButtonRef.current?.focus(); }, [mode]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (mode === "restarting" || event.code !== "Escape") return;
      event.preventDefault();
      if (mode === "confirmRestart") setMode("menu");
      else onContinue();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, onContinue]);
  const confirm = async () => { setMode("restarting"); await onRestart(); };
  return <div className={`battle-pause-backdrop ${reduceMotion ? "reduce-motion" : ""}`} role="dialog" aria-modal="true" aria-labelledby="battle-pause-title">
    <div className="battle-pause-panel">
      <span className="battle-pause-kicker">GENESIS // CONTROLE DE OPERAÇÃO</span>
      <h2 id="battle-pause-title">{title}</h2>
      <p className="battle-pause-context">FASE {phaseNumber} · {phase.name}</p>
      {mode === "menu" && <>
        <p className="battle-pause-stats">ONDA {snapshot.wave} / {snapshot.totalWaves}<span>INTEGRIDADE {Math.round(snapshot.integrity / Math.max(1, snapshot.integrityMax) * 100)}%</span></p>
        <button ref={firstButtonRef} className="pause-action pause-primary" type="button" onClick={onContinue}>▶ CONTINUAR<small>Retornar imediatamente à batalha</small></button>
        <button className="pause-action pause-restart" type="button" onClick={() => setMode("confirmRestart")}>↻ REINICIAR FASE<small>Recomeçar com o mesmo esquadrão</small></button>
        <button className="pause-exit" type="button" onClick={onExit}>← SAIR PARA CAMPANHA</button>
        <small className="pause-hint">ESPAÇO · CONTINUAR</small>
      </>}
      {mode === "confirmRestart" && <>
        <p className="pause-confirm-copy">Todo o progresso desta tentativa será descartado. Você retornará ao início da fase com o mesmo esquadrão.</p>
        <span className="pause-loadout-label">ESQUADRÃO</span>
        <div className="pause-loadout">{loadout.map((id) => <span key={id} style={{ "--troop-color": TROOPS[id]?.color || "#22d3ee" }}><img src={getTroopPreviewUrl(id)} alt="" /></span>)}</div>
        <p className="pause-loadout-names">{loadout.map((id) => TROOPS[id]?.label || id).join(" · ")}</p>
        <div className="pause-confirm-actions"><button ref={firstButtonRef} type="button" className="pause-exit" onClick={() => setMode("menu")}>CANCELAR</button><button type="button" className="pause-action pause-restart" onClick={confirm}>↻ REINICIAR</button></div>
      </>}
      {mode === "restarting" && <p className="pause-restarting">Preparando a Onda 1 · preservando o esquadrão...</p>}
    </div>
  </div>;
}
