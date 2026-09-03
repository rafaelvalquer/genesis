import {
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { DECISION_STAGE_RULES,
  ENEMIES,
  TROOPS } from "./content.js";
import { getArenaUrl } from "./assets/arenaCatalog.js";
import { getTroopPreviewUrl } from "./assets/troopPreviewCatalog.js";
import { getDeployCooldownProgress } from "./cooldownVisual.js";
import { waveSpawnCount } from "./domain.js";
import { pushEventParticles } from "./projectileRenderer.js";
import { createBattleRowBuffers } from "./visualGeometry.js";
import {
  configureHiDPICanvas, configureRenderLayers, consumeGraphicsEvents,
  createGraphicsRuntime, createRenderLayers,
} from "./graphicsRuntime.js";
import {
  CELL, FIELD, VIEWPORT,
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  accelerateWaveOutro,
  activateDematerializationPulse,
  cellFromPoint,
  clearSandboxEntities,
  createBattleSession,
  getEligibleAdaptiveAidOptions,
  getSnapshot,
  getWaveOutroCinematicFactor,
  getTroopRangePenaltyTiles,
  forceExecutorCombo,
  forceLeviathanAttack,
  debugLeviathan,
  forceColossoAttack,
  debugColosso,
  createPositionalConfirmationEvent,
  getPositionalTargetPreview,
  injureSandboxTroops,
  isCapsuleClickable,
  openAdaptiveAidCapsule,
  pointHitsCapsule,
  repositionTroop,
  selectAdaptiveAidOption,
  selectDecision,
  setEnergyPickupPointer,
  setSandboxSettings,
  spawnEnemy,
  stepBattle,
  simulateAdaptiveAid,
  WAVE_OUTRO_TIMINGS,
  DEMATERIALIZATION_PULSE,
} from "./battleModel.js";
import { positionalTargetInstruction, positionalTargetMessage } from "./positionalTargeting.js";
import { useBattleLoopControls } from "./hooks/useBattleLoop.js";
import {
  getNextBattleSpeed,
  getTroopSlotAvailability,
  resolveBattleHotkey,
  useBattleHotkeys,
} from "./battleHotkeys.js";
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
} from "./components/BattleControlIcons.jsx";
import { useBattleFullscreen } from "./hooks/useBattleFullscreen.js";
import { useBattleController } from "./hooks/useBattleController.js";
import { useBattleInteractions } from "./hooks/useBattleInteractions.js";
import { handleBattleStepEvents } from "./hooks/battleStepEvents.js";
import { advanceBattleFrameProgress } from "./hooks/battleFrameProgress.js";
import { advanceBattleSimulation, BATTLE_SIMULATION_STEP_MS } from "./hooks/battleFrameSimulation.js";
import { renderBattleFrame } from "./render/battleFrameRenderer.js";
import BattleCanvas from "./render/BattleCanvas.jsx";
import { WaveOutroCinematicOverlay } from "./waveOutro/WaveOutroCinematicOverlay.jsx";
import BattlePauseMenu from "./components/BattlePauseMenu.jsx";
import { getCinematicWaveOutroCameraTransform } from "./waveOutro/waveOutroCamera.js";
import { getConvoyAttackSummary } from "./chapter07/convoySummary.js";
import ConvoyCheckpointOverlay from "./chapter07/components/ConvoyCheckpointOverlay.jsx";
import ConvoySectorCountdown from "./chapter07/components/ConvoySectorCountdown.jsx";
import ConvoyToast from "./chapter07/components/ConvoyToast.jsx";
import { startConvoySectorCountdown } from "./chapter07/convoyFlow.js";
import { acknowledgeConvoyCheckpoint } from "./chapter07/convoyCheckpoints.js";
import { applyConvoyCheckpointOption } from "./chapter07/convoyCheckpointRewards.js";
import { getBattleFieldPoint, resolveCanvasClickAction } from "./input/battlePointerActions.js";
import { ColossusSpecialButtons } from "./components/ColossusSpecialButtons.jsx";
import { DecisionModal } from "./components/DecisionModal.jsx";
import { FortuneChoiceModal } from "./components/FortuneChoiceModal.jsx";
import { CapsuleInteractionButton } from "./components/CapsuleInteractionButton.jsx";
import { SandboxPanel } from "./components/SandboxPanel.jsx";
import { getThermalBannerText, resolveInspectedTroopId } from "./components/battleHudModel.js";
import BattleOverlays from "./components/BattleOverlays.jsx";
import { drawLeviathanBrineJet, isLeviathanShadowOnly, isRasgamarShadowOnly } from "./render/enemyEffectsRenderer.js";
import "./chapter07/chapter07.css";

export const FREE_HAND_ACTIVATED_MESSAGE = "Mão livre ativada.";

export { resolveCanvasClickAction };

export { getCinematicWaveOutroCameraTransform as getWaveOutroCameraTransform };
export { WaveOutroCinematicOverlay as WaveOutroOverlay };
export { ColossusSpecialButtons };
export { isLeviathanShadowOnly, isRasgamarShadowOnly };
export { drawLeviathanBrineJet };
export { resolveInspectedTroopId };

export { DecisionModal };

export { CapsuleInteractionButton };

export { FortuneChoiceModal };

export { SandboxPanel };

export { getThermalBannerText };

export function BattleScreen({ phase, unlockedTroops, onFinish, onExit, sandbox = false }) {
  const controller = useBattleController({ phase, unlockedTroops, sandbox });
  const {
    loadout, battleShellRef, canvasRef, assetsRef, sessionRef, particlesRef, graphicsRef, battleRowsRef, frameLoopRef,
    adaptiveSettingsRef, hoveredCellRef, finishSentRef, convoyDestructionRevealUntilRef, audioRef,
    lastCriticalBeepRef, notificationIdRef, waveOutroCueRef, convoyCountdownStepRef, troopAnimationClockRef,
    snapshot, setSnapshot, paused, setPaused, speed, setSpeed, runtimeRevision, setRuntimeRevision,
    sandboxSettingsState, setSandboxSettingsState, selectedEnemy, setSelectedEnemy, spawnRow, setSpawnRow,
    spawnCount, setSpawnCount, spawnAlpha, setSpawnAlpha, spawnGrouped, setSpawnGrouped, fortuneTier,
    setFortuneTier, selectedTroop, setSelectedTroop, repositionTroopId, setRepositionTroopId, hoveredTroop,
    setHoveredTroop, removeMode, setRemoveMode, targetingDecision, setTargetingDecision, graphicsMetrics,
    setGraphicsMetrics, notification, setNotification, banner, setBanner,
    renderPlan, getOverlayModel, settings, loading, play, stopAudio,
  } = controller;
  const consumeGraphicsEventsAtVisualTime = (events, simulationNow = sessionRef.current.elapsed) => {
    const visualNow = performance.now();
    consumeGraphicsEvents(
      graphicsRef.current,
      events,
      simulationNow,
      { ...settings, clockNow: visualNow },
    );
  };
  const { pausedRef, speedRef } = useBattleLoopControls(paused, speed);
  const {
    isFullscreen,
    fullscreenSupported,
    toggleFullscreen,
    exitFullscreen,
  } = useBattleFullscreen(battleShellRef);
  const showGraphicsMetrics = useMemo(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("gfxstats"), []);
  const setMessage = useCallback((text, options = {}) => {
    setNotification({
      id: notificationIdRef.current++,
      text,
      tone: options.tone || "info",
      persistent: Boolean(options.persistent),
    });
  }, []);
  const setActionMessage = useCallback((text) => {
    setMessage(text, { persistent: true, tone: "action" });
  }, [setMessage]);
  const {
    activateColossusSpecial,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasMove,
    handleCanvasPointerLeave,
    releaseMouseTool,
  } = useBattleInteractions({
    adaptiveSettingsRef,
    consumeGraphicsEventsAtVisualTime,
    controller,
    freeHandMessage: FREE_HAND_ACTIVATED_MESSAGE,
    hoveredCellRef,
    particlesRef,
    play,
    removeMode,
    repositionTroopId,
    selectedTroop,
    sessionRef,
    setMessage,
    setRemoveMode,
    setRepositionTroopId,
    setSelectedTroop,
    setSnapshot,
    setTargetingDecision,
    snapshot,
    targetingDecision,
  });
  const handleToggleFullscreen = useCallback(async () => {
    const entering = !isFullscreen;
    const result = await toggleFullscreen();
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage(
      entering
        ? "Modo tela cheia ativado · pressione Esc para sair."
        : "Modo tela cheia encerrado.",
    );
  }, [isFullscreen, setMessage, toggleFullscreen]);
  const handleBattleExit = useCallback(async () => {
    await exitFullscreen();
    onExit();
  }, [exitFullscreen, onExit]);
  const resetBattleRuntime = useCallback((nextSandboxSettings = sandboxSettingsState) => {
    stopAudio();
    sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox, ...(sandbox ? { sandboxSettings: nextSandboxSettings } : {}) });
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    battleRowsRef.current = createBattleRowBuffers();
    hoveredCellRef.current = null;
    finishSentRef.current = false;
    convoyDestructionRevealUntilRef.current = 0;
    waveOutroCueRef.current = null;
    convoyCountdownStepRef.current = null;
    lastCriticalBeepRef.current = 0;
    setSelectedTroop(null); setHoveredTroop(null); setRemoveMode(false); setTargetingDecision(null);
    setSpeed(1); setPaused(false); setSnapshot(getSnapshot(sessionRef.current));
    setRuntimeRevision((value) => value + 1);
  }, [loadout, phase, sandbox, sandboxSettingsState, stopAudio]);
  useEffect(() => {
    if (!loading.ready || sandbox || phase.id !== "fase_49") return;
    setMessage("MANTENHA UMA TROPA EM R2 OU R4 PRÓXIMA AO TRANSPORTE.", { tone: "action", persistent: true });
  }, [loading.ready, phase.id, sandbox, setMessage]);

  useEffect(() => {
    if (!loading.ready || sandbox || phase.id !== "fase_50") return;
    const key = "genesis.chapter07.forestObstacleTutorial";
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "shown");
    setBanner("COBERTURA FERRÍVORA");
    setMessage("Árvores bloqueiam seus disparos, mas não impedem o avanço inimigo. Destrua a cobertura ou espere os inimigos ultrapassá-la.", { tone: "info" });
  }, [loading.ready, phase.id, sandbox, setBanner, setMessage]);

  useEffect(() => {
    if (!notification?.text || notification.persistent) return undefined;
    const timeout = window.setTimeout(() => {
      setNotification((current) => current?.id === notification.id ? null : current);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    if (!loading.ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const renderScale = configureHiDPICanvas(canvas, settings, window.devicePixelRatio || 1);
    const renderLayers = createRenderLayers();
    const layerConfig = configureRenderLayers(renderLayers, settings, window.devicePixelRatio || 1);
    let previous = performance.now();
    let accumulator = 0;
    let lastUi = 0;
    let lastDrawMs = 0;
    let lastPresentMs = 0;
    let lastLayerTimings = { arenaMs: 0, effectMs: 0, entityMs: 0, emissiveMs: 0 };
    const loop = (now) => {
      const frameDelta = Math.min(100, now - previous);
      previous = now;
      const fortunePaused = adaptiveAidPausesSimulation(sessionRef.current.adaptiveAid?.status);
      const outroFactor = getWaveOutroCinematicFactor(sessionRef.current, settings.reduceMotion);
      advanceBattleFrameProgress({
        adaptiveSettingsRef, audioRef, consumeGraphicsEventsAtVisualTime,
        convoyCountdownStepRef, fortunePaused, frameDelta, lastCriticalBeepRef, now,
        particlesRef, paused: pausedRef.current, phase, play, pushEventParticles,
        sessionRef, setBanner, settings, speed: speedRef.current, waveOutroCueRef,
      });
      const stepStarted = performance.now();
      accumulator = advanceBattleSimulation({
        accumulator,
        cinematicFactor: adaptiveAidCinematicFactor(sessionRef.current),
        fortunePaused,
        frameDelta,
        outroFactor,
        paused: pausedRef.current,
        speed: speedRef.current,
        onStep: (stepMs) => {
        const events = stepBattle(sessionRef.current, stepMs);
        pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        consumeGraphicsEventsAtVisualTime(events, sessionRef.current.elapsed);
        handleBattleStepEvents(events, {
          audioRef, play, sessionRef, setBanner, setMessage, setRemoveMode,
          setRepositionTroopId, setSelectedTroop, settings,
        });
        },
        stepMs: BATTLE_SIMULATION_STEP_MS,
      });
      const stepMs = performance.now() - stepStarted;
      const interpolation = Math.min(1, accumulator / BATTLE_SIMULATION_STEP_MS);
      sessionRef.current.renderPaused = pausedRef.current;
      const renderResult = renderBattleFrame({
        adaptiveSettings: adaptiveSettingsRef.current,
        animationClock: troopAnimationClockRef.current,
        assets: assetsRef.current,
        ctx,
        frameDelta,
        hoveredCell: hoveredCellRef.current,
        interpolation,
        lastDrawMs,
        lastLayerTimings,
        lastPresentMs,
        layerConfig,
        layers: renderLayers,
        now,
        particlesRef,
        removeMode,
        renderPlan,
        renderScale,
        rowBuffers: battleRowsRef.current,
        runtime: graphicsRef.current,
        selectedTroop,
        session: sessionRef.current,
        settings,
        stepMs,
      });
      lastLayerTimings = renderResult.layerTimings;
      lastDrawMs = renderResult.drawMs;
      lastPresentMs = renderResult.presentMs;
      if (now - lastUi > 100) {
        lastUi = now;
        setSnapshot(getSnapshot(sessionRef.current));
        if (showGraphicsMetrics) setGraphicsMetrics({ ...graphicsRef.current.metrics });
      }
      if (sessionRef.current.result && !finishSentRef.current) {
        const convoyDestroyed = sessionRef.current.phase?.progressionMode === "convoy"
          && sessionRef.current.result.outcome === "defeat" && sessionRef.current.convoy?.hp <= 0;
        if (convoyDestroyed && !convoyDestructionRevealUntilRef.current) convoyDestructionRevealUntilRef.current = now + 1200;
        if (convoyDestroyed && now < convoyDestructionRevealUntilRef.current) {
          return;
        }
        finishSentRef.current = true;
        audioRef.current.theme?.pause();
        audioRef.current.windActiveLoop?.pause();
        onFinish?.(sessionRef.current.result);
      }
    };
    frameLoopRef.current = loop;
    return () => {
      if (frameLoopRef.current === loop) frameLoopRef.current = null;
    };
  }, [loading.ready, onFinish, play, removeMode, selectedTroop, settings, showGraphicsMetrics, runtimeRevision]);

  const handleStartWave = () => {
    if (targetingDecision
      || sessionRef.current.convoyFlow?.checkpointBriefingPending
      || adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    const isConvoy = sessionRef.current.phase?.progressionMode === "convoy";
    const started = isConvoy
      ? startConvoySectorCountdown(sessionRef.current)
      : controller.actions.startWave();
    if (started) {
      setSelectedTroop(null);
      setRepositionTroopId(null);
      setRemoveMode(false);
      consumeGraphicsEventsAtVisualTime([{ type: "waveStart" }], sessionRef.current.elapsed);
      const convoy = sessionRef.current.convoyFlow;
      setBanner(convoy ? `SETOR ${convoy.sectorIndex + 1}/4 · ROTA ATIVA` : `ONDA ${sessionRef.current.waveIndex + 1} · CONTATO`);
      setMessage(convoy ? "Contagem regressiva iniciada. Prepare R2/R4." : "Onda em andamento. Novas implantações entram em cooldown.");
      play("alert", 0.75);
      play("theme", 0.75);
      setSnapshot(getSnapshot(sessionRef.current));
    }
  };

  const handleCheckpointContinue = () => {
    if (!acknowledgeConvoyCheckpoint(sessionRef.current)) return;
    setSelectedTroop(null);
    setRepositionTroopId(null);
    setRemoveMode(false);
    setMessage("REPOSICIONE SUAS TROPAS", { tone: "action" });
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCheckpointReward = (optionId) => {
    const result = applyConvoyCheckpointOption(sessionRef.current, optionId, []);
    if (!result.ok) return;
    setMessage(optionId === "repair" ? "BLINDAGEM REPARADA" : "RESERVA REABASTECIDA");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDecision = (option) => {
    if (adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    if (option.positional) {
      sessionRef.current.pendingPositionalDecision = { ...option, preview: null };
      setTargetingDecision(option);
      setSelectedTroop(null);
      setRemoveMode(false);
      setActionMessage(positionalTargetInstruction(option));
      return;
    }
    if (selectDecision(sessionRef.current, option)) {
      setMessage(`${option.label}: efeito aplicado.`);
      setSnapshot(getSnapshot(sessionRef.current));
    } else {
      setMessage("Não foi possível aplicar essa decisão.");
    }
  };

  const resetSandbox = (nextSettings = sandboxSettingsState) => {
    if (!sandbox) return;
    sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox: true, sandboxSettings: nextSettings });
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    hoveredCellRef.current = null;
    setSelectedTroop(null);
    setRemoveMode(false);
    setFortuneTier("critical");
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner("LABORATÓRIO · CAMPO DE PROVAS");
    setMessage("Arena reiniciada. Selecione uma tropa ou gere hostis.");
  };

  const updateSandboxSetting = (key, value) => {
    const next = { ...sandboxSettingsState, [key]: value };
    setSandboxSettingsState(next);
    setSandboxSettings(sessionRef.current, { [key]: value });
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const changeRulesMode = (rulesMode) => {
    const next = { ...sandboxSettingsState, rulesMode };
    setSandboxSettingsState(next);
    resetSandbox(next);
  };

  const changeSandboxMechanic = (mechanicMode) => {
    const next = { ...sandboxSettingsState, mechanicMode };
    setSandboxSettingsState(next);
    resetSandbox(next);
  };

  const handleSpawnEnemy = () => {
    const result = spawnEnemy(sessionRef.current, {
      type: selectedEnemy,
      row: spawnRow,
      count: spawnCount,
      variant: spawnAlpha ? "alpha" : undefined,
      groupInTile: spawnGrouped,
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner(`${ENEMIES[selectedEnemy].label.toUpperCase()}${spawnAlpha ? " ALFA" : ""} · ROTA ${spawnRow + 1}`);
    setMessage(`${spawnCount} ${ENEMIES[selectedEnemy].label}${spawnCount > 1 ? "s" : ""} gerado${spawnCount > 1 ? "s" : ""} na rota ${spawnRow + 1}.`);
  };

  const handleForceExecutorCombo = (step) => {
    const result = forceExecutorCombo(sessionRef.current, step);
    setMessage(result.ok
      ? `Vórtice preparado para o Combo ${result.step} contra ${ENEMIES[result.target.type]?.label || "o alvo"}.`
      : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleForceLeviathan = (attack) => {
    const result = forceLeviathanAttack(sessionRef.current, attack);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Leviatã preparado: ${attack}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDebugLeviathan = (action) => {
    const result = debugLeviathan(sessionRef.current, action);
    setMessage(result.ok ? `Leviatã: ${action}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleForceColosso = (attack) => {
    const result = forceColossoAttack(sessionRef.current, attack);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Colosso preparado: ${attack}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDebugColosso = (action) => {
    const result = debugColosso(sessionRef.current, action);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Colosso: ${action}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleClear = (target) => {
    clearSandboxEntities(sessionRef.current, target);
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(target === "enemies" ? "Todos os hostis foram removidos." : "Todas as tropas foram removidas.");
  };

  const handleInjureTroops = () => {
    const events = injureSandboxTroops(sessionRef.current, 10);
    consumeGraphicsEventsAtVisualTime(events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(events.length ? "Tropas vivas perderam 10 HP para teste de cura." : "Posicione tropas antes de aplicar dano.");
  };

  const handleOpenCapsule = () => {
    const result = openAdaptiveAidCapsule(sessionRef.current);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSelectedTroop(null);
    setRemoveMode(false);
    setMessage("Cápsula em abertura. Aguarde a transmissão.");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleSimulateFortune = () => {
    const result = simulateAdaptiveAid(sessionRef.current, fortuneTier);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSelectedTroop(null);
    setRemoveMode(false);
    setBanner("OPORTUNIDADE TÁTICA");
    setMessage("Transmissão aliada interceptada. Recursos de emergência disponíveis.");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleFortuneChoice = (optionId) => {
    const result = selectAdaptiveAidOption(sessionRef.current, optionId);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    if (result.targeting) {
      setSelectedTroop(null);
      setRemoveMode(false);
      setActionMessage("Selecione uma rota para o ataque orbital.");
    } else {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
      setMessage(`${result.option.label}: recurso aplicado.`);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const fortuneEligibleCount = sandbox ? getEligibleAdaptiveAidOptions(sessionRef.current, fortuneTier).length : 0;
  const fortuneDisabled = Boolean(snapshot.adaptiveAid.triggered || fortuneEligibleCount < 2);
  const fortuneReason = snapshot.adaptiveAid.triggered
    ? "Ajuda já simulada. Use Reiniciar para testar novamente."
    : fortuneEligibleCount < 2
      ? "Prepare o campo para disponibilizar ao menos duas recompensas úteis."
      : "Executa o fluxo completo da Cápsula da Colônia.";
  const fortuneStatus = snapshot.adaptiveAid.status;
  const fortuneBlocksIntermission = adaptiveAidBlocksIntermission(fortuneStatus);
  const fortuneTargeting = fortuneStatus === "targeting";
  const waveOutroActive = Boolean(snapshot.waveOutro?.status && !["idle", "completed"].includes(snapshot.waveOutro.status));
  const positionalTargeting = fortuneTargeting || Boolean(targetingDecision) || waveOutroActive;
  const convoyBriefingPending = Boolean(snapshot.convoy?.checkpointBriefingPending);
  const convoyCountdown = snapshot.convoy?.state === "sectorCountdown";

  useBattleHotkeys((event) => {
    const action = resolveBattleHotkey(event);
    if (!action || snapshot.outcome) return;
    if (convoyBriefingPending) return;
    if (paused && action.type !== "togglePause" && action.type !== "toggleFullscreen") return;

    // Deixa o navegador consumir Esc para sair da tela cheia sem cancelar a ferramenta.
    if (action.type === "cancelTool" && isFullscreen) return;

    event.preventDefault();

    if (action.type === "togglePause") {
      if (!fortuneTargeting) setPaused((current) => !current);
      return;
    }

    if (action.type === "selectTroop") {
      const troopId = loadout[action.loadoutIndex];
      const troop = TROOPS[troopId];
      if (!troopId || !troop) return;

      const availability = getTroopSlotAvailability({
        troopId,
        troop,
        snapshot,
        sandbox,
        sandboxSettings: sandboxSettingsState,
        positionalTargeting,
      });

      if (!availability.available) {
        setMessage(availability.message);
        return;
      }

      if (selectedTroop === troopId && !removeMode) {
        setSelectedTroop(null);
        setMessage("Mão livre ativada.");
        return;
      }

      setRemoveMode(false);
      setSelectedTroop(troopId);
      setMessage(
        troop.label + " selecionado · tecla " + (action.loadoutIndex + 1) + ".",
      );
      return;
    }

    if (action.type === "cancelTool") {
      if (targetingDecision || sessionRef.current.adaptiveAid?.status === "targeting") return;
      setSelectedTroop(null);
      setRemoveMode(false);
      setMessage("Ferramenta cancelada · mão livre ativada.");
      return;
    }

    if (action.type === "toggleFullscreen") {
      if (!fullscreenSupported) {
        setMessage("Tela cheia não é suportada neste navegador.");
        return;
      }
      handleToggleFullscreen();
      return;
    }

    if (action.type === "toggleRemove") {
      if (positionalTargeting) return;
      setSelectedTroop(null);
      setRemoveMode((current) => {
        const next = !current;
        setMessage(next ? "Modo de remoção ativado · tecla R." : "Modo de remoção desativado.");
        return next;
      });
      return;
    }

    if (action.type === "startWave") {
      const hotkeyCanStartWave = !sandbox
        && snapshot.preparing
        && !snapshot.pendingDecision
        && !waveOutroActive
        && !targetingDecision
        && !snapshot.outcome
        && !fortuneBlocksIntermission;

      if (hotkeyCanStartWave) handleStartWave();
      else setMessage("A onda não pode ser iniciada agora.");
      return;
    }

    if (action.type === "adjustSpeed") {
      if (paused || fortuneTargeting) return;
      const nextSpeed = getNextBattleSpeed(speed, sandbox, action.direction);
      if (nextSpeed !== speed) {
        setSpeed(nextSpeed);
        setMessage("Velocidade alterada para " + nextSpeed + "×.");
      }
    }
  }, loading.ready);

  if (!loading.ready) {
    const loadingFailed = loading.stage === "error";

    return (
      <div
        className="battle-loader"
        style={{
          "--arena-image": `url(${getArenaUrl(phase.arenaId)})`,
          "--arena-primary": phase.palette.primary,
        }}
      >
        <div className="loader-scrim" />
        <div className="loader-content">
          <div className="loader-mark">GD</div>
          <span className="eyebrow">{phase.name}</span>
          <h2>
            {loadingFailed
              ? "Falha ao preparar campo tático"
              : "Preparando campo tático"}
          </h2>
          <div className="progress-track">
            <span
              style={{
                width: `${loading.percent}%`,
              }}
            />
          </div>
          <p>
            {loadingFailed
              ? loading.error
              : `${loading.percent}% · sincronizando arena, loadout e hostis`}
          </p>
          {loadingFailed && (
            <button
              type="button"
              className="battle-loader-exit"
              onClick={onExit}
            >
              VOLTAR À CAMPANHA
            </button>
          )}
        </div>
      </div>
    );
  }

  const tide = snapshot.tideCycle;
  const tidePressureLabel = tide?.pressureScore >= .7
    ? "PRESSÃO ALTA"
    : tide?.pressureScore >= .35
      ? "PRESSÃO MODERADA"
      : "PRESSÃO BAIXA";
  const tideBanner = tide?.state === "warningAdvance"
    ? `A MARÉ ESTÁ AVANÇANDO · NÍVEL ${tide.currentLevel}→${tide.targetLevel} · ${(tide.remainingMs / 1000).toFixed(1)}s`
    : tide?.state === "rising"
      ? `ÁGUA AVANÇANDO · ${tide.warningCells.length} CÉLULAS EM RISCO · ${(tide.remainingMs / 1000).toFixed(1)}s`
      : tide?.state === "warningRetreat"
        ? `A MARÉ ESTÁ PERDENDO FORÇA · ${(tide.remainingMs / 1000).toFixed(1)}s`
        : tide?.state === "receding"
          ? `A MARÉ ESTÁ RECUANDO · NOVAS POSIÇÕES SERÃO LIBERADAS · ${(tide.remainingMs / 1000).toFixed(1)}s`
          : tide?.state === "drying"
            ? `ZONA INTERMARÉ SECANDO · ${(tide.remainingMs / 1000).toFixed(1)}s`
            : tide?.enabled
              ? `MARÉ NÍVEL ${tide.currentLevel}/${tide.maximumLevel} · ${tidePressureLabel} · ${tide.safeCells} CÉLULAS SEGURAS`
              : null;
  const sandstormBanner = snapshot.sandstorm?.state === "warning"
    ? `TEMPESTADE DE AREIA SE APROXIMANDO · ${(snapshot.sandstorm.startsInMs / 1000).toFixed(1)}s`
    : snapshot.sandstorm?.state === "active"
      ? `TEMPESTADE DE AREIA · ALCANCE À DISTÂNCIA -1 · ${(snapshot.sandstorm.remainingMs / 1000).toFixed(1)}s`
      : snapshot.sandstorm?.state === "recovering"
        ? `TEMPESTADE DISSIPANDO · ${(snapshot.sandstorm.remainingMs / 1000).toFixed(1)}s`
        : null;
  const wind = snapshot.windCurrent;
  const windRoute = wind?.direction === "lateral" && Number.isInteger(wind.sourceRow)
    ? ` · ROTA ${wind.sourceRow + 1}${Number.isInteger(wind.targetRow) && wind.targetRow >= 0 && wind.targetRow < FIELD.rows ? ` → ROTA ${wind.targetRow + 1}` : " → FORA DO CAMPO"}`
    : wind?.selectedRows?.length
      ? ` · ROTAS ${wind.selectedRows.map((row) => row + 1).join(", ")}`
      : "";
  const windLabel = wind?.direction === "headwind"
    ? "CORRENTE CONTRÁRIA"
    : wind?.direction === "tailwind"
      ? "VENTO FAVORÁVEL"
      : "RAJADA LATERAL";
  const windBanner = wind?.state === "warning"
    ? `${windLabel} SE FORMANDO${windRoute} · ${(wind.startsInMs / 1000).toFixed(1)}s`
    : wind?.state === "active"
      ? `${windLabel}${windRoute} · ${(wind.remainingMs / 1000).toFixed(1)}s`
      : wind?.state === "recovering"
        ? `CORRENTE DISSIPANDO · ${(wind.remainingMs / 1000).toFixed(1)}s`
        : null;
  const thermalBanner = getThermalBannerText(phase, snapshot);
  const alphaPressure = snapshot.alphaPressure;
  const alphaWarning = alphaPressure?.pendingSpawns?.length
    ? `⚠ PRESENÇA ALPHA DETECTADA · ROTA ${alphaPressure.pendingSpawns[0].row + 1}`
    : alphaPressure?.enabled
      ? `PRESSÃO ALPHA · PRÓXIMA CHECAGEM ${Math.ceil((alphaPressure.nextCheckInMs || 0) / 1000)}s · TROPAS ${alphaPressure.troopCountCurrent}`
      : null;
  const canStartWave = !sandbox
    && snapshot.preparing
    && !snapshot.pendingDecision
    && !waveOutroActive
    && !targetingDecision
    && !snapshot.outcome
    && !fortuneBlocksIntermission
    && !convoyBriefingPending;
  const integrityPercent = Math.round(snapshot.integrity / Math.max(1, snapshot.integrityMax) * 100);
  const hostileCount = snapshot.enemies + snapshot.queued;
  const convoyAttackSummary = snapshot.progressionMode === "convoy"
    ? getConvoyAttackSummary(snapshot.convoy, hostileCount)
    : null;
  const threatSummary = snapshot.upcomingThreat
    ? ` · ${snapshot.upcomingThreat.isAlpha ? "AMEAÇA ALFA" : snapshot.upcomingThreat.isBoss ? "CHEFE" : "AMEAÇA"} NA ROTA ${snapshot.upcomingThreat.row + 1}`
    : "";
  const defaultContainmentSummary = sandbox
    ? `CAMPO DE PROVAS · ${snapshot.enemies} HOSTIS EM CAMPO`
    : `${snapshot.progressionMode === "convoy" ? "SETOR" : "ONDA"} ${snapshot.wave}/${snapshot.totalWaves} · ${hostileCount} HOSTIS RESTANTES${threatSummary}`;
  const containmentSummary = waveOutroActive
    ? "PERÍMETRO SEGURO · SISTEMAS EM REORGANIZAÇÃO"
    : snapshot.adaptiveAid.status === "targeting"
    ? "ATAQUE ORBITAL · PASSE O MOUSE E CLIQUE EM UMA ROTA"
    : snapshot.adaptiveAid.status === "incoming"
      ? "OPORTUNIDADE TÁTICA · CÁPSULA EM APROXIMAÇÃO"
      : snapshot.adaptiveAid.status === "landed"
        ? "OPORTUNIDADE TÁTICA · RECURSOS DE EMERGÊNCIA DISPONÍVEIS"
        : targetingDecision?.targetType === "columnBlock"
          ? "FORMAÇÃO AVANÇADA · PASSE O MOUSE E CLIQUE EM TRÊS COLUNAS"
          : targetingDecision
            ? "SELEÇÃO DE ROTA · CLIQUE PARA FORTIFICAR"
            : convoyAttackSummary || alphaWarning || tideBanner || windBanner || sandstormBanner || thermalBanner || defaultContainmentSummary;
  const inspectedTroopId = resolveInspectedTroopId({ hoveredTroop, selectedTroop });
  const inspectedTroop = inspectedTroopId ? TROOPS[inspectedTroopId] : null;
  const overlayModel = useMemo(() => getOverlayModel({ fortuneBlocksIntermission }), [getOverlayModel, fortuneBlocksIntermission]);

  return (
    <section ref={battleShellRef} className={`battle-shell environment-${phase.environment} ${phase.chapterId === "chapter_02" ? "chapter-2-battle" : ""} ${phase.chapterId === "chapter_03" ? "chapter-3-battle" : ""} ${phase.chapterId === "chapter_04" ? "chapter-4-battle" : ""} ${phase.chapterId === "chapter_06" ? "chapter-6-battle" : ""} ${phase.chapterId === "chapter_07" ? "chapter-7-battle" : ""} ${sandbox ? "sandbox-battle" : ""}`}>
      <header className="battle-topbar">
        <div className="battle-operation"><span>OPERAÇÃO</span><h1>{sandbox ? "CAMPO DE PROVAS" : phase.name}</h1></div>
          <div className="battle-stats">
          <div className={snapshot.energyPulse ? "energy-pulse" : ""}><span>Energia</span><strong className="cyan">{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.energy}/${snapshot.energyMax}`}</strong></div>
            {snapshot.progressionMode === "convoy" && <div className="convoy-reserve-stat"><span>Veículo</span><strong>🚚⚡ {snapshot.convoy?.reserve} / {snapshot.convoy?.reserveMax}</strong></div>}
            <div><span>Supply</span><strong>{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.supply}/${snapshot.supplyMax}`}</strong></div>
          <div><span>Integridade</span><strong className={integrityPercent <= 40 ? "danger" : "success"}>{integrityPercent}%</strong></div>
        </div>
        
        <div className="battle-actions">
          <button type="button" className="icon-button battle-control-button" disabled={fortuneTargeting || convoyBriefingPending} aria-label={paused ? "Continuar batalha" : "Pausar batalha"} aria-pressed={paused} aria-keyshortcuts="Space" title={paused ? "Continuar · Espaço" : "Pausar · Espaço"} onClick={() => paused ? controller.actions.resume() : controller.actions.pause()}>{paused ? <PlayIcon /> : <PauseIcon />}</button>
          <button type="button" className="speed-button" aria-label="Alterar velocidade da batalha" aria-keyshortcuts="+ -" title="Velocidade · teclas + e -" disabled={paused || fortuneTargeting || convoyBriefingPending} onClick={() => controller.actions.changeSpeed((() => {
            const speeds = sandbox ? [0.5, 1, 2, 4] : [1, 2];
            return speeds[(speeds.indexOf(speed) + 1) % speeds.length];
          })())}>{speed}×</button>
          <button
            type="button"
            className="icon-button battle-control-button fullscreen-button"
            disabled={!fullscreenSupported || convoyBriefingPending}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}
            aria-pressed={isFullscreen}
            aria-keyshortcuts="F"
            title={isFullscreen ? "Sair da tela cheia · F ou Esc" : "Tela cheia · F"}
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
          <button type="button" className="release-tool-button topbar-tool-button" disabled={positionalTargeting || convoyBriefingPending} aria-keyshortcuts="Escape" onClick={releaseMouseTool} title="Mão livre · Esc ou botão direito no campo">✥ Mão livre</button>
          <button type="button" className="ghost-button" disabled={convoyBriefingPending} onClick={handleBattleExit}>Sair</button>
        </div>
      </header>

      <div className="battle-main">
        <aside className={`troop-rail ${positionalTargeting || convoyBriefingPending || convoyCountdown ? "interaction-locked" : ""}`} aria-disabled={positionalTargeting || convoyBriefingPending || convoyCountdown} inert={positionalTargeting || convoyBriefingPending || convoyCountdown ? true : undefined}>
          <div className="rail-heading"><span>LOADOUT</span><small>{sandboxSettingsState?.rulesMode === "free" ? "∞ ⚡ · ∞ SUP" : `${snapshot.energy} ⚡ · ${snapshot.supply} SUP`}</small></div>
          <div className="troop-grid">
            {loadout.map((troopId, index) => {
            const troop = TROOPS[troopId];
            const deployment = snapshot.deploymentStats[troopId];
            const cooldown = snapshot.cooldowns[troopId] || 0;
            const coolingDown = cooldown > 0;
            const deploymentLimitReached = deployment.limitReached && troopId !== "droneSentinela";
            const cooldownEnding = coolingDown && cooldown <= 800;
            const lacksEnergy = snapshot.energy < deployment.price;
            const lacksSupply = snapshot.supply < troop.supply;
            const freeMode = sandbox && sandboxSettingsState.rulesMode === "free";
            const disabled = positionalTargeting || convoyBriefingPending || convoyCountdown || (!freeMode && (lacksEnergy || lacksSupply || coolingDown || deploymentLimitReached));
            const cooldownProgress = getDeployCooldownProgress(cooldown, deployment.deployCooldownMs);
            const cooldownSeconds = (cooldown / 1000).toFixed(1);
            const unavailableReason = freeMode ? "" : lacksEnergy ? "energia insuficiente" : lacksSupply ? "supply insuficiente" : "";
            const slotLabel = coolingDown
              ? `${troop.label}, recarregando, ${cooldownSeconds} segundos restantes`
              : unavailableReason ? `${troop.label}, ${unavailableReason}` : `${troop.label}, disponível para implantação`;
            const previewUrl = getTroopPreviewUrl(troopId);
            return <button key={troopId} className={`troop-slot ${selectedTroop === troopId && !removeMode ? "selected" : ""} ${coolingDown ? "cooling-down" : ""} ${cooldownEnding ? "cooldown-ending" : ""} ${unavailableReason ? "resource-locked" : ""}`} style={{ "--troop-color": troop.color }} disabled={disabled} aria-label={slotLabel} aria-keyshortcuts={String(index + 1)} aria-describedby={inspectedTroopId === troopId ? `troop-help-${troopId}` : undefined} onMouseEnter={() => setHoveredTroop(troopId)} onMouseLeave={() => setHoveredTroop(null)} onClick={() => { setRepositionTroopId(null); setRemoveMode(false); setSelectedTroop(troopId); }}>
              <span className="troop-hotkey" aria-hidden="true">{index + 1}</span>
              <span className="troop-portrait" style={{ "--cooldown-progress": `${cooldownProgress * 360}deg` }}>
                {previewUrl && <img src={previewUrl} alt="" aria-hidden="true" />}
                {coolingDown && <span className="cooldown-sweep" aria-hidden="true" />}
              </span>
              <span className="troop-details"><b>{troop.label}</b><small>{troop.role}</small></span>
              <span className="slot-cost">{freeMode ? "∞" : `⚡${deployment.price}`}<small>{freeMode ? "LIVRE" : deploymentLimitReached ? `${deployment.activeCount}/${deployment.maxDeployed}` : coolingDown ? `${cooldownSeconds}s` : `S${troop.supply}`}</small></span>
            </button>;
            })}
          </div>
          <button type="button" disabled={positionalTargeting || convoyBriefingPending || convoyCountdown} aria-keyshortcuts="R" className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}% <kbd>R</kbd></button>
          <div className="battle-hotkey-help" aria-label="Atalhos da batalha">
            <span><kbd>1–9</kbd> Tropas</span><span><kbd>Espaço</kbd> Pausa</span><span><kbd>F</kbd> Tela cheia</span><span><kbd>R</kbd> Remover</span><span><kbd>Esc</kbd> Cancelar</span><span><kbd>Enter</kbd> Onda</span>
          </div>
          {inspectedTroop && <div id={`troop-help-${inspectedTroopId}`} className="troop-tooltip" role="tooltip" style={{ "--troop-color": inspectedTroop.color }}>
            <b>{inspectedTroop.label}</b>
            <span>{inspectedTroop.role}</span>
            <p>{inspectedTroop.description}</p>
          </div>}
        </aside>

        <div className="canvas-wrap">
          <div className="battle-canvas-stage">
            <div className={`containment-summary ${convoyAttackSummary ? "convoy-danger" : windBanner ? "wind-current-banner" : sandstormBanner ? "sandstorm-banner" : ""}`}>
              {canStartWave
                ? <button type="button" className="start-wave containment-start-wave" aria-keyshortcuts="Enter" title={snapshot.progressionMode === "convoy" ? `Iniciar setor ${snapshot.convoy?.nextSector || 1} · Enter` : "Iniciar onda · Enter"} onClick={handleStartWave}>{snapshot.progressionMode === "convoy" ? `INICIAR SETOR ${snapshot.convoy?.nextSector || 1}` : `INICIAR ONDA ${snapshot.wave}`}<span>{snapshot.progressionMode === "convoy" ? "4 setores · 3 checkpoints" : `${waveSpawnCount(phase, snapshot.wave - 1, snapshot.nextWaveEnemyCountFactor)} assinaturas`}</span></button>
                : <span>{containmentSummary}</span>}
            </div>
            <BattleCanvas canvasRef={canvasRef} ready={loading.ready} onFrame={(now) => frameLoopRef.current?.(now)} onClick={handleCanvasClick} onContextMenu={handleCanvasContextMenu} onPointerMove={handleCanvasMove} onPointerLeave={handleCanvasPointerLeave} label={snapshot.progressionMode === "convoy" ? "Campo de escolta com quatro rotas de combate e uma rota central de transporte" : "Campo de batalha em cinco rotas"} />
            {snapshot.adaptiveAid.status === "landed" && <CapsuleInteractionButton capsule={snapshot.adaptiveAid.capsule} onOpen={handleOpenCapsule} />}
            <BattleOverlays
              phase={phase}
              settings={settings}
              model={overlayModel}
              actions={{
                onCheckpointReward: handleCheckpointReward,
                onCheckpointContinue: handleCheckpointContinue,
                onActivateDematerializationPulse: handleActivateDematerializationPulse,
                onActivateColossusSpecial: activateColossusSpecial,
              }}
            />
          </div>
          {graphicsMetrics && <div className="graphics-metrics">
            <b>{graphicsMetrics.fps.toFixed(0)} FPS · {graphicsMetrics.adaptiveLevel}</b>
            <span>F {graphicsMetrics.frameMs.toFixed(1)} ms</span>
            <span>S {graphicsMetrics.stepMs.toFixed(1)} ms</span>
            <span>D {graphicsMetrics.drawMs.toFixed(1)} ms</span>
            <span>P {graphicsMetrics.presentMs.toFixed(1)} ms</span>
            <span>A {graphicsMetrics.arenaMs.toFixed(1)} ms</span>
            <span>FX {graphicsMetrics.effectMs.toFixed(1)} ms</span>
            <span>Ent {graphicsMetrics.entityMs.toFixed(1)} ms</span>
            <span>Em {graphicsMetrics.emissiveMs.toFixed(1)} ms</span>
            <span>E {graphicsMetrics.activeEntities}</span>
            <span>Part {graphicsMetrics.particles}</span>
            <span>Dec {graphicsMetrics.decals}</span>
            <span>V {graphicsMetrics.visualEntities}</span>
          </div>}
        </div>

        {sandbox && <SandboxPanel
          selectedEnemy={selectedEnemy}
          onSelectEnemy={setSelectedEnemy}
          row={spawnRow}
          onRow={setSpawnRow}
          count={spawnCount}
          onCount={setSpawnCount}
          alpha={spawnAlpha}
          onAlpha={setSpawnAlpha}
          grouped={spawnGrouped}
          onGrouped={setSpawnGrouped}
          settings={sandboxSettingsState}
          onSetting={updateSandboxSetting}
          onRulesMode={changeRulesMode}
          mechanicOptions={Object.entries(phase.sandboxMechanics || {}).map(([id, profile]) => ({ id, label: profile.label }))}
          onMechanic={changeSandboxMechanic}
          onSpawn={handleSpawnEnemy}
          onForceCombo={handleForceExecutorCombo}
          onForceLeviathan={handleForceLeviathan}
          onDebugLeviathan={handleDebugLeviathan}
          onForceColosso={handleForceColosso}
          onDebugColosso={handleDebugColosso}
          onInjure={handleInjureTroops}
          onClear={handleClear}
          onReset={() => resetSandbox()}
          fortuneTier={fortuneTier}
          onFortuneTier={setFortuneTier}
          onSimulateFortune={handleSimulateFortune}
          fortuneDisabled={fortuneDisabled}
          fortuneReason={fortuneReason}
          disabled={fortuneTargeting}
          magmaEnabled={phase.chapterId === "chapter_06" && Boolean(sessionRef.current.phase.magmaTerrain)}
        />}
      </div>

      {paused && <BattlePauseMenu phase={phase} snapshot={snapshot} loadout={loadout} reduceMotion={settings.reduceMotion} onContinue={() => setPaused(false)} onRestart={async () => { await new Promise((resolve) => window.setTimeout(resolve, 280)); resetBattleRuntime(); }} onExit={handleBattleExit} />}

      {snapshot.adaptiveAid.status === "choosing"
        ? <FortuneChoiceModal tier={snapshot.adaptiveAid.triggerTier} options={snapshot.adaptiveAid.availableOptions} onChoose={handleFortuneChoice} />
        : snapshot.pendingDecision && !targetingDecision && !fortuneBlocksIntermission && !waveOutroActive
          ? <DecisionModal level={snapshot.pendingDecisionLevel} options={snapshot.pendingDecision} onChoose={handleDecision} />
          : null}
    </section>
  );
}

export default BattleScreen;
