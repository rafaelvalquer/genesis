import { WaveOutroCinematicOverlay } from "../waveOutro/WaveOutroCinematicOverlay.jsx";
import { DematerializationPulseControls } from "./DematerializationPulseControls.jsx";
import ColossusSpecialButtons from "./ColossusSpecialButtons.jsx";
import ConvoyCheckpointOverlay from "../chapter07/components/ConvoyCheckpointOverlay.jsx";
import ConvoySectorCountdown from "../chapter07/components/ConvoySectorCountdown.jsx";
import ConvoyToast from "../chapter07/components/ConvoyToast.jsx";

/** React overlay composition. It receives an already-derived model, never a renderer. */
export default function BattleOverlays({ model, actions, phase, settings }) {
  const { snapshot, notification, fortuneBlocksIntermission, dematerializationPulseControls, colossusControls } = model;
  return <>
    <ConvoySectorCountdown convoy={snapshot.convoy} />
    <ConvoyCheckpointOverlay convoy={snapshot.convoy} onReward={actions.onCheckpointReward} onContinue={actions.onCheckpointContinue} />
    {snapshot.integrity > 0 && (snapshot.integrity / snapshot.integrityMax) <= 0.25 && !snapshot.outcome && <div className="critical-base-vignette" aria-hidden="true" />}
    {!fortuneBlocksIntermission && snapshot.progressionMode !== "convoy" && <DematerializationPulseControls controls={dematerializationPulseControls} elapsed={snapshot.elapsed} onActivate={actions.onActivateDematerializationPulse} />}
    {!fortuneBlocksIntermission && <ColossusSpecialButtons controls={colossusControls} onActivate={actions.onActivateColossusSpecial} />}
    {snapshot.progressionMode === "convoy" && <div className="sr-only" aria-live="polite">
      Transporte: {snapshot.convoy?.hp} de {snapshot.convoy?.hpMax} de integridade. Percurso: {Math.round((snapshot.convoy?.progress || 0) * 100)}%. Checkpoint {snapshot.convoy?.checkpointsReached || 0} de 3. {snapshot.convoy?.underAttack ? "Transporte sob ataque." : "Setor estacionado."}
    </div>}
    {notification?.text && (snapshot.progressionMode === "convoy"
      ? <ConvoyToast message={notification.text} tone={notification.tone} />
      : <div className={`battle-notification tone-${notification.tone} ${notification.persistent ? "persistent" : ""}`} role={notification.tone === "action" ? "status" : "alert"}>
        <span>{notification.tone === "action" ? "◆" : "✓"}</span>{notification.text}
      </div>)}
    <WaveOutroCinematicOverlay outro={snapshot.waveOutro} phase={phase} reduceMotion={settings.reduceMotion} />
  </>;
}
