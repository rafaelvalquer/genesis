import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { loadSettings } from "../campaign/storage.js";
import { CHAPTERS, getPhase, getPhaseIndex } from "../game/content.js";
import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";
import CommandHeader from "./CommandHeader.jsx";
import CommandLoading from "./CommandLoading.jsx";
import CurrentOperation from "./CurrentOperation.jsx";
import ChapterProgress from "./ChapterProgress.jsx";
import LastOperation from "./LastOperation.jsx";
import { deriveOperationEnemies } from "./commandMetrics.js";
import { useCommandAnimations } from "./useCommandAnimations.js";
import { useCommandMetrics } from "./useCommandMetrics.js";
import { useCommandQuality } from "./useCommandQuality.js";
import "./command.css";
import "./command-selection-enhancements.css";
import "../visual/genesis-world-themes.css";

const CommandGlobe = lazy(() => import("./CommandGlobe.jsx"));

function findDefaultPhase({
  chapter,
  phases,
  currentPhase,
  campaign,
}) {
  if (chapter.phaseIds.includes(currentPhase.id)) return currentPhase;

  return [...phases]
    .reverse()
    .find((entry) => getPhaseIndex(entry.id) <= campaign.unlockedPhaseIndex)
    || phases[0]
    || currentPhase;
}

export default function CommandPage({ campaign }) {
  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const settings = useMemo(() => loadSettings(), []);
  const quality = useCommandQuality(settings);
  const metrics = useCommandMetrics(campaign);
  const { currentPhase, currentChapter } = metrics;

  const [selectedChapterId, setSelectedChapterId] = useState(currentChapter.id);
  const [selectedPhaseId, setSelectedPhaseId] = useState(currentPhase.id);

  const displayedChapter = useMemo(
    () => CHAPTERS.find((chapter) => chapter.id === selectedChapterId) || currentChapter,
    [selectedChapterId, currentChapter],
  );

  const displayedPhases = useMemo(
    () => displayedChapter.phaseIds.map(getPhase).filter(Boolean),
    [displayedChapter],
  );

  const defaultDisplayedPhase = useMemo(
    () => findDefaultPhase({
      chapter: displayedChapter,
      phases: displayedPhases,
      currentPhase,
      campaign,
    }),
    [displayedChapter, displayedPhases, currentPhase, campaign],
  );

  const displayedPhase = useMemo(() => {
    const selected = displayedPhases.find((entry) => entry.id === selectedPhaseId);
    return selected || defaultDisplayedPhase;
  }, [displayedPhases, selectedPhaseId, defaultDisplayedPhase]);

  const biome = getCampaignBiome(displayedChapter.id);
  const enemies = useMemo(
    () => deriveOperationEnemies(displayedPhase),
    [displayedPhase],
  );
  const displayedPhaseState = useMemo(
    () => getCampaignPhaseState(displayedPhase, campaign),
    [displayedPhase, campaign],
  );

  const previewing = displayedChapter.id !== currentChapter.id
    || displayedPhase.id !== currentPhase.id;

  const animations = useCommandAnimations({
    scope: rootRef,
    reduceMotion: quality.reduceMotion,
  });

  useEffect(() => {
    setSelectedChapterId(currentChapter.id);
    setSelectedPhaseId(currentPhase.id);
  }, [currentChapter.id, currentPhase.id]);

  useEffect(() => {
    if (quality.reduceMotion) return undefined;
    if (!scanlineRef.current) return undefined;

    const loop = animate(scanlineRef.current, {
      translateY: ["-8vh", "108vh"],
      opacity: [.02, .18, .03],
      duration: 6800,
      loop: true,
      ease: "linear",
    });

    return () => loop.cancel();
  }, [quality.reduceMotion]);

  const selectChapter = (data) => {
    if (!data.unlocked) return;

    const nextPhase = data.latestAccessible
      || data.phases.find((phase) => getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex)
      || data.phases[0];

    setSelectedChapterId(data.chapter.id);
    setSelectedPhaseId(nextPhase?.id || currentPhase.id);
  };

  const selectPhase = (phase) => {
    const phaseState = getCampaignPhaseState(phase, campaign);
    if (!phaseState.accessible) return;
    setSelectedPhaseId(phase.id);
  };

  return <main
    ref={rootRef}
    className={`command-page command-biome-${biome.key}`}
    data-selected-chapter={displayedChapter.id}
    data-selected-phase={displayedPhase.id}
    data-world-theme={biome.key}
    data-world-signature={biome.planetEffects.signature}
    style={{
      "--command-primary": biome.ui.primary,
      "--command-secondary": biome.ui.secondary,
      "--command-accent": biome.ui.accent,
      "--command-danger": biome.ui.warning,
      "--command-atmosphere": biome.atmosphere,
      "--command-fog": biome.fog,
      "--command-panel": biome.ui.panel,
      "--command-panel-alt": biome.ui.panelAlt,
      "--command-theme-line": biome.ui.line,
      "--command-line": biome.ui.line,
      "--command-theme-glow": biome.ui.glow,
      "--command-grid": biome.ui.grid,
      "--world-pattern-opacity": biome.ui.patternOpacity,
    }}
  >
    <div ref={scanlineRef} className="command-scanline" aria-hidden="true" />
    <CommandHeader chapter={currentChapter} phase={currentPhase} />

    <section
      id="command-orbital-preview"
      className="command-primary-grid"
      aria-label={`Capítulo ${displayedChapter.number}: ${displayedChapter.name}. Operação selecionada: ${displayedPhase.name}.`}
    >
      <div className="command-orbital-window command-module">
        <div className="command-window-heading">
          <span>VISUALIZAÇÃO ORBITAL</span>
          <b>
            CAPÍTULO {String(displayedChapter.number).padStart(2, "0")}
            {" // "}
            SETOR {displayedPhase.id.slice(-2)}
          </b>
        </div>

        <Suspense fallback={<CommandLoading />}>
          <CommandGlobe
            phase={displayedPhase}
            chapter={displayedChapter}
            phases={displayedPhases}
            campaign={campaign}
            quality={quality}
            previewing={previewing}
            onSelectPhase={selectPhase}
            focusRuntime={animations.focusRuntime}
            scheduleReturn={animations.scheduleReturn}
          />
        </Suspense>
      </div>

      <CurrentOperation
        phase={displayedPhase}
        chapter={displayedChapter}
        phaseState={displayedPhaseState}
        enemies={enemies}
        previewing={previewing}
        reduceMotion={quality.reduceMotion}
      />
    </section>

    <section className="command-lower-grid">
      <ChapterProgress
        chapters={metrics.chapters}
        metrics={metrics}
        displayedChapter={displayedChapter}
        onSelect={selectChapter}
        reduceMotion={quality.reduceMotion}
      />
      <LastOperation
        operation={metrics.lastOperation}
        reduceMotion={quality.reduceMotion}
      />
    </section>
  </main>;
}
