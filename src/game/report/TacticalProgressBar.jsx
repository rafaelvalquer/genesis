import { formatPercent } from "./tacticalFormatters.js";

export default function TacticalProgressBar({ label, value = 0, amount, tone = "cyan" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={`tactical-progress tactical-progress-${tone}`}>
    <div><span className="tactical-stat-label">{label}</span><strong>{formatPercent(safeValue)}</strong></div>
    <div className="tactical-progress-track" aria-label={`${label}: ${formatPercent(safeValue)}`} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeValue}><i style={{ width: `${safeValue}%` }} /></div>
    {amount != null && <small>{amount}</small>}
  </div>;
}
