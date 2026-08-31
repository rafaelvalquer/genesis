export default function TacticalInsightCard({ insight }) {
  return <article className={`tactical-insight tactical-insight-${insight.severity || "positive"}`}>
    <span aria-hidden="true">{insight.severity === "critical" ? "!" : insight.severity === "warning" ? "△" : "✓"}</span>
    <div><small>AVALIAÇÃO DA OPERAÇÃO</small><strong>{insight.title}</strong><p>{insight.message}</p>{insight.recommendation && <em>{insight.recommendation}</em>}</div>
  </article>;
}
