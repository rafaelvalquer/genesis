import { TROOPS } from "../../content.js";
import TacticalProgressBar from "../TacticalProgressBar.jsx";
import { formatNumber, formatTacticalSpecial } from "../tacticalFormatters.js";

export default function TroopsTab({ troops = [] }) {
  const topDamage = Math.max(0, ...troops.map((troop) => troop.damageDealt || 0));
  return <div className="tactical-tab-content tactical-troops"><header className="tactical-section-heading"><span>TROPAS DESDOBRADAS</span><strong>{formatNumber(troops.reduce((total, troop) => total + (troop.deployed || 0), 0))}</strong></header>{troops.map((troop) => {
    const special = Object.entries(troop.special || {}).filter(([, value]) => Number(value) > 0);
    const isMvp = topDamage > 0 && troop.damageDealt === topDamage;
    return <article className="tactical-troop" key={troop.type}>
      <header><div><span className="tactical-stat-label">{TROOPS[troop.type]?.role || "Unidade de combate"}</span><h3>{TROOPS[troop.type]?.label || troop.type}</h3></div>{isMvp && <b className="tactical-mvp">✦ DESTAQUE DA OPERAÇÃO</b>}</header>
      {topDamage > 0 && <TacticalProgressBar label="Dano" value={(troop.damageDealt || 0) / topDamage * 100} amount={formatNumber(troop.damageDealt)} />}
      {special.length > 0 && <div className="tactical-specials">{special.map(([key, value]) => { const formatted = formatTacticalSpecial(key, value); return <span key={key}><small>{formatted.label}</small><strong>{formatted.value}</strong></span>; })}</div>}
      <div className="tactical-troop-stats"><div><span className="tactical-stat-label">Abates</span><strong>{formatNumber(troop.kills)}</strong></div><div><span className="tactical-stat-label">Recebido</span><strong>{formatNumber(troop.damageTaken)}</strong></div><div><span className="tactical-stat-label">Mitigado</span><strong>{formatNumber(troop.damagePrevented)}</strong></div><div><span className="tactical-stat-label">Força</span><strong>{formatNumber(troop.deployed)} <small>implantadas</small></strong><em>{formatNumber(troop.lost)} baixas</em></div></div>
    </article>;
  })}</div>;
}
