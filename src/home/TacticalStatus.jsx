import { motion } from "motion/react";

export default function TacticalStatus({ metrics, reduceMotion }) {
  const bossMessage = metrics.nextBossDistance == null
    ? "NENHUMA ASSINATURA PRIORITÁRIA"
    : metrics.nextBossDistance === 0
      ? "ASSINATURA DE GRANDE PORTE NO SETOR"
      : `ALVO PRIORITÁRIO EM ${metrics.nextBossDistance} OPERAÇÕES`;
  return <motion.section className="tactical-status command-module" whileHover={reduceMotion ? undefined : { y: -2 }}>
    <header><span className="command-kicker">REDE DE INTELIGÊNCIA</span><h2>INTELIGÊNCIA TÁTICA</h2></header>
    <div className="tactical-gauge" style={{ "--progress": `${metrics.overallPercent * 3.6}deg` }}>
      <strong>{metrics.overallPercent}%</strong><span>PROGRESSO GERAL</span>
    </div>
    <dl>
      <div><dt>TROPAS AUTORIZADAS</dt><dd>{metrics.troopsUnlocked}/{metrics.troopsTotal}</dd></div>
      <div><dt>HOSTIS CATALOGADOS</dt><dd>{metrics.catalogedEnemies}/{metrics.enemiesTotal}</dd></div>
      <div><dt>OPERAÇÕES CONCLUÍDAS</dt><dd>{metrics.completedPhases}/32</dd></div>
      <div><dt>ESTRELAS</dt><dd>{metrics.stars}/96</dd></div>
    </dl>
    <p className="priority-signal"><i /> {bossMessage}</p>
  </motion.section>;
}
