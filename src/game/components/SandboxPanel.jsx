import { ENEMIES, getEnemyCatalogEntries } from "../content.js";
import { getEnemyPreviewUrl } from "../assets/enemyPreviewCatalog.js";

/** Development-only controls. Kept separate from the battle screen composition. */
export default function SandboxPanel({
  selectedEnemy, onSelectEnemy, row, onRow, count, onCount, alpha, onAlpha,
  grouped, onGrouped, settings, onSetting, onRulesMode, onSpawn, onForceCombo, onForceLeviathan = () => {}, onDebugLeviathan = () => {}, onForceColosso = () => {}, onDebugColosso = () => {},
  onInjure, onClear, onReset, fortuneTier, onFortuneTier, onSimulateFortune,
  fortuneDisabled, fortuneReason, mechanicOptions = [], onMechanic, disabled = false,
  magmaEnabled = false,
}) {
  const selected = ENEMIES[selectedEnemy];
  const slider = (key, label, min, max) => <label className="sandbox-slider" key={key}>
    <span><b>{label}</b><output>{Math.round(settings[key] * 100)}%</output></span>
    <input type="range" min={min} max={max} step="0.25" value={settings[key]} onChange={(event) => onSetting(key, Number(event.target.value))} />
  </label>;
  const magmaSlider = (key, label, min, max, step, format) => <label className="sandbox-slider" key={key}>
    <span><b>{label}</b><output>{format(settings[key])}</output></span>
    <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(event) => onSetting(key, Number(event.target.value))} />
  </label>;
  return <aside className={`sandbox-panel ${disabled ? "interaction-locked" : ""}`} aria-label="Controles do laboratório" aria-disabled={disabled} inert={disabled ? true : undefined}>
    <div className="sandbox-panel-heading"><div><span className="eyebrow">LABORATÓRIO</span><h2>Gerador de hostis</h2></div><button className="sandbox-reset" onClick={onReset}>Reiniciar</button></div>
    <div className="sandbox-mode-toggle" aria-label="Regras da arena">
      <button className={settings.rulesMode === "free" ? "active" : ""} onClick={() => onRulesMode("free")}>Livre</button>
      <button className={settings.rulesMode === "real" ? "active" : ""} onClick={() => onRulesMode("real")}>Regras reais</button>
    </div>
    <section className="sandbox-spawn-card">
      <header><div><span>MECÂNICAS DOS CAPÍTULOS</span><b>Ambiente de teste</b></div></header>
      <div className="sandbox-mode-toggle" role="group" aria-label="Mecânica ambiental">
        {mechanicOptions.map((mechanic) => <button key={mechanic.id} type="button" className={settings.mechanicMode === mechanic.id ? "active" : ""} onClick={() => onMechanic(mechanic.id)}>{mechanic.label}</button>)}
      </div>
      <small className="sandbox-fortune-reason">Maré, tempestade de areia, ventania e mecânicas especiais podem ser alternadas a qualquer momento.</small>
    </section>
    <div className="enemy-catalog" aria-label="Catálogo de inimigos">{getEnemyCatalogEntries().map((enemy) => <button
      key={enemy.id}
      className={selectedEnemy === enemy.id ? "selected" : ""}
      style={{ "--enemy-color": enemy.color }}
      onClick={() => onSelectEnemy(enemy.id)}
      title={`${enemy.label}: ${enemy.hp} HP, ${enemy.damage} dano`}
    ><img src={getEnemyPreviewUrl(enemy.id)} alt="" /><span>{enemy.label}</span></button>)}</div>
    <section className="sandbox-spawn-card">
      <header><div><span>HOSTIL SELECIONADO</span><b>{selected.label}</b></div><dl><div><dt>HP</dt><dd>{selected.hp}</dd></div><div><dt>VEL</dt><dd>{selected.speed}</dd></div><div><dt>DMG</dt><dd>{selected.damage}</dd></div></dl></header>
      <div className="sandbox-choice"><span>Rota</span><div>{[0, 1, 2, 3, 4].map((value) => <button key={value} className={row === value ? "active" : ""} onClick={() => onRow(value)}>{value + 1}</button>)}</div></div>
      <div className="sandbox-choice"><span>Quantidade</span><div>{[1, 5, 10].map((value) => <button key={value} className={count === value ? "active" : ""} onClick={() => onCount(value)}>{value}</button>)}</div></div>
      <label className="sandbox-check"><span><b>Variante Alpha</b><small>{selected.allowAlphaVariant === false ? "Indisponível para este chefe" : "8× HP, maior escala e dano"}</small></span><input type="checkbox" disabled={selected.allowAlphaVariant === false} checked={selected.allowAlphaVariant === false ? false : alpha} onChange={(event) => onAlpha(event.target.checked)} /></label>
      <label className="sandbox-check"><span><b>Agrupar no mesmo tile</b><small>Gera o grupo na mesma coluna lógica</small></span><input type="checkbox" checked={grouped} onChange={(event) => onGrouped(event.target.checked)} /></label>
      <button className="sandbox-spawn-button" onClick={onSpawn}>{count > 1 ? `GERAR ${count} HOSTIS` : "GERAR 1 HOSTIL"}</button>
    </section>
    <section className="sandbox-spawn-card">
      <header><div><span>VÓRTICE</span><b>Controle de combo</b></div></header>
      <div className="sandbox-choice"><span>Próximo golpe</span><div>{[1, 2, 3].map((step) => <button key={step} onClick={() => onForceCombo(step)}>Combo {step}</button>)}</div></div>
    </section>
    {magmaEnabled && <section className="sandbox-spawn-card magma-lab-card">
      <header><div><span>MAGMA</span><b>Superfície procedural V5</b></div></header>
      <div className="sandbox-mode-toggle magma-state-toggle" role="group" aria-label="Estado térmico do magma">
        {[["auto", "Auto"], ["stable", "Stable"], ["active", "Active"], ["eruption", "Eruption"], ["cooldown", "Cooldown"]].map(([id, label]) => <button key={id} type="button" className={settings.magmaThermalState === id ? "active" : ""} onClick={() => onSetting("magmaThermalState", id)}>{label}</button>)}
      </div>
      {magmaSlider("magmaCrustCoverage", "Crosta", 0.25, 0.7, 0.01, (value) => `${Math.round(value * 100)}%`)}
      {magmaSlider("magmaFlowMultiplier", "Fluxo", 0, 2, 0.05, (value) => `${value.toFixed(2)}×`)}
      {magmaSlider("magmaWarpMultiplier", "Warp", 0, 2, 0.05, (value) => `${value.toFixed(2)}×`)}
      {magmaSlider("magmaVentLimit", "Vents", 0, 10, 1, (value) => String(Math.round(value)))}
      {magmaSlider("magmaParticleLimit", "Partículas", 0, 80, 1, (value) => String(Math.round(value)))}
      <label className="sandbox-check"><span><b>Pausar magma</b><small>Congela somente a simulação visual</small></span><input type="checkbox" checked={settings.magmaPaused} onChange={(event) => onSetting("magmaPaused", event.target.checked)} /></label>
      <label className="sandbox-check"><span><b>Mostrar heatmap</b><small>Preto: crosta · amarelo/branco: calor</small></span><input type="checkbox" checked={settings.magmaShowHeatmap} onChange={(event) => onSetting("magmaShowHeatmap", event.target.checked)} /></label>
      <label className="sandbox-check"><span><b>Mostrar máscara</b><small>Exibe regiões conectadas e seus limites</small></span><input type="checkbox" checked={settings.magmaShowRegionMask} onChange={(event) => onSetting("magmaShowRegionMask", event.target.checked)} /></label>
    </section>}
    <section className="sandbox-spawn-card">
      <header><div><span>CHEFE VULCÂNICO</span><b>Colosso da Caldeira</b></div></header>
      <button className="sandbox-spawn-button" onClick={() => onSelectEnemy("colossoCaldeira")}>SELECIONAR COLOSSO</button>
      <div className="sandbox-choice"><span>Forçar ataque</span><div>{[["rift", "Fissura"], ["slam", "Punho"], ["fracture", "Fratura"], ["seismic", "Sísmico"]].map(([id, label]) => <button key={id} onClick={() => onForceColosso(id)}>{label}</button>)}</div></div>
      <div className="sandbox-choice"><span>Depuração</span><div>{[["phase1", "Fase 1"], ["phase2", "Fase 2"], ["phase3", "Fase 3"], ["resetCooldowns", "Recargas"], ["exposeCore", "Núcleo"], ["kill", "Eliminar"]].map(([id, label]) => <button key={id} onClick={() => onDebugColosso(id)}>{label}</button>)}</div></div>
    </section>
    <section className="sandbox-spawn-card">
      <header><div><span>CHEFE AQUÁTICO</span><b>Leviatã de Nereida</b></div></header>
      <button className="sandbox-spawn-button" onClick={() => onSelectEnemy("leviathanNereida")}>SELECIONAR LEVIATÃ</button>
      <div className="sandbox-choice"><span>Forçar ataque</span><div>{[["biteAbyss", "Mordida"], ["tailSweep", "Cauda"], ["brineJet", "Salmoura"], ["predatoryVortex", "Vórtice"], ["devastatingDive", "Mergulho"], ["tideCommand", "Maré"], ["abyssRoar", "Rugido"], ["deluge", "Dilúvio"]].map(([id, label]) => <button key={id} onClick={() => onForceLeviathan(id)}>{label}</button>)}</div></div>
      <div className="sandbox-choice"><span>Depuração</span><div>{[["phase1", "Fase 1"], ["phase2", "Fase 2"], ["phase3", "Fase 3"], ["resetCooldowns", "Recargas"], ["exposeGills", "Guelras"], ["clearTide", "Limpar maré"], ["kill", "Eliminar"]].map(([id, label]) => <button key={id} onClick={() => onDebugLeviathan(id)}>{label}</button>)}</div></div>
    </section>
    <section className="sandbox-spawn-card fortune-lab-card">
      <header><div><span>ASSISTÊNCIA ADAPTATIVA</span><b>Protocolo Fortuna</b></div></header>
      <div className="sandbox-mode-toggle" role="group" aria-label="Nível da ajuda simulada">
        <button type="button" className={fortuneTier === "difficult" ? "active" : ""} disabled={fortuneDisabled} onClick={() => onFortuneTier("difficult")}>Difícil</button>
        <button type="button" className={fortuneTier === "critical" ? "active" : ""} disabled={fortuneDisabled} onClick={() => onFortuneTier("critical")}>Crítica</button>
      </div>
      <button type="button" className="sandbox-fortune-button" disabled={fortuneDisabled} onClick={onSimulateFortune}>SIMULAR AJUDA</button>
      <small className="sandbox-fortune-reason" aria-live="polite">{fortuneReason || "Executa o fluxo completo da Cápsula da Colônia."}</small>
    </section>
    <details className="sandbox-balance" open>
      <summary>Balanceamento temporário</summary>
      {slider("enemyHpMultiplier", "HP inimigo", 0.25, 4)}
      {slider("enemySpeedMultiplier", "Velocidade inimigo", 0, 3)}
      {slider("enemyDamageMultiplier", "Dano inimigo", 0, 3)}
      {slider("troopDamageMultiplier", "Dano das tropas", 0.25, 3)}
      <label className="sandbox-check"><span><b>Base invulnerável</b><small>Rupturas não reduzem integridade</small></span><input type="checkbox" checked={settings.invulnerableBase} onChange={(event) => onSetting("invulnerableBase", event.target.checked)} /></label>
    </details>
    <div className="sandbox-cleanup"><button onClick={onInjure}>Ferir tropas −10 HP</button><button onClick={() => onClear("enemies")}>Limpar hostis</button><button onClick={() => onClear("troops")}>Limpar tropas</button></div>
  </aside>;
}

// Named export preserves the BattleScreen/GameCanvas compatibility surface.
export { SandboxPanel };
