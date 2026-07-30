import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";
import { getProjectedMarkerPriority } from "../visual/declutterProjectedMarkers.js";

export default function CommandPhaseMarker({
  phase,
  campaign,
  selected,
  register,
  onSelect,
}) {
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
    className={[
      "command-phase-marker",
      `is-${state.key}`,
      selected ? "is-selected" : "",
      state.boss ? "is-boss" : "",
    ].filter(Boolean).join(" ")}
    disabled={state.locked}
    aria-pressed={selected}
    aria-current={state.current ? "step" : undefined}
    aria-label={[
      `Operação ${phase.id.slice(-2)}, ${phase.name}.`,
      status,
      state.stars ? `, ${state.stars} estrelas.` : ".",
    ].join(" ")}
    title={`${phase.name} · ${status}`}
    data-marker-priority={priority}
    data-marker-current={state.current ? "true" : "false"}
    data-marker-selected={selected ? "true" : "false"}
    data-prevent-globe-drag="true"
    /*
     * Sem estes bloqueios, o onPointerDown do palco orbital recebe o evento,
     * executa setPointerCapture e o clique deixa de chegar ao marcador.
     */
    onPointerDown={(event) => event.stopPropagation()}
    onPointerMove={(event) => event.stopPropagation()}
    onPointerUp={(event) => event.stopPropagation()}
    onPointerCancel={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onSelect(phase);
    }}
  >
    <span>{symbol}</span>
    {(state.current || selected) && (
      <b>{state.current ? "OPERAÇÃO ATUAL" : phase.name}</b>
    )}
    {selected && state.stars > 0 && (
      <small aria-hidden="true">{"★".repeat(state.stars)}</small>
    )}
  </button>;
}
