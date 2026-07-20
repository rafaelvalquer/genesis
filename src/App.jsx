import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import GameCanvas from "./game/GameCanvas.jsx";
import { getArenaUrl, getEnemyPreviewUrl, getTroopPreviewUrl } from "./game/assetCatalog.js";
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
        <p>Monte seu esquadrão, controle cinco rotas e atravesse três capítulos de uma campanha com vinte e quatro fases.</p>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedNumber = Number(searchParams.get("capitulo"));
  const currentPhaseChapter = getChapterForPhase(PHASES[campaign.unlockedPhaseIndex]);
  const requestedChapter = CHAPTERS.find((entry) => entry.number === requestedNumber);
  const isChapterUnlocked = (chapter) => getPhaseIndex(chapter.phaseIds[0]) <= campaign.unlockedPhaseIndex;
  const activeChapter = requestedChapter && isChapterUnlocked(requestedChapter) ? requestedChapter : currentPhaseChapter;
  const visiblePhases = activeChapter.phaseIds.map(getPhase).filter(Boolean);
  return <main className={`page-content chapter-page chapter-${activeChapter.number}`} style={{ "--chapter-primary": activeChapter.palette.primary, "--chapter-accent": activeChapter.palette.accent, "--chapter-cover": `url(${getArenaUrl(activeChapter.coverArenaId)})` }}>
    <header className="page-heading"><div><span className="eyebrow">MAPA DE OPERAÇÕES</span><h1>Campanha</h1><p>Complete uma operação para abrir o próximo setor.</p></div><div className="campaign-counter"><b>{campaign.unlockedPhaseIndex + 1}</b><span>setores<br />acessíveis</span></div></header>
    <section className="chapter-tabs" aria-label="Capítulos da campanha">{CHAPTERS.map((chapter) => {
      const locked = !isChapterUnlocked(chapter);
      const completeCount = chapter.phaseIds.filter((phaseId) => Number(campaign.phaseStats[phaseId]?.victories || 0) > 0).length;
      return <button key={chapter.id} type="button" disabled={locked} className={chapter.id === activeChapter.id ? "active" : ""} onClick={() => setSearchParams({ capitulo: String(chapter.number) })}>
        <span className="chapter-tab-number">0{chapter.number}</span><span><small>{locked ? "BLOQUEADO" : `${completeCount}/${chapter.phaseIds.length} CONCLUÍDAS`}</small><b>{chapter.name}</b><em>{chapter.subtitle}</em></span>
      </button>;
    })}</section>
    <section className="chapter-hero"><div><span className="eyebrow">CAPÍTULO {activeChapter.number}</span><h2>{activeChapter.name}</h2><p>{activeChapter.subtitle}</p>{activeChapter.mechanic && <div className="chapter-mechanic"><b>◇ {activeChapter.mechanic.label}</b><span>{activeChapter.mechanic.description}</span></div>}</div></section>
    <section className="phase-grid">{visiblePhases.map((phase) => {
      const index = getPhaseIndex(phase.id);
      const locked = index > campaign.unlockedPhaseIndex;
      const stats = campaign.phaseStats[phase.id] || {};
      const enemyTypes = [...new Set(phase.waves.flatMap((wave) => wave.enemies.map((entry) => entry.type)))];
      const card = <article className={`phase-card environment-${phase.environment} ${locked ? "locked" : ""}`}>
        <div className="phase-number">{String(index + 1).padStart(2, "0")}</div>
        <div className="phase-art"><img src={getArenaUrl(phase.arenaId)} alt="" /><span className="arena-card-shade" /><span className="terrain-lines" /><span className="phase-icon">{phase.boss ? "◉" : locked ? "◇" : "⬡"}</span></div>
        <div className="phase-body"><span className="eyebrow">{locked ? "SETOR BLOQUEADO" : phase.subtitle}</span><h2>{phase.name}</h2><div className="enemy-tags">{enemyTypes.map((type) => <span key={type}>{ENEMIES[type]?.label || type}</span>)}</div><div className="phase-record"><Stars value={stats.bestStars || 0} /><span>Melhor tempo <b>{formatTime(stats.bestTimeMs)}</b></span><span>Integridade <b>{stats.bestIntegrity || 0}%</b></span></div></div>
        <div className="phase-footer"><span>⚡ {phase.energy}</span><span>◫ {phase.waves.length} ondas</span><span>{phase.chapterMechanic ? `${Math.round(phase.chapterMechanic.chance * 100)}% ECOS` : phase.environment.toUpperCase()}</span></div>
      </article>;
      return locked ? <div key={phase.id}>{card}</div> : <Link key={phase.id} to={`/jogar/${phase.id}`} aria-label={`Jogar ${phase.name}`}>{card}</Link>;
    })}</section>
  </main>;
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

function TroopInfoModal({ troop, onClose, returnFocusRef }) {
  const closeButtonRef = useRef(null);
  const { stats, specials } = getTroopInfo(troop);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return createPortal(<div className="modal-backdrop troop-info-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="troop-info-modal" role="dialog" aria-modal="true" aria-labelledby={`troop-info-title-${troop.id}`}>
      <button ref={closeButtonRef} type="button" className="troop-info-close" aria-label={`Fechar informações de ${troop.label}`} onClick={onClose}>×</button>
      <div className="troop-info-portrait" style={{ "--troop-color": troop.color }}>
        <img src={getTroopPreviewUrl(troop.id)} alt={troop.label} />
        <span>{troop.role}</span>
      </div>
      <div className="troop-info-content">
        <span className="eyebrow">Dossiê da unidade</span>
        <h2 id={`troop-info-title-${troop.id}`}>{troop.label}</h2>
        {troop.title && <small className="unit-title">{troop.title}</small>}
        <p>{troop.description}</p>
        <dl className="troop-info-stats">{stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        {specials.length > 0 && <div className="troop-info-specials">
          <span className="eyebrow amber">Características especiais</span>
          <dl>{specials.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        </div>}
      </div>
    </section>
  </div>, document.body);
}

export function LoadoutPicker({ phase, selected, onToggle, onStart, onBack }) {
  const phaseIndex = getPhaseIndex(phase.id);
  const chapter = getChapterForPhase(phase);
  const loadoutLimit = phase.loadoutLimit ?? 5;
  const loadoutLimitLabel = loadoutLimit === 6 ? "seis" : String(loadoutLimit);
  const available = getUnlockedTroops(phaseIndex);
  const [infoTroop, setInfoTroop] = useState(null);
  const infoTriggerRef = useRef(null);
  const closeInfo = useCallback(() => setInfoTroop(null), []);
  return <main className={`loadout-page chapter-${chapter.number}`} style={{ "--arena-image": `url(${getArenaUrl(phase.arenaId)})`, "--arena-primary": phase.palette.primary, "--arena-accent": phase.palette.accent }}>
    <div className="loadout-arena-backdrop" aria-hidden="true" />
    <header className="loadout-header"><button className="back-link" onClick={onBack}>← Voltar</button><div><span className="eyebrow">CAPÍTULO {chapter.number} · BRIEFING · {phase.id.replace("_", " ")}</span><h1>{phase.name}</h1><p>{phase.subtitle}. Escolha de uma a {loadoutLimitLabel} unidades para a operação.</p></div><div className="selection-count"><strong>{selected.length}</strong><span>/ {loadoutLimit}<br />selecionadas</span></div></header>
    <section className="loadout-layout">
      <div className="unit-grid">{available.map((troop) => {
        const active = selected.includes(troop.id);
        return <article key={troop.id} className={`unit-card ${active ? "active" : ""}`}>
          <button type="button" className="unit-select" aria-pressed={active} aria-label={`${active ? "Remover" : "Selecionar"} ${troop.label}`} onClick={() => onToggle(troop.id)}>
            <span className="unit-check">{active ? "✓" : "+"}</span>
            <span className={`unit-portrait ${troop.id === "artilheiraMorteiro" ? "wide-sprite" : ""} ${troop.flipX ? "flipped-sprite" : ""}`}><img src={getTroopPreviewUrl(troop.id)} alt="" /><span style={{ background: troop.color }} /></span>
            <span className="unit-info"><span className="eyebrow">{troop.role}</span><h2>{troop.label}</h2>{troop.title && <small className="unit-title">{troop.title}</small>}<p>{troop.description}</p><span className="unit-summary"><span>⚡ {troop.price}</span><span>SUP {troop.supply}</span><span>HP {troop.hp}</span></span></span>
          </button>
          <button type="button" className="unit-info-button" aria-label={`Informações de ${troop.label}`} onClick={(event) => {
            infoTriggerRef.current = event.currentTarget;
            setInfoTroop(troop);
          }}>i</button>
        </article>;
      })}</div>
      <aside className="mission-brief">
        <div className="brief-arena"><img src={getArenaUrl(phase.arenaId)} alt={`Campo de batalha ${phase.name}`} /><span>ARENA SINCRONIZADA</span></div>
        <span className="eyebrow amber">Parâmetros da missão</span><h2>Dados táticos</h2>
        <dl><div><dt>Ondas</dt><dd>{phase.waves.length}</dd></div><div><dt>Energia</dt><dd>{phase.energy}</dd></div><div><dt>Integridade</dt><dd>100%</dd></div><div><dt>Cadência</dt><dd>{(phase.cadenceMs / 1000).toFixed(2)}s</dd></div><div><dt>Tempo-alvo</dt><dd>{formatTime(phase.targetDurationMs)}</dd></div></dl>
        <div className={`environment-note ${phase.chapterMechanic ? "mechanic-warning" : ""}`}><b>{phase.chapterMechanic ? "◇ Ecos de Vidro" : `Ambiente · ${phase.environment}`}</b><span>{phase.chapterMechanic ? `${Math.round(phase.chapterMechanic.chance * 100)}% de chance: hostis comuns podem retornar com 45% de vida, mais velozes e com dano reduzido.` : "Tratamento visual, sem penalidades ocultas."}</span></div>
        <button className="primary-button full" disabled={selected.length < 1 || selected.length > loadoutLimit} onClick={onStart}>Confirmar loadout <span>→</span></button>
      </aside>
    </section>
    {infoTroop && <TroopInfoModal troop={infoTroop} onClose={closeInfo} returnFocusRef={infoTriggerRef} />}
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
    <section className="settings-grid"><article><span className="eyebrow">Áudio</span><h2>Mixer tático</h2>{range("masterVolume", "Volume geral")}{range("musicVolume", "Música")}{range("effectsVolume", "Efeitos")}</article><article><span className="eyebrow">Vídeo</span><h2>Renderização</h2><label className="select-setting"><span><b>Qualidade</b><small>Perfil de efeitos e partículas</small></span><select value={settings.quality} onChange={(event) => update("quality", event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><label className="toggle-setting"><span><b>Tremor de câmera</b><small>Impacto de ataques e rupturas</small></span><input type="checkbox" checked={settings.cameraShake} onChange={(event) => update("cameraShake", event.target.checked)} /></label></article><article><span className="eyebrow">Acessibilidade</span><h2>Conforto visual</h2><label className="toggle-setting"><span><b>Reduzir movimento</b><small>Minimiza transições da interface</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} /></label><label className="select-setting"><span><b>Modo de cores</b><small>Reforço de contraste visual</small></span><select value={settings.colorMode} onChange={(event) => update("colorMode", event.target.value)}><option value="normal">Normal</option><option value="protanopia">Protanopia</option><option value="deuteranopia">Deuteranopia</option><option value="contrast">Alto contraste</option></select></label></article></section>
  </main>;
}

export default function App() {
  const [campaign, setCampaign] = useState(loadCampaign);
  const handleReset = () => {
    if (window.confirm("Apagar todo o progresso local da campanha?")) setCampaign(resetCampaign());
  };
  return <BrowserRouter><AppLayout><Routes><Route path="/" element={<HomePage campaign={campaign} onReset={handleReset} />} /><Route path="/fases" element={<PhaseSelectPage campaign={campaign} />} /><Route path="/enciclopedia" element={<EncyclopediaPage campaign={campaign} />} /><Route path="/jogar/:phaseId" element={<PlayPage campaign={campaign} setCampaign={setCampaign} />} /><Route path="/testes" element={<TestLabPage />} /><Route path="/configuracoes" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppLayout></BrowserRouter>;
}
