import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { getArenaUrl } from "../game/assets/arenaCatalog.js";
import { getChapterForPhase, getPhaseIndex, getUnlockedTroops } from "../game/content.js";
import { loadSettings } from "../campaign/storage.js";
import { useRouteTransition } from "../routing/RouteTransitionProvider.jsx";
import LoadoutHeader from "./LoadoutHeader.jsx";
import TroopRoster from "./TroopRoster.jsx";
import TroopStage from "./TroopStage.jsx";
import TacticalBrief from "./TacticalBrief.jsx";
import SquadDock from "./SquadDock.jsx";
import TroopDossierModal from "./TroopDossierModal.jsx";
import { useLoadoutAnimations } from "./useLoadoutAnimations.js";
import { useLoadoutQuality } from "./useLoadoutQuality.js";
import "./loadout.css";

export default function LoadoutPage({ phase, selected, initialFocusedTroopId, unlockedPhaseIndex, onToggle, onStart, onBack }) {
  const rootRef = useRef(null);
  const infoTriggerRef = useRef(null);
  const startedRef = useRef(false);
  const limitTimerRef = useRef(null);
  const phaseIndex = getPhaseIndex(phase.id);
  const chapter = getChapterForPhase(phase);
  const loadoutLimit = phase.loadoutLimit ?? 5;
  const available = useMemo(() => getUnlockedTroops(phaseIndex), [phaseIndex]);
  const selectedTroops = useMemo(() => selected.map((id) => available.find((troop) => troop.id === id)).filter(Boolean), [available, selected]);
  const [focusedTroopId, setFocusedTroopId] = useState(() => (available.some((troop) => troop.id === initialFocusedTroopId) ? initialFocusedTroopId : null) || selected.at(-1) || available[0]?.id);
  const [hoverTroopId, setHoverTroopId] = useState(null);
  const [infoTroop, setInfoTroop] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [limitMessage, setLimitMessage] = useState("");
  const [capacityPulse, setCapacityPulse] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [catalogType, setCatalogType] = useState("all");
  const [catalogSort, setCatalogSort] = useState("appearance");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const settings = useMemo(() => loadSettings(), []);
  const quality = useLoadoutQuality(settings);
  const {
    completeTransition,
    matchesTransition,
  } = useRouteTransition();
  const arrivingFromCampaign = (
    matchesTransition({
      type: "campaign-to-loadout",
      phaseId: phase.id,
    })
  );
  const focusedTroop = available.find((troop) => troop.id === (hoverTroopId || focusedTroopId)) || available[0];
  const { runConfirm } = useLoadoutAnimations({
    scope: rootRef,
    runtime,
    focusedTroop,
    selectedCount: selected.length,
    reduceMotion: quality.reduceMotion,
  });

  useEffect(() => {
    if (!available.some((troop) => troop.id === focusedTroopId)) {
      setFocusedTroopId(selected.at(-1) || available[0]?.id);
    }
  }, [available, focusedTroopId, selected]);
  useEffect(() => {
    if (initialFocusedTroopId && available.some((troop) => troop.id === initialFocusedTroopId)) {
      setFocusedTroopId(initialFocusedTroopId);
    }
  }, [initialFocusedTroopId, available]);
  useEffect(() => () => window.clearTimeout(limitTimerRef.current), []);

  const showLimit = () => {
    window.clearTimeout(limitTimerRef.current);
    setLimitMessage("CAPACIDADE MÁXIMA ATINGIDA");
    setCapacityPulse(true);
    limitTimerRef.current = window.setTimeout(() => {
      setLimitMessage("");
      setCapacityPulse(false);
    }, 1800);
  };
  const handleToggle = (troopId) => {
    if (!selected.includes(troopId) && selected.length >= loadoutLimit) {
      showLimit();
      return;
    }
    onToggle(troopId);
  };
  const openInfo = (troop, trigger) => {
    infoTriggerRef.current = trigger;
    setInfoTroop(troop);
  };
  const closeInfo = useCallback(() => setInfoTroop(null), []);

  const handleStageReady = useCallback(() => {
    if (
      !matchesTransition({
        type: "campaign-to-loadout",
        phaseId: phase.id,
      })
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        completeTransition();
      });
    });
  }, [
    completeTransition,
    matchesTransition,
    phase.id,
  ]);
  const confirm = () => {
    if (startedRef.current || confirming || selected.length < 1 || selected.length > loadoutLimit) return;
    startedRef.current = true;
    setConfirming(true);
    runConfirm(() => onStart());
  };

  return <main
    ref={rootRef}
    className={`loadout-page loadout-bay chapter-${chapter.number} ${quality.reduceMotion ? "loadout-reduce-motion" : ""} ${arrivingFromCampaign ? "route-arrival-campaign" : ""}`}
    style={{
      "--arena-image": `url(${getArenaUrl(phase.arenaId)})`,
      "--loadout-primary": phase.palette?.primary || chapter.palette.primary,
      "--loadout-accent": phase.palette?.accent || chapter.palette.accent,
      "--chapter-color": chapter.palette.primary,
      "--troop-color": focusedTroop?.color || "#22d3ee",
    }}
  >
    <div className="loadout-bay-backdrop" aria-hidden="true" />
    <LoadoutHeader phase={phase} chapter={chapter} selectedCount={selected.length} limit={loadoutLimit} onBack={onBack} onMissionInfo={() => setBriefOpen(true)} />
    <div className="loadout-workbench">
      <TroopRoster
        troops={available}
        selected={selected}
        focusedTroopId={focusedTroopId}
        hoverTroopId={hoverTroopId}
        atLimit={selected.length >= loadoutLimit}
        reduceMotion={quality.reduceMotion}
        onToggle={handleToggle}
        onFocusTroop={setFocusedTroopId}
        onHoverTroop={setHoverTroopId}
        catalogType={catalogType}
        catalogSort={catalogSort}
        catalogSearch={catalogSearch}
        onTypeChange={setCatalogType}
        onSortChange={setCatalogSort}
        onSearchChange={setCatalogSearch}
      />
      <TroopStage
        troop={focusedTroop}
        selected={selected.includes(focusedTroop?.id)}
        onInfo={(event) => openInfo(focusedTroop, event.currentTarget)}
        quality={quality}
        arenaUrl={getArenaUrl(phase.arenaId)}
        onRuntimeReady={setRuntime}
        onStageReady={handleStageReady}
      />
      <SquadDock troops={selectedTroops} limit={loadoutLimit} onRemove={handleToggle} reduceMotion={quality.reduceMotion} capacityPulse={capacityPulse} canConfirm={selected.length >= 1 && selected.length <= loadoutLimit} confirming={confirming} onConfirm={confirm} />
    </div>
    <div className="loadout-announcer" aria-live="polite">{limitMessage || `${selected.length} de ${loadoutLimit} unidades selecionadas`}</div>
    <AnimatePresence>{infoTroop && <TroopDossierModal troop={infoTroop} onClose={closeInfo} returnFocusRef={infoTriggerRef} reduceMotion={quality.reduceMotion} />}</AnimatePresence>
    <AnimatePresence>{briefOpen && <div className="mission-brief-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBriefOpen(false); }}><div className="mission-brief-drawer" role="dialog" aria-modal="true" aria-labelledby="mission-brief-title"><button type="button" className="mission-brief-close" aria-label="Fechar briefing da missão" onClick={() => setBriefOpen(false)}>×</button><h2 id="mission-brief-title" className="sr-only">Briefing da missão</h2><TacticalBrief phase={phase} chapter={chapter} arenaUrl={getArenaUrl(phase.arenaId)} troops={selectedTroops} unlockedPhaseIndex={unlockedPhaseIndex} canConfirm={selected.length >= 1 && selected.length <= loadoutLimit} confirming={confirming} onConfirm={confirm} /></div></div>}</AnimatePresence>
  </main>;
}
