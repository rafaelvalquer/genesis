import TacticalInsightCard from "../TacticalInsightCard.jsx";
import TacticalMetricCard from "../TacticalMetricCard.jsx";
import { formatNumber, formatPercent } from "../tacticalFormatters.js";

export default function OverviewTab({ report }) {
  const summary = report.summary;
  const efficiency = Math.max(0, Math.min(100, summary.efficiency || 0));
  const insights = report.insights?.slice(0, 2) || [];
  const route = report.routes?.find((entry) => entry.row === summary.mostPressuredRoute);
  return <div className="tactical-tab-content tactical-overview">
    <div className="tactical-overview-lead">
      <article className="tactical-efficiency"><span className="tactical-stat-label">Eficiência operacional</span><div className="tactical-efficiency-ring" style={{ "--efficiency": efficiency }}><strong>{formatPercent(efficiency)}</strong></div><small>ÍNDICE AGREGADO</small></article>
      <div className="tactical-insight-stack">{insights.length ? insights.map((insight) => <TacticalInsightCard key={insight.id} insight={insight} />) : <TacticalInsightCard insight={{ severity: "positive", title: "Defesa eficiente", message: "Nenhuma vulnerabilidade tática relevante foi identificada." }} />}</div>
    </div>
    <div className="tactical-metric-grid">
      <TacticalMetricCard label="Dano causado" value={formatNumber(summary.damageDealt)} detail="COMBATE" />
      <TacticalMetricCard label="Energia gerada" value={formatNumber(summary.energyGenerated)} detail="LOGÍSTICA" />
      <TacticalMetricCard label="Baixas" value={formatNumber(summary.troopsLost)} detail="SOBREVIVÊNCIA" tone={summary.troopsLost ? "danger" : "positive"} />
    </div>
    <div className="tactical-secondary-metrics">
      <TacticalMetricCard label="Energia perdida" value={formatNumber(summary.energyWasted)} tone="amber" />
      <TacticalMetricCard label={route?.criticalMs > 0 ? "Rota crítica" : "Rota mais pressionada"} value={summary.mostPressuredRoute == null ? "—" : `R${summary.mostPressuredRoute + 1}`} tone={route?.criticalMs > 0 ? "danger" : "cyan"} />
    </div>
  </div>;
}
