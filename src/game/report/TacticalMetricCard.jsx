export default function TacticalMetricCard({ label, value, tone = "cyan", detail, className = "" }) {
  return <article className={`tactical-metric tactical-metric-${tone} ${className}`}>
    <span className="tactical-stat-label">{label}</span>
    <strong className="tactical-stat-value">{value}</strong>
    {detail && <small>{detail}</small>}
  </article>;
}
