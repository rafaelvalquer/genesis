export default function CampaignOverviewStrip({ metrics }) {
  const boss = metrics.nextBossDistance == null ? "—"
    : metrics.nextBossDistance === 0 ? "NO SETOR"
      : `${metrics.nextBossDistance} OPERAÇÕES`;
  return <dl className="campaign-overview-strip" aria-label="Resumo geral da campanha">
    <div><dt>PROGRESSO GERAL</dt><dd>{metrics.overallPercent}%</dd><small>{metrics.completedPhases}/{metrics.phasesTotal} fases · ★ {metrics.stars}/{metrics.starsTotal}</small></div>
    <div><dt>TROPAS</dt><dd>{metrics.troopsUnlocked}/{metrics.troopsTotal}</dd><small>autorizadas</small></div>
    <div><dt>HOSTIS</dt><dd>{metrics.catalogedEnemies}/{metrics.enemiesTotal}</dd><small>catalogados</small></div>
    <div><dt>PRÓXIMO ALVO</dt><dd>{boss}</dd><small>assinatura prioritária</small></div>
  </dl>;
}
