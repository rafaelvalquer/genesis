import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CHAPTERS, getChapterForPhase, getPhase, getPhaseIndex, PHASES } from "../game/content.js";
import { getArenaUrl } from "../game/assetCatalog.js";
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

const CampaignPlanet = lazy(() => import("./CampaignPlanet.jsx"));

export default function CampaignPage({ campaign }) {
  const rootRef = useRef(null);
  const scanlineRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const settings = useMemo(() => loadSettings(), []);
  const quality = useCampaignQuality(settings);
  const [runtime, setRuntime] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const { registerMarker, projectMarkers } = useProjectedMarkers();

  const currentPhase = PHASES[Math.min(campaign.unlockedPhaseIndex, PHASES.length - 1)] || PHASES[0];
  const currentChapter = getChapterForPhase(currentPhase) || CHAPTERS[0];
  const requestedNumber = Number(searchParams.get("capitulo"));
  const requestedChapter = CHAPTERS.find((entry) => entry.number === requestedNumber);
  const chapterUnlocked = (chapter) => getPhaseIndex(chapter.phaseIds[0]) <= campaign.unlockedPhaseIndex;
  const activeChapter = requestedChapter && chapterUnlocked(requestedChapter) ? requestedChapter : currentChapter;
  const phases = useMemo(() => activeChapter.phaseIds.map(getPhase).filter(Boolean), [activeChapter]);
  const previousChapterIdRef = useRef(activeChapter.id);
  const [selectedPhaseId, setSelectedPhaseId] = useState(() =>
    activeChapter.phaseIds.includes(campaign.currentPhaseId) ? campaign.currentPhaseId : phases.find((phase) => getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex)?.id,
  );

  const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId)
    || [...phases].reverse().find((phase) => getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex)
    || phases[0];

  useEffect(() => {
    if (!requestedChapter || !chapterUnlocked(requestedChapter)) {
      setSearchParams({ capitulo: String(currentChapter.number) }, { replace: true });
    }
  }, [requestedNumber, requestedChapter, currentChapter.number]);

  useEffect(() => {
    if (previousChapterIdRef.current === activeChapter.id) return;
    previousChapterIdRef.current = activeChapter.id;
    const preferred = activeChapter.phaseIds.includes(campaign.currentPhaseId)
      ? campaign.currentPhaseId
      : [...phases].reverse().find((phase) => getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex)?.id;
    setSelectedPhaseId(preferred || phases[0]?.id);
  }, [activeChapter.id]);

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

  const selectChapter = (chapter) => {
    if (!chapterUnlocked(chapter)) return;
    setSearchParams({ capitulo: String(chapter.number) });
  };
  const selectPhase = (phase) => {
    if (getPhaseIndex(phase.id) > campaign.unlockedPhaseIndex) return;
    setSelectedPhaseId(phase.id);
  };
  const biome = getCampaignBiome(activeChapter.id);

  return <main
    ref={rootRef}
    className={`campaign-map campaign-biome-${biome.key}`}
    style={{
      "--campaign-primary": activeChapter.palette.primary,
      "--campaign-accent": activeChapter.palette.accent,
      "--campaign-fog": biome.fog,
      "--campaign-cover": `url(${getArenaUrl(activeChapter.coverArenaId)})`,
    }}
  >
    <div ref={scanlineRef} className="campaign-scanline" aria-hidden="true" />
    <CampaignHeader campaign={campaign} chapter={activeChapter} />
    <section className="campaign-map-body">
      <div className="campaign-world">
        {webglFailed ? <CampaignWebGLFallback
          chapter={activeChapter}
          phases={phases}
          campaign={campaign}
          selectedPhase={selectedPhase}
          onSelectPhase={selectPhase}
        /> : <Suspense fallback={<CampaignLoading imageUrl={getArenaUrl(activeChapter.coverArenaId)} />}>
          <CampaignPlanet
            chapter={activeChapter}
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
        <div className="campaign-biome-label"><span>BIOMA ATIVO</span><b>{biome.detail}</b></div>
        {selectedPhase && <MissionPanel
          phase={selectedPhase}
          chapter={activeChapter}
          stats={campaign.phaseStats[selectedPhase.id] || {}}
          reduceMotion={quality.reduceMotion}
          onPrepare={() => navigate(`/jogar/${selectedPhase.id}`)}
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
