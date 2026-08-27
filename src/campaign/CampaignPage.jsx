import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { useSearchParams } from "react-router-dom";
import { CHAPTERS, getPhaseIndex } from "../game/content.js";
import { getArenaUrl } from "../game/assets/arenaCatalog.js";
import { preloadLoadoutRoute } from "../routing/routeModules.js";
import { useRouteTransition } from "../routing/RouteTransitionProvider.jsx";
import {
  getCampaignTransitionOrigin,
  playCampaignToLoadoutTransition,
} from "./campaignDepartureTransition.js";
import {
  createPhaseSelectionParams,
  isCampaignChapterUnlocked,
  resolveCampaignSelection,
  resolveChapterSelectionPhase,
} from "./campaignSelection.js";
import { loadSettings } from "./storage.js";
import CampaignHeader from "./CampaignHeader.jsx";
import ChapterRail from "./ChapterRail.jsx";
import MissionPanel from "./MissionPanel.jsx";
import CampaignLoading from "./CampaignLoading.jsx";
import CampaignWebGLFallback from "./CampaignWebGLFallback.jsx";
import { useCampaignQuality } from "./useCampaignQuality.js";
import { useProjectedMarkers } from "./useProjectedMarkers.js";
import { useCampaignAnimations } from "./useCampaignAnimations.js";
import { getCampaignBiome } from "./campaignBiomes.js";
import "./campaign-map.css";
import "../visual/genesis-world-themes.css";

const CampaignPlanet = lazy(() => import("./CampaignPlanet.jsx"));

export default function CampaignPage({ campaign }) {
  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const lastSelectedPhaseByChapterRef = useRef(
    new Map(),
  );
  const pendingSelectionRef = useRef(null);
  const {
    isTransitioning,
    transition,
    transitionTo,
  } = useRouteTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const settings = useMemo(() => loadSettings(), []);
  const quality = useCampaignQuality(settings);
  const [runtime, setRuntime] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const { registerMarker, projectMarkers } = useProjectedMarkers();

  const {
    activeChapter,
    selectedPhase,
    phases,
  } = resolveCampaignSelection({
    searchParams,
    unlockedPhaseIndex:
      campaign.unlockedPhaseIndex,
  });

  const chapterUnlocked = (chapter) => (
    isCampaignChapterUnlocked(
      chapter,
      campaign.unlockedPhaseIndex,
    )
  );

  useEffect(() => {
    if (!selectedPhase) return;
    const canonicalChapter = String(activeChapter.number);
    if (searchParams.get("capitulo") === canonicalChapter && searchParams.get("fase") === selectedPhase.id) {
      pendingSelectionRef.current = null;
      return;
    }
    const pendingSelection = pendingSelectionRef.current;
    if (pendingSelection
      && (pendingSelection.chapterNumber !== canonicalChapter
        || pendingSelection.phaseId !== selectedPhase.id)) {
      return;
    }
    pendingSelectionRef.current = null;
    const next = new URLSearchParams(searchParams);
    next.set("capitulo", canonicalChapter);
    next.set("fase", selectedPhase.id);
    setSearchParams(next, { replace: true });
  }, [activeChapter.number, selectedPhase?.id, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedPhase || !activeChapter) return;

    lastSelectedPhaseByChapterRef.current.set(
      activeChapter.id,
      selectedPhase.id,
    );
  }, [activeChapter?.id, selectedPhase?.id]);

  useEffect(() => {
    if (quality.reduceMotion || !scanlineRef.current) return undefined;
    const animation = animate(scanlineRef.current, {
      translateY: ["-10vh", "110vh"],
      opacity: [.05, .22, .04],
      duration: 6200,
      loop: true,
      ease: "linear",
    });
    return () => animation.cancel();
  }, [quality.reduceMotion]);

  useCampaignAnimations({
    scope: rootRef,
    runtime,
    chapter: activeChapter,
    selectedPhase,
    reduceMotion: quality.reduceMotion,
    sceneReady,
  });

  useEffect(() => {
    if (!selectedPhase) return undefined;

    const controller = new AbortController();

    preloadLoadoutRoute({
      arenaUrl: getArenaUrl(selectedPhase.arenaId),
      signal: controller.signal,
    }).catch((error) => {
      if (error?.name !== "AbortError") {
        console.warn(
          "Preload do loadout não foi concluído.",
          error,
        );
      }
    });

    return () => controller.abort();
  }, [selectedPhase?.arenaId]);

  const selectChapter = (chapter) => {
    if (!chapterUnlocked(chapter)) return;

    const nextPhase = (
      resolveChapterSelectionPhase({
        chapter,
        unlockedPhaseIndex:
          campaign.unlockedPhaseIndex,
        rememberedPhaseId:
          lastSelectedPhaseByChapterRef
            .current
            .get(chapter.id),
      })
    );

    if (!nextPhase) return;

    const next = createPhaseSelectionParams(
      searchParams,
      nextPhase,
    );

    if (next) {
      pendingSelectionRef.current = {
        chapterNumber: String(chapter.number),
        phaseId: next.get("fase"),
      };
      setSearchParams(next);
    }
  };

  const selectPhase = (phase) => {
    if (
      getPhaseIndex(phase.id)
      > campaign.unlockedPhaseIndex
    ) {
      return;
    }

    const next = createPhaseSelectionParams(
      searchParams,
      phase,
    );

    if (next) {
      pendingSelectionRef.current = {
        chapterNumber: next.get("capitulo"),
        phaseId: next.get("fase"),
      };
      setSearchParams(
        next,
        { replace: true },
      );
    }
  };

  const campaignTransitioning = (
    isTransitioning
    && transition.type === "campaign-to-loadout"
  );

  const prepareMission = () => {
    if (
      !selectedPhase
      || campaignTransitioning
    ) {
      return;
    }

    const arenaUrl = getArenaUrl(
      selectedPhase.arenaId,
    );

    const origin = (
      getCampaignTransitionOrigin(
        rootRef.current,
      )
    );

    transitionTo({
      type: "campaign-to-loadout",
      to: `/jogar/${selectedPhase.id}`,
      reduceMotion: quality.reduceMotion,
      payload: {
        phaseId: selectedPhase.id,
        chapterId: activeChapter.id,
        label: selectedPhase.name,
        arenaUrl,
        primary: (
          selectedPhase.palette?.primary
          || activeChapter.palette.primary
        ),
        accent: (
          selectedPhase.palette?.accent
          || activeChapter.palette.accent
        ),
        ...origin,
      },
      preload: ({ signal }) => (
        preloadLoadoutRoute({
          arenaUrl,
          signal,
        })
      ),
      exit: ({
        signal,
        updateProgress,
      }) => (
        playCampaignToLoadoutTransition({
          runtime,
          root: rootRef.current,
          phase: selectedPhase,
          reduceMotion: quality.reduceMotion,
          signal,
          updateProgress,
        })
      ),
    });
  };

  const biome = getCampaignBiome(activeChapter.id);

  return <main
    ref={rootRef}
    className={`campaign-map campaign-biome-${biome.key} ${campaignTransitioning ? "is-route-transitioning" : ""}`}
    data-world-theme={biome.key}
    data-world-signature={biome.planetEffects.signature}
    data-all-chapters-visible="true"
    aria-busy={campaignTransitioning}
    style={{
      "--campaign-primary": biome.ui.primary,
      "--campaign-secondary": biome.ui.secondary,
      "--campaign-accent": biome.ui.accent,
      "--campaign-fog": biome.fog,
      "--campaign-atmosphere": biome.atmosphere,
      "--campaign-panel": biome.ui.panel,
      "--campaign-panel-alt": biome.ui.panelAlt,
      "--campaign-theme-line": biome.ui.line,
      "--campaign-grid": biome.ui.grid,
      "--world-pattern-opacity": biome.ui.patternOpacity,
      "--campaign-cover": `url(${getArenaUrl(activeChapter.coverArenaId)})`,
    }}
  >
    <div ref={scanlineRef} className="campaign-scanline" aria-hidden="true" />
    <CampaignHeader campaign={campaign} chapter={activeChapter} />
    <section className="campaign-map-body">
      <div className="campaign-world">
        {webglFailed ? <CampaignWebGLFallback
          chapter={activeChapter}
          chapters={CHAPTERS}
          phases={phases}
          campaign={campaign}
          selectedPhase={selectedPhase}
          onSelectPhase={selectPhase}
        /> : <Suspense fallback={<CampaignLoading imageUrl={getArenaUrl(activeChapter.coverArenaId)} />}>
          <CampaignPlanet
            chapter={activeChapter}
            chapters={CHAPTERS}
            phases={phases}
            campaign={campaign}
            selectedPhase={selectedPhase}
            quality={quality}
            registerMarker={registerMarker}
            projectMarkers={projectMarkers}
            onSelectPhase={selectPhase}
            onRuntimeReady={(nextRuntime) => { setRuntime(nextRuntime); setSceneReady(true); }}
            onWebGLFailure={() => { setWebglFailed(true); setSceneReady(true); }}
          />
        </Suspense>}
        <div className="campaign-biome-label">
          <span>{biome.label.toUpperCase()}</span>
          <b>{biome.planetEffects.signature}</b>
        </div>
        {selectedPhase && <MissionPanel
          phase={selectedPhase}
          chapter={activeChapter}
          stats={campaign.phaseStats[selectedPhase.id] || {}}
          reduceMotion={quality.reduceMotion}
          onPrepare={prepareMission}
          transitioning={campaignTransitioning}
        />}
      </div>
      <ChapterRail
        chapters={CHAPTERS}
        activeChapter={activeChapter}
        campaign={campaign}
        onSelect={selectChapter}
      />
    </section>
  </main>;
}
