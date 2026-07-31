import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";
import { getProjectedMarkerPriority } from "../visual/declutterProjectedMarkers.js";

export default function CommandPhaseMarker({ phase, campaign, selected, register, onSelect }) {
  const state = getCampaignPhaseState(phase, campaign);
  const status = state.current ? "OPERAÇÃO ATUAL"
    : state.completed ? "CONCLUÍDA"
      : state.accessible ? "DISPONÍVEL" : "BLOQUEADA";
  const priority = getProjectedMarkerPriority({ ...state, selected });
  const symbol = state.locked ? "·"
    : state.current || selected ? phase.id.slice(-2)
      : state.boss ? "◇"
        : state.completed ? "•" : "○";
  return <button
    ref={(element) => register(phase.id, element)}
    type="button"
    className={`command-phase-marker is-${state.key} ${selected ? "is-selected" : ""} ${state.boss ? "is-boss" : ""}`}
    disabled={state.locked}
    aria-pressed={selected}
    aria-current={state.current ? "step" : undefined}
    aria-label={`Operação ${phase.id.slice(-2)}, ${phase.name}. ${status}${state.stars ? `, ${state.stars} estrelas` : ""}.`}
    title={`${phase.name} · ${status}`}
    data-marker-priority={priority}
    data-marker-current={state.current ? "true" : "false"}
    data-marker-selected={selected ? "true" : "false"}
    onClick={() => onSelect(phase)}
  >
    <span>{symbol}</span>
    {(state.current || selected) && <b>{state.current ? "OPERAÇÃO ATUAL" : phase.name}</b>}
    {selected && state.stars > 0 && <small aria-hidden="true">{"★".repeat(state.stars)}</small>}
  </button>;
}
