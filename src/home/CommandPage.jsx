import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { loadSettings } from "../campaign/storage.js";
import { CHAPTERS, getPhase, getPhaseIndex } from "../game/content.js";
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

const CommandGlobe = lazy(() => import("./CommandGlobe.jsx"));

export default function CommandPage({ campaign }) {
  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const settings = useMemo(() => loadSettings(), []);
  const quality = useCommandQuality(settings);
  const metrics = useCommandMetrics(campaign);
  const { currentPhase, currentChapter } = metrics;
  const [previewChapterId, setPreviewChapterId] = useState(currentChapter.id);
  const [hoverChapterId, setHoverChapterId] = useState(null);
  const [previewPhaseId, setPreviewPhaseId] = useState(currentPhase.id);
  const displayedChapter = CHAPTERS.find((chapter) => chapter.id === (hoverChapterId || previewChapterId))
    || currentChapter;
  const displayedPhases = useMemo(() => displayedChapter.phaseIds.map(getPhase).filter(Boolean), [displayedChapter]);
  const defaultDisplayedPhase = displayedChapter.phaseIds.includes(currentPhase.id)
    ? currentPhase
    : [...displayedPhases].reverse().find((entry) => getPhaseIndex(entry.id) <= campaign.unlockedPhaseIndex)
      || displayedPhases[0];
  const displayedPhase = displayedPhases.find((entry) => entry.id === previewPhaseId)
    && displayedChapter.phaseIds.includes(previewPhaseId)
    ? getPhase(previewPhaseId) : defaultDisplayedPhase;
  const biome = getCampaignBiome(displayedChapter.id);
  const enemies = useMemo(() => deriveOperationEnemies(currentPhase), [currentPhase]);
  const animations = useCommandAnimations({ scope: rootRef, reduceMotion: quality.reduceMotion });

  useEffect(() => {
    setPreviewChapterId(currentChapter.id);
    setPreviewPhaseId(currentPhase.id);
  }, [currentChapter.id, currentPhase.id]);

  useEffect(() => {
    if (quality.reduceMotion) return undefined;
    if (!scanlineRef.current) return undefined;
    const loop = animate(scanlineRef.current, {
      translateY: ["-8vh", "108vh"], opacity: [.02, .18, .03],
      duration: 6800, loop: true, ease: "linear",
    });
    return () => loop.cancel();
  }, [quality.reduceMotion]);

  const selectChapter = (data) => {
    if (!data.unlocked) return;
    setPreviewChapterId(data.chapter.id);
    setPreviewPhaseId(data.latestAccessible?.id || data.phases[0]?.id);
  };
  const previewChapter = (chapter) => setHoverChapterId(chapter?.id || null);

  return <main
    ref={rootRef}
    className={`command-page command-biome-${biome.key}`}
    style={{
      "--command-primary": displayedChapter.palette.primary,
      "--command-accent": displayedChapter.palette.accent,
      "--command-atmosphere": biome.atmosphere,
      "--command-fog": biome.fog,
    }}
  >
    <div ref={scanlineRef} className="command-scanline" aria-hidden="true" />
    <CommandHeader chapter={currentChapter} phase={currentPhase} />
    <section className="command-primary-grid">
      <div className="command-orbital-window command-module">
        <div className="command-window-heading"><span>VISUALIZAÇÃO ORBITAL</span><b>SETOR {currentPhase.id.slice(-2)} // COORDENADAS SINCRONIZADAS</b></div>
        <Suspense fallback={<CommandLoading />}>
          <CommandGlobe
            phase={displayedPhase}
            chapter={displayedChapter}
            phases={displayedPhases}
            campaign={campaign}
            quality={quality}
            previewing={displayedChapter.id !== currentChapter.id}
            onSelectPhase={(phase) => setPreviewPhaseId(phase.id)}
            focusRuntime={animations.focusRuntime}
            scheduleReturn={animations.scheduleReturn}
          />
        </Suspense>
      </div>
      <CurrentOperation
        phase={currentPhase}
        chapter={currentChapter}
        enemies={enemies}
        reduceMotion={quality.reduceMotion}
      />
    </section>
    <section className="command-lower-grid">
      <ChapterProgress
        chapters={metrics.chapters}
        metrics={metrics}
        displayedChapter={displayedChapter}
        onSelect={selectChapter}
        onPreview={previewChapter}
        reduceMotion={quality.reduceMotion}
      />
      <LastOperation operation={metrics.lastOperation} reduceMotion={quality.reduceMotion} />
    </section>
  </main>;
}
