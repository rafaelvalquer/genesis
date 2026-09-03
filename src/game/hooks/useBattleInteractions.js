import { useEffect } from "react";
import { TROOPS } from "../content.js";
import {
  CELL,
  accelerateWaveOutro,
  cellFromPoint,
  createPositionalConfirmationEvent,
  getPositionalTargetPreview,
  getSnapshot,
  isCapsuleClickable,
  openAdaptiveAidCapsule,
  pointHitsCapsule,
  repositionTroop,
  selectAdaptiveAidOption,
  selectDecision,
  setEnergyPickupPointer,
} from "../battleModel.js";
import { positionalTargetMessage } from "../positionalTargeting.js";
import { pushEventParticles } from "../projectileRenderer.js";
import { getBattleFieldPoint, resolveCanvasClickAction } from "../input/battlePointerActions.js";

/**
 * Pointer/targeting boundary for the battle screen. It preserves the existing
 * gameplay calls while keeping DOM interaction rules out of BattleScreen.
 */
export function useBattleInteractions({
  adaptiveSettingsRef,
  consumeGraphicsEventsAtVisualTime,
  controller,
  freeHandMessage = "Mão livre ativada.",
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
}) {
  useEffect(() => {
    if (!targetingDecision && snapshot.adaptiveAid.status !== "targeting") return undefined;
    const cancel = (event) => {
      if (event.key !== "Escape") return;
      setTargetingDecision(null);
      sessionRef.current.pendingPositionalDecision = null;
      if (sessionRef.current.adaptiveAid?.status === "targeting") {
        sessionRef.current.adaptiveAid.status = "choosing";
        sessionRef.current.adaptiveAid.pendingTarget = null;
      }
      setSnapshot(getSnapshot(sessionRef.current));
      setMessage("Seleção de alvo cancelada.");
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [sessionRef, setMessage, setSnapshot, setTargetingDecision, snapshot.adaptiveAid.status, targetingDecision]);

  const canvasPointFromPointer = (event) => getBattleFieldPoint(event);

  const handleCanvasMove = (event) => {
    const point = canvasPointFromPointer(event);
    hoveredCellRef.current = point ? cellFromPoint(point.x, point.y) : null;
    const pending = sessionRef.current.pendingPositionalDecision;
    if (pending) {
      const preview = getPositionalTargetPreview(sessionRef.current, pending, hoveredCellRef.current);
      if (preview && point) {
        preview.pointerX = point.x;
        preview.pointerY = point.y;
      }
      pending.preview = preview;
      event.currentTarget.style.cursor = preview ? (preview.valid ? "pointer" : "not-allowed") : "default";
    }
    setEnergyPickupPointer(sessionRef.current, point);
  };

  const releaseMouseTool = () => {
    if (sessionRef.current.adaptiveAid?.status === "targeting") return;
    setSelectedTroop(null);
    setRemoveMode(false);
    setMessage(freeHandMessage);
  };

  const handleCanvasContextMenu = () => {
    if (targetingDecision || sessionRef.current.adaptiveAid?.status === "targeting") {
      setTargetingDecision(null);
      sessionRef.current.pendingPositionalDecision = null;
      if (sessionRef.current.adaptiveAid?.status === "targeting") {
        sessionRef.current.adaptiveAid.status = "choosing";
        sessionRef.current.adaptiveAid.pendingTarget = null;
      }
      setSnapshot(getSnapshot(sessionRef.current));
      setMessage("Seleção de alvo cancelada.");
      return;
    }
    releaseMouseTool();
  };

  const activateColossusSpecial = (troopId) => {
    const result = controller.actions.activateSpecial(troopId);
    setMessage(result.ok
      ? result.queued ? "Esmagamento Total enfileirado após o golpe atual." : "Esmagamento Total ativado."
      : result.reason);
    if (result.ok) {
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCanvasClick = (event) => {
    if (snapshot.outcome) return;
    if (sessionRef.current.waveOutro?.status && !["idle", "completed"].includes(sessionRef.current.waveOutro.status)) {
      if (accelerateWaveOutro(sessionRef.current)) setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    const fieldPoint = canvasPointFromPointer(event);
    if (sessionRef.current.convoyFlow?.state === "checkpointPreparation"
      && sessionRef.current.convoyFlow.checkpointBriefingPending) return;
    if (["sectorCountdown", "convoyEntry"].includes(sessionRef.current.convoyFlow?.state)) {
      setMessage("O setor está iniciando. Aguarde a contagem regressiva.");
      return;
    }
    if (sessionRef.current.convoyFlow?.state === "checkpointPreparation" && fieldPoint && !removeMode) {
      const cell = cellFromPoint(fieldPoint.x, fieldPoint.y);
      const troopAtCell = sessionRef.current.troops.find((troop) => !troop.dead && troop.row === cell?.row && troop.col === cell?.col);
      if (repositionTroopId) {
        const result = repositionTroop(sessionRef.current, repositionTroopId, cell.row, cell.col);
        setMessage(result.ok ? "Patrulha reposicionada sem custo; estado operacional preservado." : result.reason);
        if (result.ok) {
          consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
          setRepositionTroopId(null);
          setSelectedTroop(null);
          setSnapshot(getSnapshot(sessionRef.current));
        }
        return;
      }
      if (!selectedTroop && troopAtCell) {
        setRepositionTroopId(troopAtCell.id);
        setSelectedTroop(troopAtCell.type);
        setMessage("Origem selecionada. Escolha uma célula válida em R1, R2, R4 ou R5.");
        return;
      }
    }
    if (sessionRef.current.adaptiveAid?.status === "targeting") {
      const row = fieldPoint ? Math.floor(fieldPoint.y / CELL.height) : -1;
      const result = selectAdaptiveAidOption(sessionRef.current, sessionRef.current.adaptiveAid.pendingTarget, { row });
      if (result.ok) {
        const confirmation = result.events.find((entry) => entry.type === "fortuneOrbitalStrike");
        if (confirmation) {
          sessionRef.current.positionalConfirmationEffect = {
            ...confirmation,
            startedAt: sessionRef.current.elapsed,
            until: sessionRef.current.elapsed + 1400,
          };
        }
        consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setMessage(positionalTargetMessage({ id: "emergency_orbital" }, { row }));
      } else setMessage(result.reason);
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (isCapsuleClickable(sessionRef.current)
      && pointHitsCapsule(sessionRef.current.adaptiveAid.capsule, fieldPoint)) {
      const result = openAdaptiveAidCapsule(sessionRef.current);
      if (result.ok) {
        consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setSelectedTroop(null);
        setRemoveMode(false);
        setMessage("Cápsula em abertura. Aguarde a transmissão.");
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (targetingDecision) {
      const preview = sessionRef.current.pendingPositionalDecision?.preview
        || getPositionalTargetPreview(sessionRef.current, targetingDecision, fieldPoint ? cellFromPoint(fieldPoint.x, fieldPoint.y) : null);
      const target = preview?.type === "columnBlock"
        ? { centerCol: preview.centerCol, columns: preview.columns }
        : { row: preview?.row };
      if (!preview?.valid) {
        setMessage(preview?.reason || "Alvo inválido.");
        return;
      }
      const eventData = createPositionalConfirmationEvent(sessionRef.current, targetingDecision, target);
      if (eventData && selectDecision(sessionRef.current, targetingDecision, target)) {
        sessionRef.current.pendingPositionalDecision = null;
        sessionRef.current.positionalConfirmationEffect = {
          ...eventData,
          startedAt: sessionRef.current.elapsed,
          until: sessionRef.current.elapsed + 1400,
        };
        consumeGraphicsEventsAtVisualTime([eventData], sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, [eventData], sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setTargetingDecision(null);
        setMessage(positionalTargetMessage(targetingDecision, target));
        setSnapshot(getSnapshot(sessionRef.current));
      }
      return;
    }

    const action = resolveCanvasClickAction(sessionRef.current, fieldPoint, selectedTroop, removeMode);
    if (!action) return;
    if (action.type === "remove") {
      const result = controller.actions.removeTroop(action.cell.row, action.cell.col);
      setMessage(result.ok ? `Unidade removida · +${result.refund} energia.` : result.reason);
      if (result.ok) {
        consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (action.type === "special") {
      activateColossusSpecial(action.troop.id);
      return;
    }
    if (action.type === "inspectDrone") {
      const count = Number(action.troop.droneCount || 1);
      const damage = TROOPS.droneSentinela.damage;
      setMessage(
        `Drone Sentinela · Formação: ${count}/3 · Vida: ${Math.ceil(action.troop.hp)}/${Math.ceil(action.troop.maxHp)} · Disparos: ${count} · Dano por disparo: ${damage} · Dano por rajada: ${count * damage}`,
      );
      return;
    }
    const result = controller.actions.placeTroop(action.troopType, action.cell.row, action.cell.col);
    setMessage(result.ok
      ? result.upgraded
        ? `Drone adicionado · Formação ${result.troop.droneCount}/3.`
        : result.renewed
          ? "Plataforma Térmica renovada — calor zerado."
          : `${TROOPS[action.troopType].label} implantado.`
      : result.reason);
    if (result.ok) {
      play("deploy", 0.55);
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCanvasPointerLeave = (event) => {
    hoveredCellRef.current = null;
    if (sessionRef.current.pendingPositionalDecision) sessionRef.current.pendingPositionalDecision.preview = null;
    setEnergyPickupPointer(sessionRef.current, null);
    event.currentTarget.style.cursor = "default";
  };

  return {
    activateColossusSpecial,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasMove,
    handleCanvasPointerLeave,
    releaseMouseTool,
  };
}

export default useBattleInteractions;
