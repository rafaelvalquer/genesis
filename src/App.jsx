import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import GameCanvas from "./game/GameCanvas.jsx";
import { getArenaUrl, getTroopPreviewUrl } from "./game/assetCatalog.js";
import { getPhase, getPhaseIndex, getUnlockedTroops, PHASES, TROOPS } from "./game/content.js";
import {
  loadCampaign,
  loadSettings,
  recordBattleResult,
  resetCampaign,
  saveSettings,
} from "./campaign/storage.js";

const formatTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const total = Math.floor(milliseconds / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function Stars({ value = 0 }) {
  return <span className="stars" aria-label={`${value} de 3 estrelas`}>{[0, 1, 2].map((index) => <span key={index} className={index < value ? "earned" : ""}>★</span>)}</span>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AppLayout({ children }) {
  return <div className="app-shell"><ScrollToTop />
    <header className="site-header">
      <Link className="brand" to="/"><span className="brand-mark">GD</span><span><b>GENESIS</b><small>DEFENSE</small></span></Link>
      <nav aria-label="Navegação principal">
        <NavLink to="/" end>Comando</NavLink>
        <NavLink to="/fases">Campanha</NavLink>
        <NavLink to="/configuracoes">Configurações</NavLink>
      </nav>
      <span className="system-status"><i /> SISTEMA LOCAL</span>
    </header>
    {children}
  </div>;
}

function HomePage({ campaign, onReset }) {
  const current = PHASES[campaign.unlockedPhaseIndex];
  const victories = Object.values(campaign.phaseStats).reduce((sum, stats) => sum + Number(stats.victories || 0), 0);
  const stars = Object.values(campaign.phaseStats).reduce((sum, stats) => sum + Number(stats.bestStars || 0), 0);
  return <main className="home-page">
    <section className="hero-panel">
      <div className="hero-copy">
        <span className="eyebrow">PROTOCOLO DE DEFESA AUTÔNOMA</span>
        <h1>O perímetro é<br /><em>a última fronteira.</em></h1>
        <p>Monte seu esquadrão, controle cinco rotas e sobreviva a uma campanha de oito fases contra a Colmeia.</p>
        <div className="hero-actions">
          <Link className="primary-button" to={`/jogar/${current.id}`}>Continuar campanha <span>→</span></Link>
          <Link className="secondary-button" to="/fases">Selecionar fase</Link>
        </div>
        <div className="hero-meta"><span>SEM LOGIN</span><span>SAVE LOCAL</span><span>100% FRONT-END</span></div>
      </div>
      <div className="radar-card">
        <div className="radar-grid"><span className="radar-sweep" /><span className="blip b1" /><span className="blip b2" /><span className="blip b3" /><span className="blip b4" /></div>
        <div className="radar-footer"><span><small>SETOR ATUAL</small><b>{current.name}</b></span><span className="threat-pill">AMEAÇA {campaign.unlockedPhaseIndex + 1}/8</span></div>
      </div>
    </section>

    <section className="command-grid">
      <article className="status-card accent-cyan"><span className="card-code">CMP-01</span><small>Progresso da campanha</small><strong>{campaign.unlockedPhaseIndex + 1}<i>/8</i></strong><div className="mini-track"><span style={{ width: `${((campaign.unlockedPhaseIndex + 1) / 8) * 100}%` }} /></div></article>
      <article className="status-card accent-green"><span className="card-code">VTR-02</span><small>Vitórias registradas</small><strong>{victories}</strong><p>Resultados salvos neste dispositivo</p></article>
      <article className="status-card accent-amber"><span className="card-code">STR-03</span><small>Estrelas conquistadas</small><strong>{stars}<i>/24</i></strong><Stars value={Math.min(3, Math.ceil(stars / 8))} /></article>
      <article className="next-operation"><div><span className="eyebrow amber">Próxima operação</span><h2>{current.name}</h2><p>{current.subtitle} · 4 ondas · energia inicial {current.energy}</p></div><Link to={`/jogar/${current.id}`}>INICIAR →</Link></article>
    </section>

    <button className="text-button danger-text" onClick={onReset}>Apagar progresso local</button>
  </main>;
}

function PhaseSelectPage({ campaign }) {
  return <main className="page-content">
    <header className="page-heading"><div><span className="eyebrow">MAPA DE OPERAÇÕES</span><h1>Campanha</h1><p>Complete uma operação para abrir o próximo setor.</p></div><div className="campaign-counter"><b>{campaign.unlockedPhaseIndex + 1}</b><span>setores<br />acessíveis</span></div></header>
    <section className="phase-grid">{PHASES.map((phase, index) => {
      const locked = index > campaign.unlockedPhaseIndex;
      const stats = campaign.phaseStats[phase.id] || {};
      const enemyTypes = [...new Set(phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type)))];
      const card = <article className={`phase-card environment-${phase.environment} ${locked ? "locked" : ""}`}>
        <div className="phase-number">{String(index + 1).padStart(2, "0")}</div>
        <div className="phase-art"><img src={getArenaUrl(phase.arenaId)} alt="" /><span className="arena-card-shade" /><span className="terrain-lines" /><span className="phase-icon">{phase.boss ? "◉" : locked ? "◇" : "⬡"}</span></div>
        <div className="phase-body"><span className="eyebrow">{locked ? "SETOR BLOQUEADO" : phase.subtitle}</span><h2>{phase.name}</h2><div className="enemy-tags">{enemyTypes.map((type) => <span key={type}>{type}</span>)}</div><div className="phase-record"><Stars value={stats.bestStars || 0} /><span>Melhor tempo <b>{formatTime(stats.bestTimeMs)}</b></span><span>Integridade <b>{stats.bestIntegrity || 0}%</b></span></div></div>
        <div className="phase-footer"><span>⚡ {phase.energy}</span><span>◫ 4 ondas</span><span>{phase.environment.toUpperCase()}</span></div>
      </article>;
      return locked ? <div key={phase.id}>{card}</div> : <Link key={phase.id} to={`/jogar/${phase.id}`} aria-label={`Jogar ${phase.name}`}>{card}</Link>;
    })}</section>
  </main>;
}

function LoadoutPicker({ phase, selected, onToggle, onStart, onBack }) {
  const phaseIndex = getPhaseIndex(phase.id);
  const available = getUnlockedTroops(phaseIndex);
  return <main className="loadout-page" style={{ "--arena-image": `url(${getArenaUrl(phase.arenaId)})`, "--arena-primary": phase.palette.primary, "--arena-accent": phase.palette.accent }}>
    <div className="loadout-arena-backdrop" aria-hidden="true" />
    <header className="loadout-header"><button className="back-link" onClick={onBack}>← Voltar</button><div><span className="eyebrow">BRIEFING · {phase.id.replace("_", " ")}</span><h1>{phase.name}</h1><p>{phase.subtitle}. Escolha de uma a cinco unidades para a operação.</p></div><div className="selection-count"><strong>{selected.length}</strong><span>/ 5<br />selecionadas</span></div></header>
    <section className="loadout-layout">
      <div className="unit-grid">{available.map((troop) => {
        const active = selected.includes(troop.id);
        return <button key={troop.id} className={`unit-card ${active ? "active" : ""}`} onClick={() => onToggle(troop.id)}>
          <span className="unit-check">{active ? "✓" : "+"}</span>
          <div className="unit-portrait"><img src={getTroopPreviewUrl(troop.id)} alt="" /><span style={{ background: troop.color }} /></div>
          <div className="unit-info"><span className="eyebrow">{troop.role}</span><h2>{troop.label}</h2><p>{troop.description}</p><div><span>⚡ {troop.price}</span><span>SUP {troop.supply}</span><span>HP {troop.hp}</span></div></div>
        </button>;
      })}</div>
      <aside className="mission-brief">
        <div className="brief-arena"><img src={getArenaUrl(phase.arenaId)} alt={`Campo de batalha ${phase.name}`} /><span>ARENA SINCRONIZADA</span></div>
        <span className="eyebrow amber">Parâmetros da missão</span><h2>Dados táticos</h2>
        <dl><div><dt>Ondas</dt><dd>4</dd></div><div><dt>Energia</dt><dd>{phase.energy}</dd></div><div><dt>Integridade</dt><dd>100%</dd></div><div><dt>Cadência</dt><dd>{(phase.cadenceMs / 1000).toFixed(2)}s</dd></div><div><dt>Tempo-alvo</dt><dd>{formatTime(phase.targetDurationMs)}</dd></div></dl>
        <div className="environment-note"><b>Ambiente · {phase.environment}</b><span>Tratamento visual, sem penalidades ocultas.</span></div>
        <button className="primary-button full" disabled={selected.length < 1 || selected.length > 5} onClick={onStart}>Confirmar loadout <span>→</span></button>
      </aside>
    </section>
  </main>;
}

function ResultScreen({ result, phase, onRetry, onNext, onPhases }) {
  const victory = result.outcome === "victory";
  return <div className="modal-backdrop result-backdrop"><section className={`result-card ${victory ? "victory" : "defeat"}`}>
    <span className="result-emblem">{victory ? "✦" : "×"}</span><span className="eyebrow">{victory ? "OPERAÇÃO CONCLUÍDA" : "NÚCLEO COMPROMETIDO"}</span><h1>{victory ? "Perímetro assegurado" : "A defesa caiu"}</h1><p>{phase.name} · {result.enemiesDefeated} hostis eliminados</p>
    <Stars value={result.stars} />
    <div className="result-stats"><div><span>Tempo</span><b>{formatTime(result.durationMs)}</b></div><div><span>Integridade</span><b>{result.integrity}%</b></div><div><span>Energia</span><b>{result.energy}</b></div><div><span>Eliminações</span><b>{result.enemiesDefeated}</b></div></div>
    <div className="result-actions"><button className="secondary-button" onClick={onRetry}>Repetir fase</button>{victory && <button className="primary-button" onClick={onNext}>{phase.id === "fase_08" ? "Ver campanha" : "Próxima fase"} <span>→</span></button>}<button className="text-button" onClick={onPhases}>Selecionar fases</button></div>
  </section></div>;
}

function PlayPage({ campaign, setCampaign }) {
  const { phaseId } = useParams();
  const navigate = useNavigate();
  const phase = getPhase(phaseId);
  const phaseIndex = getPhaseIndex(phaseId);
  const [selected, setSelected] = useState(() => phase ? getUnlockedTroops(phaseIndex).slice(0, 3).map((troop) => troop.id) : []);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!phase) return;
    setSelected(getUnlockedTroops(phaseIndex).slice(0, 3).map((troop) => troop.id));
    setStarted(false);
    setAttempt(0);
    setResult(null);
  }, [phaseId, phase, phaseIndex]);

  const handleFinish = useCallback((battleResult) => {
    setResult(battleResult);
    setCampaign((current) => recordBattleResult(current, battleResult));
  }, [setCampaign]);

  if (!phase || phaseIndex > campaign.unlockedPhaseIndex) return <Navigate to="/fases" replace />;
  if (!started) return <LoadoutPicker phase={phase} selected={selected} onToggle={(troopId) => setSelected((current) => current.includes(troopId) ? current.filter((id) => id !== troopId) : current.length < 5 ? [...current, troopId] : current)} onStart={() => setStarted(true)} onBack={() => navigate("/fases")} />;

  const retry = () => { setResult(null); setAttempt((value) => value + 1); };
  const next = PHASES[Math.min(PHASES.length - 1, phaseIndex + 1)];
  return <main className="play-page">
    <GameCanvas key={`${phase.id}:${attempt}`} phase={phase} unlockedTroops={selected} onFinish={handleFinish} onExit={() => navigate("/fases")} />
    {result && <ResultScreen result={result} phase={phase} onRetry={retry} onNext={() => navigate(phaseIndex === PHASES.length - 1 ? "/fases" : `/jogar/${next.id}`)} onPhases={() => navigate("/fases")} />}
  </main>;
}

function SettingsPage() {
  const [settings, setSettingsState] = useState(loadSettings);
  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.quality = settings.quality;
    document.documentElement.dataset.colorMode = settings.colorMode;
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings]);
  const update = (key, value) => setSettingsState((current) => ({ ...current, [key]: value }));
  const range = (key, label) => <label className="setting-range"><span><b>{label}</b><i>{Math.round(settings[key] * 100)}%</i></span><input type="range" min="0" max="1" step="0.05" value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>;
  return <main className="page-content settings-page"><header className="page-heading"><div><span className="eyebrow">SISTEMAS LOCAIS</span><h1>Configurações</h1><p>Preferências salvas somente neste dispositivo.</p></div></header>
    <section className="settings-grid"><article><span className="eyebrow">Áudio</span><h2>Mixer tático</h2>{range("masterVolume", "Volume geral")}{range("musicVolume", "Música")}{range("effectsVolume", "Efeitos")}</article><article><span className="eyebrow">Vídeo</span><h2>Renderização</h2><label className="select-setting"><span><b>Qualidade</b><small>Perfil de efeitos e partículas</small></span><select value={settings.quality} onChange={(event) => update("quality", event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><label className="toggle-setting"><span><b>Tremor de câmera</b><small>Impacto de ataques e rupturas</small></span><input type="checkbox" checked={settings.cameraShake} onChange={(event) => update("cameraShake", event.target.checked)} /></label></article><article><span className="eyebrow">Acessibilidade</span><h2>Conforto visual</h2><label className="toggle-setting"><span><b>Reduzir movimento</b><small>Minimiza transições da interface</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label><label className="select-setting"><span><b>Modo de cores</b><small>Reforço de contraste visual</small></span><select value={settings.colorMode} onChange={(event) => update("colorMode", event.target.value)}><option value="normal">Normal</option><option value="protanopia">Protanopia</option><option value="deuteranopia">Deuteranopia</option><option value="contrast">Alto contraste</option></select></label></article></section>
  </main>;
}

export default function App() {
  const [campaign, setCampaign] = useState(loadCampaign);
  const handleReset = () => {
    if (window.confirm("Apagar todo o progresso local da campanha?")) setCampaign(resetCampaign());
  };
  return <BrowserRouter><AppLayout><Routes><Route path="/" element={<HomePage campaign={campaign} onReset={handleReset} />} /><Route path="/fases" element={<PhaseSelectPage campaign={campaign} />} /><Route path="/jogar/:phaseId" element={<PlayPage campaign={campaign} setCampaign={setCampaign} />} /><Route path="/configuracoes" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppLayout></BrowserRouter>;
}
