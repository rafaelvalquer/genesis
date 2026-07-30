import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { useNavigate } from "react-router-dom";
import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { loadSettings } from "../campaign/storage.js";
import CommandHeader from "./CommandHeader.jsx";
import CommandLoading from "./CommandLoading.jsx";
import CurrentOperation from "./CurrentOperation.jsx";
import ChapterProgress from "./ChapterProgress.jsx";
import LastOperation from "./LastOperation.jsx";
import TacticalStatus from "./TacticalStatus.jsx";
import CommandQuickActions from "./CommandQuickActions.jsx";
import CommandTransitionOverlay from "./CommandTransitionOverlay.jsx";
import { deriveOperationEnemies } from "./commandMetrics.js";
import { useCommandAnimations } from "./useCommandAnimations.js";
import { useCommandMetrics } from "./useCommandMetrics.js";
import { useCommandQuality } from "./useCommandQuality.js";
import "./command.css";

const CommandGlobe = lazy(() => import("./CommandGlobe.jsx"));

export default function CommandPage({ campaign, onReset }) {
  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const [runtime, setRuntime] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const navigate = useNavigate();
  const settings = useMemo(() => loadSettings(), []);
  const quality = useCommandQuality(settings);
  const metrics = useCommandMetrics(campaign);
  const { currentPhase, currentChapter } = metrics;
  const biome = getCampaignBiome(currentChapter.id);
  const enemies = useMemo(() => deriveOperationEnemies(currentPhase), [currentPhase]);
  const animations = useCommandAnimations({
    scope: rootRef, runtime, chapter: currentChapter, phase: currentPhase,
    reduceMotion: quality.reduceMotion, setTransitioning,
  });

  useEffect(() => {
    if (quality.reduceMotion) return undefined;
    if (!scanlineRef.current) return undefined;
    const loop = animate(scanlineRef.current, {
      translateY: ["-8vh", "108vh"], opacity: [.02, .18, .03],
      duration: 6800, loop: true, ease: "linear",
    });
    return () => loop.cancel();
  }, [quality.reduceMotion]);

  const openChapter = (data) => {
    if (!data.unlocked) return;
    const params = new URLSearchParams({ capitulo: String(data.chapter.number) });
    if (data.latestAccessible) params.set("fase", data.latestAccessible.id);
    navigate(`/fases?${params}`);
  };

  return <main
    ref={rootRef}
    className={`command-page command-biome-${biome.key}`}
    style={{
      "--command-primary": currentChapter.palette.primary,
      "--command-accent": currentChapter.palette.accent,
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
            phase={currentPhase}
            chapter={currentChapter}
            quality={quality}
            onRuntimeReady={setRuntime}
            onOpenMap={animations.openCampaign}
            scheduleReturn={animations.scheduleReturn}
          />
        </Suspense>
      </div>
      <CurrentOperation
        phase={currentPhase}
        chapter={currentChapter}
        stats={campaign.phaseStats?.[currentPhase.id] || {}}
        enemies={enemies}
        onOpenMap={animations.openCampaign}
        reduceMotion={quality.reduceMotion}
      />
    </section>
    <section className="command-lower-grid">
      <ChapterProgress chapters={metrics.chapters} onOpen={openChapter} onPreview={animations.previewChapter} reduceMotion={quality.reduceMotion} />
      <LastOperation operation={metrics.lastOperation} reduceMotion={quality.reduceMotion} />
      <TacticalStatus metrics={metrics} reduceMotion={quality.reduceMotion} />
      <CommandQuickActions onReset={onReset} reduceMotion={quality.reduceMotion} />
    </section>
    <CommandTransitionOverlay active={transitioning} />
  </main>;
}
