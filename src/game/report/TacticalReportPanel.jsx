import { useState } from "react";
import TacticalReportTabs from "./TacticalReportTabs.jsx";
import OverviewTab from "./tabs/OverviewTab.jsx";
import RoutesTab from "./tabs/RoutesTab.jsx";
import ThreatsTab from "./tabs/ThreatsTab.jsx";
import TimelineTab from "./tabs/TimelineTab.jsx";
import TroopsTab from "./tabs/TroopsTab.jsx";
import "./tacticalReport.css";

export default function TacticalReportPanel({ report, phase, onBack }) {
  const [tab, setTab] = useState("overview");
  const content = tab === "overview" ? <OverviewTab report={report} /> : tab === "troops" ? <TroopsTab troops={report.troops} /> : tab === "threats" ? <ThreatsTab threats={report.threats} summary={report.summary} /> : tab === "routes" ? <RoutesTab routes={report.routes} /> : <TimelineTab timeline={report.timeline} />;
  return <section className="tactical-report-panel"><header className="tactical-report-header"><div><span className="eyebrow">RELATÓRIO TÁTICO // {phase.id}</span><h2>Análise da operação</h2><small>REGISTRO PÓS-COMBATE</small></div><button type="button" className="tactical-report-back" onClick={onBack} title="Voltar ao resumo">← <span>Resumo</span></button></header><TacticalReportTabs activeTab={tab} onChange={setTab} /><section id={`tactical-panel-${tab}`} className="tactical-tab-panel" role="tabpanel" aria-labelledby={`tactical-tab-${tab}`}>{content}</section></section>;
}
