import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { getArenaUrl } from "../game/assets/arenaCatalog.js";
import { getChapterForPhase, getPhaseIndex, getUnlockedTroops } from "../game/content.js";
import { loadSettings } from "../campaign/storage.js";
import LoadoutHeader from "./LoadoutHeader.jsx";
import TroopRoster from "./TroopRoster.jsx";
import TroopStage from "./TroopStage.jsx";
import TacticalBrief from "./TacticalBrief.jsx";
import SquadDock from "./SquadDock.jsx";
import TroopDossierModal from "./TroopDossierModal.jsx";
import { useLoadoutAnimations } from "./useLoadoutAnimations.js";
import { useLoadoutQuality } from "./useLoadoutQuality.js";
import "./loadout.css";

export default function LoadoutPage({ phase, selected, onToggle, onStart, onBack }) {
  const rootRef = useRef(null);
  const infoTriggerRef = useRef(null);
  const startedRef = useRef(false);
  const limitTimerRef = useRef(null);
  const phaseIndex = getPhaseIndex(phase.id);
  const chapter = getChapterForPhase(phase);
  const loadoutLimit = phase.loadoutLimit ?? 5;
  const available = useMemo(() => getUnlockedTroops(phaseIndex), [phaseIndex]);
  const selectedTroops = useMemo(() => selected.map((id) => available.find((troop) => troop.id === id)).filter(Boolean), [available, selected]);
  const [focusedTroopId, setFocusedTroopId] = useState(() => selected[0] || available[0]?.id);
  const [hoverTroopId, setHoverTroopId] = useState(null);
  const [infoTroop, setInfoTroop] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [limitMessage, setLimitMessage] = useState("");
  const [capacityPulse, setCapacityPulse] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const settings = useMemo(() => loadSettings(), []);
  const quality = useLoadoutQuality(settings);
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
      setFocusedTroopId(selected[0] || available[0]?.id);
    }
  }, [available, focusedTroopId, selected]);
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
  const confirm = () => {
    if (startedRef.current || confirming || selected.length < 1 || selected.length > loadoutLimit) return;
    startedRef.current = true;
    setConfirming(true);
    runConfirm(() => onStart());
  };

  return <main
    ref={rootRef}
    className={`loadout-page loadout-bay chapter-${chapter.number} ${quality.reduceMotion ? "loadout-reduce-motion" : ""}`}
    style={{
      "--arena-image": `url(${getArenaUrl(phase.arenaId)})`,
      "--loadout-primary": phase.palette?.primary || chapter.palette.primary,
      "--loadout-accent": phase.palette?.accent || chapter.palette.accent,
      "--chapter-color": chapter.palette.primary,
      "--troop-color": focusedTroop?.color || "#22d3ee",
    }}
  >
    <div className="loadout-bay-backdrop" aria-hidden="true" />
    <LoadoutHeader phase={phase} chapter={chapter} selectedCount={selected.length} limit={loadoutLimit} onBack={onBack} />
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
        onInfo={openInfo}
      />
      <TroopStage
        troop={focusedTroop}
        selected={selected.includes(focusedTroop?.id)}
        quality={quality}
        arenaUrl={getArenaUrl(phase.arenaId)}
        onRuntimeReady={setRuntime}
      />
      <TacticalBrief
        phase={phase}
        chapter={chapter}
        arenaUrl={getArenaUrl(phase.arenaId)}
        troops={selectedTroops}
        canConfirm={selected.length >= 1 && selected.length <= loadoutLimit}
        confirming={confirming}
        onConfirm={confirm}
      />
      <SquadDock troops={selectedTroops} limit={loadoutLimit} onRemove={handleToggle} reduceMotion={quality.reduceMotion} capacityPulse={capacityPulse} />
    </div>
    <div className="loadout-announcer" aria-live="polite">{limitMessage || `${selected.length} de ${loadoutLimit} unidades selecionadas`}</div>
    <AnimatePresence>{infoTroop && <TroopDossierModal troop={infoTroop} onClose={closeInfo} returnFocusRef={infoTriggerRef} reduceMotion={quality.reduceMotion} />}</AnimatePresence>
  </main>;
}
