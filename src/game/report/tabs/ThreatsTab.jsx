import { ENEMIES } from "../../content.js";
import TacticalMetricCard from "../TacticalMetricCard.jsx";
import TacticalProgressBar from "../TacticalProgressBar.jsx";
import { formatNumber } from "../tacticalFormatters.js";

export default function ThreatsTab({ threats = {}, summary = {} }) {
  const enemyDamage = threats.enemyDamage || 0;
  const airDamage = threats.airDamage || 0;
  const groundDamage = threats.groundDamage || 0;
  const dominant = Object.entries(threats.byEnemyType || {}).sort(([, a], [, b]) => b - a)[0];
  return <div className="tactical-tab-content tactical-threats">
    <div className="tactical-threat-overview"><TacticalMetricCard label="Dano inimigo total" value={formatNumber(enemyDamage)} tone="danger" /><TacticalMetricCard label="Dano ao objetivo" value={formatNumber(summary.objectiveDamage)} tone="danger" /></div>
    <section className="tactical-threat-distribution"><h3>Composição da ameaça</h3><TacticalProgressBar label="Ameaça terrestre" value={enemyDamage ? groundDamage / enemyDamage * 100 : 0} amount={`${formatNumber(groundDamage)} dano`} tone="danger" /><TacticalProgressBar label="Ameaça aérea" value={enemyDamage ? airDamage / enemyDamage * 100 : 0} amount={`${formatNumber(airDamage)} dano`} tone="amber" /></section>
    {dominant && dominant[1] > 0 && <article className="tactical-dominant-threat"><span className="tactical-stat-label">Principal ameaça</span><strong>{ENEMIES[dominant[0]]?.label || dominant[0]}</strong><small>{formatNumber(dominant[1])} dano causado</small></article>}
    {(threats.bossDamage > 0 || threats.environmentalDamage > 0) && <div className="tactical-secondary-metrics">{threats.bossDamage > 0 && <TacticalMetricCard label="Dano de chefe" value={formatNumber(threats.bossDamage)} tone="danger" />}{threats.environmentalDamage > 0 && <TacticalMetricCard label="Dano ambiental" value={formatNumber(threats.environmentalDamage)} tone="amber" />}</div>}
  </div>;
}
