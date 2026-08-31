import TacticalProgressBar from "../TacticalProgressBar.jsx";
import { formatDuration } from "../tacticalFormatters.js";

export default function RoutesTab({ routes = [] }) {
  return <div className="tactical-tab-content tactical-routes"><header className="tactical-section-heading"><span>PRESSÃO POR ROTA</span><strong>{routes.length}</strong></header>{routes.map((route) => <article className={`tactical-route ${route.criticalMs > 0 ? "is-critical" : ""}`} key={route.row}><header><span>Rota {route.row + 1}</span><b>{route.criticalMs > 0 ? "CRÍTICA" : "ESTÁVEL"}</b></header><TacticalProgressBar label="Pressão média" value={route.averagePressure} /><small>{route.criticalMs > 0 ? `${formatDuration(route.criticalMs)} em estado crítico` : "Nenhum estado crítico registrado"}</small></article>)}</div>;
}
