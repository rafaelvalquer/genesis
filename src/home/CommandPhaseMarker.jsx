import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";

export default function CommandPhaseMarker({ phase, campaign, selected, register, onSelect }) {
  const state = getCampaignPhaseState(phase, campaign);
  const status = state.current ? "OPERAÇÃO ATUAL"
    : state.completed ? "CONCLUÍDA"
      : state.accessible ? "DISPONÍVEL" : "BLOQUEADA";
  return <button
    ref={(element) => register(phase.id, element)}
    type="button"
    className={`command-phase-marker is-${state.key} ${selected ? "is-selected" : ""} ${state.boss ? "is-boss" : ""}`}
    disabled={state.locked}
    aria-pressed={selected}
    aria-label={`Operação ${phase.id.slice(-2)}, ${phase.name}. ${status}${state.stars ? `, ${state.stars} estrelas` : ""}.`}
    title={`${phase.name} · ${status}`}
    onClick={() => onSelect(phase)}
  >
    <span>{state.locked ? "◇" : state.boss ? "◆" : phase.id.slice(-2)}</span>
    {(state.current || selected) && <b>{state.current ? "OPERAÇÃO ATUAL" : phase.name}</b>}
    {state.completed && <small>{"★".repeat(state.stars)}</small>}
  </button>;
}
