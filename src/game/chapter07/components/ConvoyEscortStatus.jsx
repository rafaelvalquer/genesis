export default function ConvoyEscortStatus({ convoy, compact = false }) {
  if (!convoy) return null;
  const label = convoy.underAttack ? "SOB ATAQUE" : convoy.escorted ? "ESCOLTA ATIVA" : "SEM ESCOLTA";
  const className = convoy.underAttack ? "convoy-under-attack" : convoy.escorted ? "convoy-escort-ready" : "convoy-escort-missing";
  return <span className={`convoy-escort-status ${className}`}>
    <b aria-hidden="true">{convoy.underAttack ? "⚠" : convoy.escorted ? "●" : "⚠"}</b> {label}
    {!compact && <small>{convoy.escortCount || 0} tropas operacionais</small>}
  </span>;
}
