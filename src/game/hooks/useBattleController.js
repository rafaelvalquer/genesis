import { useCallback, useMemo, useRef, useState } from "react";
import { ENEMIES } from "../content.js";
import {
  activateTroopSpecial,
  createBattleSession,
  getSnapshot,
  placeTroop,
  removeTroop,
  startWave,
} from "../battleModel.js";
import { createGraphicsRuntime } from "../graphicsRuntime.js";
import { createBattleRowBuffers } from "../visualGeometry.js";
import { createBattleRenderPlan } from "../render/battleSceneRenderer.js";
import { createBattleOverlayModel } from "../components/battleOverlayModel.js";

function initialBanner(phase, sandbox) {
  if (sandbox) return "LABORATÓRIO · CAMPO DE PROVAS";
  if (phase.chapterMechanic?.id === "glass_echoes") {
    return `◇ ECOS DE VIDRO ${Math.round(phase.chapterMechanic.chance * 100)}% · FASE ${Number(phase.id.slice(-2))}`;
  }
  return `FASE ${Number(phase.id.slice(-2))} · ${phase.name}`;
}

/**
 * Battle state boundary. The mutable session remains in a ref; React receives
 * only UI snapshots and controls, preventing a render per simulation tick.
 */
export function useBattleController({ phase, unlockedTroops, sandbox = false }) {
  const loadout = useMemo(() => unlockedTroops.map((entry) => typeof entry === "string" ? entry : entry.id), [unlockedTroops]);
  // Phase-only render systems are resolved once rather than in the frame hot path.
  const renderPlan = useMemo(() => createBattleRenderPlan(phase), [phase]);
  const battleShellRef = useRef(null);
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);
  const sessionRef = useRef(null);
  const particlesRef = useRef([]);
  const graphicsRef = useRef(createGraphicsRuntime());
  const battleRowsRef = useRef(createBattleRowBuffers());
  const adaptiveSettingsRef = useRef({});
  const hoveredCellRef = useRef(null);
  const finishSentRef = useRef(false);
  const convoyDestructionRevealUntilRef = useRef(0);
  const audioRef = useRef({});
  const lastCriticalBeepRef = useRef(0);
  const notificationIdRef = useRef(1);
  const waveOutroCueRef = useRef(null);
  const convoyCountdownStepRef = useRef(null);
  const troopAnimationClockRef = useRef({ session: null, elapsed: 0, lastNow: 0, planning: false });
  if (!sessionRef.current) sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox });

  const [snapshot, setSnapshot] = useState(() => getSnapshot(sessionRef.current));
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [runtimeRevision, setRuntimeRevision] = useState(0);
  const [sandboxSettingsState, setSandboxSettingsState] = useState(() => ({ ...sessionRef.current.sandboxSettings }));
  const [selectedEnemy, setSelectedEnemy] = useState(() => Object.keys(ENEMIES)[0]);
  const [spawnRow, setSpawnRow] = useState(0);
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnAlpha, setSpawnAlpha] = useState(false);
  const [spawnGrouped, setSpawnGrouped] = useState(false);
  const [fortuneTier, setFortuneTier] = useState("critical");
  const [selectedTroop, setSelectedTroop] = useState(null);
  const [repositionTroopId, setRepositionTroopId] = useState(null);
  const [hoveredTroop, setHoveredTroop] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [targetingDecision, setTargetingDecision] = useState(null);
  const [graphicsMetrics, setGraphicsMetrics] = useState(null);
  const [notification, setNotification] = useState({ id: 0, text: "Selecione uma unidade e posicione-a no campo.", tone: "info", persistent: false });
  const [banner, setBanner] = useState(() => initialBanner(phase, sandbox));
  const refreshSnapshot = useCallback(() => setSnapshot(getSnapshot(sessionRef.current)), []);
  const actions = useMemo(() => ({
    placeTroop: (type, row, col) => {
      const result = placeTroop(sessionRef.current, type, row, col);
      refreshSnapshot();
      return result;
    },
    removeTroop: (row, col) => {
      const result = removeTroop(sessionRef.current, row, col);
      refreshSnapshot();
      return result;
    },
    activateSpecial: (troopId) => {
      const result = activateTroopSpecial(sessionRef.current, troopId);
      refreshSnapshot();
      return result;
    },
    startWave: () => {
      const result = startWave(sessionRef.current);
      refreshSnapshot();
      return result;
    },
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    changeSpeed: (nextSpeed) => setSpeed(nextSpeed),
  }), [refreshSnapshot]);
  const getRenderScene = useCallback(() => ({
    session: sessionRef.current,
    assets: assetsRef.current,
    settings: adaptiveSettingsRef.current,
    graphicsRuntime: graphicsRef.current,
    renderPlan,
  }), [renderPlan]);
  const getOverlayModel = useCallback(({ fortuneBlocksIntermission }) => createBattleOverlayModel({
    snapshot,
    notification,
    fortuneBlocksIntermission,
    session: sessionRef.current,
  }), [snapshot, notification]);

  return {
    loadout, battleShellRef, canvasRef, assetsRef, sessionRef, particlesRef, graphicsRef, battleRowsRef,
    adaptiveSettingsRef, hoveredCellRef, finishSentRef, convoyDestructionRevealUntilRef, audioRef,
    lastCriticalBeepRef, notificationIdRef, waveOutroCueRef, convoyCountdownStepRef, troopAnimationClockRef,
    snapshot, setSnapshot, paused, setPaused, speed, setSpeed, runtimeRevision, setRuntimeRevision,
    sandboxSettingsState, setSandboxSettingsState, selectedEnemy, setSelectedEnemy, spawnRow, setSpawnRow,
    spawnCount, setSpawnCount, spawnAlpha, setSpawnAlpha, spawnGrouped, setSpawnGrouped, fortuneTier,
    setFortuneTier, selectedTroop, setSelectedTroop, repositionTroopId, setRepositionTroopId, hoveredTroop,
    setHoveredTroop, removeMode, setRemoveMode, targetingDecision, setTargetingDecision, graphicsMetrics,
    setGraphicsMetrics, notification, setNotification, banner, setBanner, actions, renderPlan, getRenderScene, getOverlayModel,
  };
}

export default useBattleController;
