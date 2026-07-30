import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import GameCanvas from "./game/GameCanvas.jsx";
import CampaignPage from "./campaign/CampaignPage.jsx";
import LoadoutPicker from "./loadout/LoadoutPage.jsx";
import { getEnemyPreviewUrl, getTroopPreviewUrl } from "./game/assetCatalog.js";
import { CHAPTERS, ENEMIES, getChapterForPhase, getPhase, getPhaseIndex, getUnlockedTroops, PHASES, TROOPS } from "./game/content.js";
import { getEnemyInfo, getEnemyUnlockAt } from "./game/enemyInfo.js";
import { getTroopInfo } from "./game/troopInfo.js";
import {
  loadCampaign,
  loadSettings,
  recordBattleResult,
  resetCampaign,
  saveSettings,
} from "./campaign/storage.js";

export { LoadoutPicker };

const formatTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const total = Math.floor(milliseconds / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const TEST_PHASE = {
  ...PHASES[0],
  id: "campo_de_provas",
  name: "Campo de Provas",
  subtitle: "Arena de testes e balanceamento",
  energy: 150,
  baseIntegrity: 100,
  waves: [],
  boss: false,
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

export function AppLayout({ children }) {
  return <div className="app-shell"><ScrollToTop />
    <header className="site-header">
      <Link className="brand" to="/"><span className="brand-mark">GD</span><span><b>GENESIS</b><small>DEFENSE</small></span></Link>
      <nav aria-label="Navegação principal">
        <NavLink to="/" end>Comando</NavLink>
        <NavLink to="/fases">Campanha</NavLink>
        <NavLink to="/enciclopedia">Enciclopédia</NavLink>
        <NavLink to="/testes">Testes</NavLink>
        <NavLink to="/configuracoes">Configurações</NavLink>
      </nav>
      <span className="system-status"><i /> SISTEMA LOCAL</span>
    </header>
    {children}
  </div>;
}

function HomePage({ campaign, onReset }) {
  const current = PHASES[campaign.unlockedPhaseIndex];
  const currentChapter = getChapterForPhase(current);
  const victories = Object.values(campaign.phaseStats).reduce((sum, stats) => sum + Number(stats.victories || 0), 0);
  const stars = Object.values(campaign.phaseStats).reduce((sum, stats) => sum + Number(stats.bestStars || 0), 0);
  return <main className="home-page">
    <section className="hero-panel">
      <div className="hero-copy">
        <span className="eyebrow">PROTOCOLO DE DEFESA AUTÔNOMA</span>
        <h1>O perímetro é<br /><em>a última fronteira.</em></h1>
        <p>Monte seu esquadrão, controle cinco rotas e atravesse {CHAPTERS.length} capítulos de uma campanha com {PHASES.length} fases.</p>
        <div className="hero-actions">
          <Link className="primary-button" to={`/jogar/${current.id}`}>Continuar campanha <span>→</span></Link>
          <Link className="secondary-button" to={`/fases?capitulo=${currentChapter.number}`}>Selecionar fase</Link>
        </div>
        <div className="hero-meta"><span>SEM LOGIN</span><span>SAVE LOCAL</span><span>100% FRONT-END</span></div>
      </div>
      <div className="radar-card">
        <div className="radar-grid"><span className="radar-sweep" /><span className="blip b1" /><span className="blip b2" /><span className="blip b3" /><span className="blip b4" /></div>
        <div className="radar-footer"><span><small>CAPÍTULO {currentChapter.number} · SETOR ATUAL</small><b>{current.name}</b></span><span className="threat-pill">AMEAÇA {campaign.unlockedPhaseIndex + 1}/{PHASES.length}</span></div>
      </div>
    </section>

    <section className="command-grid">
      <article className="status-card accent-cyan"><span className="card-code">CMP-01</span><small>Progresso da campanha</small><strong>{campaign.unlockedPhaseIndex + 1}<i>/{PHASES.length}</i></strong><div className="mini-track"><span style={{ width: `${((campaign.unlockedPhaseIndex + 1) / PHASES.length) * 100}%` }} /></div></article>
      <article className="status-card accent-green"><span className="card-code">VTR-02</span><small>Vitórias registradas</small><strong>{victories}</strong><p>Resultados salvos neste dispositivo</p></article>
      <article className="status-card accent-amber"><span className="card-code">STR-03</span><small>Estrelas conquistadas</small><strong>{stars}<i>/{PHASES.length * 3}</i></strong><Stars value={Math.min(3, Math.ceil(stars / PHASES.length))} /></article>
      <article className="next-operation"><div><span className="eyebrow amber">Capítulo {currentChapter.number} · Próxima operação</span><h2>{current.name}</h2><p>{current.subtitle} · {current.waves.length} ondas · energia inicial {current.energy}</p></div><Link to={`/jogar/${current.id}`}>INICIAR →</Link></article>
    </section>

    <button className="text-button danger-text" onClick={onReset}>Apagar progresso local</button>
  </main>;
}

export function PhaseSelectPage({ campaign }) {
  return <CampaignPage campaign={campaign} />;
}

const ENCYCLOPEDIA_CATEGORIES = {
  troops: {
    label: "Tropas",
    eyebrow: "ARSENAL DA COLÔNIA",
    entries: () => Object.values(TROOPS),
    getImage: (entry) => getTroopPreviewUrl(entry.id),
    getInfo: getTroopInfo,
    isUnlocked: (entry, campaign) => entry.unlockAt <= campaign.unlockedPhaseIndex,
  },
  enemies: {
    label: "Inimigos",
    eyebrow: "ARQUIVO DE AMEAÇAS",
    entries: () => Object.values(ENEMIES).filter((entry) => !entry.hiddenFromCatalog),
    getImage: (entry) => getEnemyPreviewUrl(entry.id),
    getInfo: getEnemyInfo,
    isUnlocked: (entry, campaign) => {
      const unlockAt = getEnemyUnlockAt(entry.id, entry);
      return unlockAt >= 0 && unlockAt <= campaign.unlockedPhaseIndex;
    },
  },
};

export function EncyclopediaPage({ campaign }) {
  const [categoryId, setCategoryId] = useState("troops");
  const [selectedIds, setSelectedIds] = useState({ troops: "colono", enemies: "medu" });
  const category = ENCYCLOPEDIA_CATEGORIES[categoryId];
  const entries = category.entries();
  const unlockedEntries = entries.filter((entry) => category.isUnlocked(entry, campaign));
  const selected = unlockedEntries.find((entry) => entry.id === selectedIds[categoryId]) || unlockedEntries[0];
  const info = selected ? category.getInfo(selected) : { stats: [], specials: [] };

  const selectCategory = (nextCategoryId) => {
    const nextCategory = ENCYCLOPEDIA_CATEGORIES[nextCategoryId];
    const nextEntries = nextCategory.entries().filter((entry) => nextCategory.isUnlocked(entry, campaign));
    setCategoryId(nextCategoryId);
    setSelectedIds((current) => ({
      ...current,
      [nextCategoryId]: nextEntries.some((entry) => entry.id === current[nextCategoryId])
        ? current[nextCategoryId]
        : nextEntries[0]?.id,
    }));
  };

  return <main className="page-content encyclopedia-page">
    <header className="page-heading encyclopedia-heading">
      <div><span className="eyebrow">BANCO DE DADOS TÁTICO</span><h1>Enciclopédia</h1><p>Consulte unidades conhecidas e ameaças registradas durante a campanha.</p></div>
      <div className="encyclopedia-progress"><strong>{unlockedEntries.length}</strong><span>de {entries.length}<br />registros disponíveis</span></div>
    </header>

    <div className="encyclopedia-tabs" role="tablist" aria-label="Categorias da Enciclopédia">
      {Object.entries(ENCYCLOPEDIA_CATEGORIES).map(([id, entry]) => <button
        key={id}
        type="button"
        role="tab"
        aria-selected={categoryId === id}
        aria-controls={`encyclopedia-panel-${id}`}
        className={categoryId === id ? "active" : ""}
        onClick={() => selectCategory(id)}
      ><span>{id === "troops" ? "◆" : "◈"}</span><b>{entry.label}</b><small>{entry.entries().length} registros</small></button>)}
    </div>

    <section
      id={`encyclopedia-panel-${categoryId}`}
      className={`encyclopedia-console encyclopedia-${categoryId}`}
      role="tabpanel"
      aria-label={category.label}
      style={{ "--entry-color": selected?.color || "var(--cyan)" }}
    >
      <div className="encyclopedia-index">
        <header><span className="eyebrow">{category.eyebrow}</span><b>SELECIONE UM REGISTRO</b></header>
        <div className="encyclopedia-grid">
          {entries.map((entry, index) => {
            const unlocked = category.isUnlocked(entry, campaign);
            const active = unlocked && selected?.id === entry.id;
            if (!unlocked) return <button key={entry.id} type="button" className="encyclopedia-entry locked" disabled aria-label={`Registro bloqueado ${index + 1}`}>
              <span className="encyclopedia-lock" aria-hidden="true">◇</span><small>REGISTRO {String(index + 1).padStart(2, "0")}</small>
            </button>;
            return <button
              key={entry.id}
              type="button"
              className={`encyclopedia-entry ${active ? "active" : ""}`}
              style={{ "--card-color": entry.color }}
              aria-pressed={active}
              aria-label={`Ver informações de ${entry.label}`}
              onClick={() => setSelectedIds((current) => ({ ...current, [categoryId]: entry.id }))}
            >
              <img src={category.getImage(entry)} alt="" />
              <span><b>{entry.label}</b><small>{entry.title || entry.role}</small></span>
            </button>;
          })}
        </div>
      </div>

      {selected && <article className="encyclopedia-dossier">
        <div className="encyclopedia-portrait">
          <span className="portrait-grid" aria-hidden="true" />
          <img src={category.getImage(selected)} alt={`Retrato de ${selected.label}`} />
          <span className="portrait-scan" aria-hidden="true" />
          <small>IDENTIFICAÇÃO CONFIRMADA · {String(entries.indexOf(selected) + 1).padStart(2, "0")}</small>
        </div>
        <div className="encyclopedia-record">
          <span className="eyebrow">{selected.role}</span>
          <h2>{selected.label}</h2>
          {selected.title && <small className="unit-title">{selected.title}</small>}
          <p>{selected.description}</p>
          <dl className="encyclopedia-stats">{info.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
          {info.specials.length > 0 && <div className="encyclopedia-specials">
            <span className="eyebrow amber">Protocolos especiais</span>
            <dl>{info.specials.map((special) => <div key={special.label}><dt>{special.label}</dt><dd>{special.value}</dd></div>)}</dl>
          </div>}
        </div>
      </article>}
    </section>
  </main>;
}

function ResultScreen({ result, phase, onRetry, onNext, onPhases }) {
  const victory = result.outcome === "victory";
  const phaseIndex = getPhaseIndex(phase.id);
  const nextPhase = PHASES[phaseIndex + 1];
  const nextChapter = nextPhase && getChapterForPhase(nextPhase);
  const currentChapter = getChapterForPhase(phase);
  const nextLabel = phaseIndex === PHASES.length - 1
    ? "Ver campanha"
    : nextChapter?.id !== currentChapter?.id ? `Ir ao Capítulo ${nextChapter.number}` : "Próxima fase";
  return <div className="modal-backdrop result-backdrop"><section className={`result-card ${victory ? "victory" : "defeat"}`}>
    <span className="result-emblem">{victory ? "✦" : "×"}</span><span className="eyebrow">{victory ? "OPERAÇÃO CONCLUÍDA" : "NÚCLEO COMPROMETIDO"}</span><h1>{victory ? "Perímetro assegurado" : "A defesa caiu"}</h1><p>{phase.name} · {result.enemiesDefeated} hostis eliminados</p>
    <Stars value={result.stars} />
    <div className="result-stats"><div><span>Tempo</span><b>{formatTime(result.durationMs)}</b></div><div><span>Integridade</span><b>{result.integrity}%</b></div><div><span>Energia</span><b>{result.energy}</b></div><div><span>Eliminações</span><b>{result.enemiesDefeated}</b></div></div>
    <div className="result-actions"><button className="secondary-button" onClick={onRetry}>Repetir fase</button>{victory && <button className="primary-button" onClick={onNext}>{nextLabel} <span>→</span></button>}<button className="text-button" onClick={onPhases}>Selecionar fases</button></div>
  </section></div>;
}

export function PlayPage({ campaign, setCampaign }) {
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

  const chapterNumber = getChapterForPhase(phase)?.number || getChapterForPhase(PHASES[campaign.unlockedPhaseIndex])?.number || 1;
  if (!phase || phaseIndex > campaign.unlockedPhaseIndex) return <Navigate to={`/fases?capitulo=${chapterNumber}`} replace />;
  if (!started) return <LoadoutPicker phase={phase} selected={selected} onToggle={(troopId) => setSelected((current) => current.includes(troopId) ? current.filter((id) => id !== troopId) : current.length < (phase.loadoutLimit ?? 5) ? [...current, troopId] : current)} onStart={() => setStarted(true)} onBack={() => navigate(`/fases?capitulo=${chapterNumber}`)} />;

  const retry = () => { setResult(null); setAttempt((value) => value + 1); };
  const next = PHASES[Math.min(PHASES.length - 1, phaseIndex + 1)];
  return <main className="play-page">
    <GameCanvas key={`${phase.id}:${attempt}`} phase={phase} unlockedTroops={selected} onFinish={handleFinish} onExit={() => navigate(`/fases?capitulo=${chapterNumber}`)} />
    {result && <ResultScreen result={result} phase={phase} onRetry={retry} onNext={() => navigate(phaseIndex === PHASES.length - 1 ? `/fases?capitulo=${chapterNumber}` : `/jogar/${next.id}`)} onPhases={() => navigate(`/fases?capitulo=${chapterNumber}`)} />}
  </main>;
}

function TestLabPage() {
  const navigate = useNavigate();
  const allTroops = useMemo(() => Object.keys(TROOPS), []);
  return <main className="test-page">
    <GameCanvas
      phase={TEST_PHASE}
      unlockedTroops={allTroops}
      sandbox
      onExit={() => navigate("/")}
    />
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
    <section className="settings-grid"><article><span className="eyebrow">Áudio</span><h2>Mixer tático</h2>{range("masterVolume", "Volume geral")}{range("musicVolume", "Música")}{range("effectsVolume", "Efeitos")}</article><article><span className="eyebrow">Vídeo</span><h2>Renderização</h2><label className="select-setting"><span><b>Qualidade</b><small>Perfil de efeitos e partículas</small></span><select value={settings.quality} onChange={(event) => update("quality", event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><label className="toggle-setting"><span><b>Dano flutuante</b><small>Exibe indicadores de dano nos alvos</small></span><input type="checkbox" checked={settings.floatingDamage ?? true} onChange={(event) => update("floatingDamage", event.target.checked)} /></label><label className="toggle-setting"><span><b>Tremor de câmera</b><small>Impacto de ataques e rupturas</small></span><input type="checkbox" checked={settings.cameraShake} onChange={(event) => update("cameraShake", event.target.checked)} /></label></article><article><span className="eyebrow">Acessibilidade</span><h2>Conforto visual</h2><label className="toggle-setting"><span><b>Reduzir movimento</b><small>Minimiza transições da interface</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label><label className="select-setting"><span><b>Modo de cores</b><small>Reforço de contraste visual</small></span><select value={settings.colorMode} onChange={(event) => update("colorMode", event.target.value)}><option value="normal">Normal</option><option value="protanopia">Protanopia</option><option value="deuteranopia">Deuteranopia</option><option value="contrast">Alto contraste</option></select></label></article></section>
  </main>;
}

export default function App() {
  const [campaign, setCampaign] = useState(loadCampaign);
  const handleReset = () => {
    if (window.confirm("Apagar todo o progresso local da campanha?")) setCampaign(resetCampaign());
  };
  return <BrowserRouter><AppLayout><Routes><Route path="/" element={<HomePage campaign={campaign} onReset={handleReset} />} /><Route path="/fases" element={<PhaseSelectPage campaign={campaign} />} /><Route path="/enciclopedia" element={<EncyclopediaPage campaign={campaign} />} /><Route path="/jogar/:phaseId" element={<PlayPage campaign={campaign} setCampaign={setCampaign} />} /><Route path="/testes" element={<TestLabPage />} /><Route path="/configuracoes" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppLayout></BrowserRouter>;
}
