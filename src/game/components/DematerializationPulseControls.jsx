import { DEMATERIALIZATION_PULSE, getDematerializationPulseTargets } from "../dematerializationPulse.js";
import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import "./dematerializationPulseControls.css";

export function getDematerializationPulseControls(session) {
  if (!session || session.outcome || !(session.waveActive || session.sandbox)) return [];
  return (session.dematerializationPulses || []).map((pulse) => {
    const targets = getDematerializationPulseTargets(session, pulse.row);
    return {
      id: pulse.id,
      row: pulse.row,
      state: pulse.state,
      fireAt: pulse.fireAt,
      targetCount: targets.length,
      potentialDamage: targets.reduce(
      (total, enemy) =>
        total + Math.min(Number(enemy.hp) || 0, DEMATERIALIZATION_PULSE.damage),
      0,
      ),
    };
  });
}

export function DematerializationPulseControls({ controls, session, elapsed, onActivate }) {
  // Session support is temporary compatibility for direct consumers/tests.
  const pulses = controls || getDematerializationPulseControls(session);
  const battleElapsed = elapsed ?? session?.elapsed ?? 0;
  return pulses.map((pulse) => {
    const ready = pulse.state === "ready";
    const charging = pulse.state === "charging";
    const targetCount = pulse.targetCount || 0;
    const potentialDamage = pulse.potentialDamage || 0;
    const remainingMs = charging
      ? Math.max(0, Number(pulse.fireAt || 0) - Number(battleElapsed || 0))
      : 0;
    const disabled = !ready || targetCount === 0;
    const cannonX = FIELD.defenseCol * CELL.width + CELL.width / 2;
    const cannonY =
      VIEWPORT.fieldOffsetY + pulse.row * CELL.height + CELL.height / 2;
    // Botão compacto no canto superior direito do próprio canhão: próximo o suficiente
    // para deixar clara a relação espacial, sem cobrir a primeira célula de tropas.
    const left = ((cannonX + 42) / VIEWPORT.width) * 100;
    const top = ((cannonY - 36) / VIEWPORT.height) * 100;
    const status = charging
      ? `${(remainingMs / 1000).toFixed(1)}s`
      : pulse.state === "spent"
        ? "USADO"
        : "";

    return (
      <button
        key={pulse.id}
        type="button"
        className={`dematerialization-pulse-control state-${pulse.state}`}
        style={{ left: `${left}%`, top: `${top}%` }}
        disabled={disabled}
        aria-label={`Canhão da rota ${pulse.row + 1}. ${ready ? `${DEMATERIALIZATION_PULSE.damage} de dano em ${targetCount} inimigos` : charging ? "Carregando" : "Já utilizado"}`}
        title={
          ready
            ? targetCount > 0
              ? `Disparar pulso na rota ${pulse.row + 1} · ${DEMATERIALIZATION_PULSE.damage} de dano em cada inimigo · dano útil estimado ${potentialDamage}`
              : `Rota ${pulse.row + 1} sem inimigos válidos`
            : charging
              ? `Canhão carregando · ${(remainingMs / 1000).toFixed(1)}s`
              : `Canhão da rota ${pulse.row + 1} já utilizado`
        }
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) onActivate?.(pulse.row);
        }}
      >
        <span className="pulse-control-icon" aria-hidden="true">
          ⚡
        </span>
        <span className="pulse-control-value">{status}</span>
        <span className="pulse-control-label">
          {charging ? "CARREGANDO" : ready ? "DISPARAR" : ""}
        </span>
      </button>
    );
  });
}

export default DematerializationPulseControls;
