import {
  ENEMIES,
} from "../../content.js";
import {
  createBattleObservation,
} from "../observation/createBattleObservation.js";
import {
  planDecision,
} from "../planners/DecisionPlanner.js";
import {
  planSpecialActions,
} from "../planners/AbilityPlanner.js";
import { planDematerializationPulseActions } from "../planners/DematerializationPulsePlanner.js";
import {
  planPlacementActions,
} from "../planners/PlacementPlanner.js";
import {
  calculateWaveReadiness,
} from "../planners/WaveStartPlanner.js";
import {
  planReplacementActions,
} from "../planners/ReplacementPlanner.js";
import {
  rankAdaptiveAidOptions,
} from "../planners/AdaptiveAidPlanner.js";
import {
  AgentMemory,
} from "./AgentMemory.js";
import { getConvoyColumn } from "../../chapter07/convoyGeometry.js";
import { canPlaceTroop, FIELD, getEffectiveTroopStats } from "../../battleModel.js";
import { getEscortTroops } from "../../chapter07/convoyEscort.js";
import { isSystemEnabledForPhase } from "../../phaseRules.js";

function waveOutroActive(
  observation,
) {
  return ![
    "idle",
    "completed",
  ].includes(
    observation.state.waveOutroStatus,
  );
}

export class StrategicAgent {
  constructor({
    phase,
    phaseForecast,
    profile,
    config,
  }) {
    this.phase = phase;
    this.phaseForecast = phaseForecast;
    this.profile = profile;
    this.config = config;
    this.memory = new AgentMemory();
    this.enemyConfigs = ENEMIES;
    this.convoyBaseScreenEstablished = false;
    this.convoyStrikeScreenEstablished = false;
    this.convoySupportScreenEstablished = false;
  }

  createContext() {
    return {
      phaseForecast:
        this.phaseForecast,
      enemyConfigs:
        this.enemyConfigs,
    };
  }

  observe(session) {
    this.memory.update(session);

    return createBattleObservation(
      session,
      this.createContext(),
    );
  }

  planAdaptiveAid(
    observation,
  ) {
    if (!this.config.allowAdaptiveAid) {
      return [];
    }

    const status = (
      observation.adaptiveAid.status
    );

    if (
      status === "landed"
      || status === "available"
      || status === "capsule"
    ) {
      return [{
        type: "openAdaptiveAid",
        priority: 200,
        reason: "adaptiveAidAvailable",
      }];
    }

    if (
      status === "choosing"
      || status === "targeting"
    ) {
      const ranked = (
        rankAdaptiveAidOptions(
          observation,
        )
      );

      return ranked.length
        ? [{
          type: "selectAdaptiveAid",
          optionId:
            ranked[0].option.id,
          priority: 195,
          reason: "adaptiveAidChoice",
        }]
        : [];
    }

    return [];
  }

  planPendingDecision(
    session,
    observation,
  ) {
    if (
      !observation.state.pendingDecision
    ) {
      return [];
    }

    const planned = planDecision(
      session,
      observation,
      this.profile,
    );

    return planned
      ? [{
        type: "selectDecision",
        option: planned.option,
        target: planned.target,
        priority: 180,
        reason: "tacticalDecision",
        score: planned.score,
      }]
      : [];
  }

  planWaveStart(
    observation,
  ) {
    if (
      observation.state.waveActive
      || observation.state.pendingDecision
      || waveOutroActive(observation)
      || observation.state.outcome
    ) {
      return [];
    }

    const preparationElapsed = (
      this.memory
        .getPreparationElapsed({
          elapsed:
            observation.phase.elapsedMs,
        })
    );

    const readiness = (
      calculateWaveReadiness(
        observation,
        this.profile,
        preparationElapsed,
      )
    );

    const forcedByTimeout = (
      preparationElapsed
      >= (
        observation.phase.waveIndex === 0
          ? this.config.preparationLimitMs
          : this.config.intermissionLimitMs
      )
    );

    if (
      readiness.shouldStart
      || forcedByTimeout
    ) {
      return [{
        type: "startWave",
        priority: forcedByTimeout
          ? 170
          : 85 + readiness.readiness * 40,
        reason: forcedByTimeout
          ? "preparationTimeout"
          : "readiness",
        readiness,
      }];
    }

    return [];
  }

  planConvoyReposition(session) {
    if (session.convoyFlow?.state !== "checkpointPreparation") return [];
    const column = getConvoyColumn(session.convoy);
    const troops = session.troops.filter((troop) => !troop.dead && troop.hp > 0);
    const targetColumns = [column, column + 1, column - 1, column + 2, column - 2]
      .filter((col) => col >= FIELD.firstTroopCol && col <= FIELD.lastTroopCol);
    const occupied = new Set(troops.map((troop) => `${troop.row}:${troop.col}`));
    const used = new Set();
    const actions = [];

    if (session.phase.boss && session.convoyFlow.reachedCheckpointCount >= 3
      && !troops.some((troop) => troop.type === "sniper")) {
      const stats = getEffectiveTroopStats(session, "sniper");
      const laneHunter = troops.find((troop) => troop.type === "cacadorLeviatas");
      const row = laneHunter?.row === 1 ? 3 : 1;
      const col = FIELD.firstTroopCol + 3;
      if (stats && session.energy >= stats.price && session.supply >= stats.supply
        && !canPlaceTroop(session, "sniper", row, col)) {
        return [{ type: "place", troopId: "sniper", row, col, priority: 195,
          reason: "convoyFinalLaneConversion", price: stats.price, supply: stats.supply }];
      }
      const medic = troops.find((troop) => troop.type === "medicaNanites");
      if (medic) return [{ type: "remove", row: medic.row, col: medic.col,
        priority: 195, reason: "convoyFinalLaneConversion" }];
      return [];
    }

    const schedule = (troop, row, col) => {
      if (!troop || troop.row === row && troop.col === col || occupied.has(`${row}:${col}`)) return false;
      occupied.delete(`${troop.row}:${troop.col}`);
      occupied.add(`${row}:${col}`);
      used.add(troop.id);
      actions.push({ type: "reposition", troopId: troop.id, row, col, priority: 190, reason: "convoyCheckpointEscort" });
      return true;
    };

    if (session.phase.boss && session.convoyFlow.reachedCheckpointCount >= 3) {
      const bossHunter = troops.find((troop) => troop.type === "cacadorLeviatas");
      const firingColumns = [FIELD.firstTroopCol + 3, FIELD.firstTroopCol + 2, FIELD.firstTroopCol + 4];
      const bossColumn = firingColumns
        .find((col) => col === bossHunter?.col || !occupied.has(`0:${col}`));
      if (bossHunter && bossHunter.row === 0 && bossHunter.col === bossColumn) {
        used.add(bossHunter.id);
      } else {
        if (bossHunter && bossColumn != null) schedule(bossHunter, 0, bossColumn);
      }
      const laneHunter = troops.find((troop) => troop.type === "cacadorLeviatas" && troop.id !== bossHunter?.id);
      if (laneHunter) {
        const row = [1, 3].includes(laneHunter.row) ? laneHunter.row : 3;
        const firingColumn = firingColumns
          .find((col) => col === laneHunter.col || !occupied.has(`${row}:${col}`));
        if (laneHunter.row === row && laneHunter.col === firingColumn) used.add(laneHunter.id);
        else if (firingColumn != null) schedule(laneHunter, row, firingColumn);
      }
      const laneSniper = troops.find((troop) => troop.type === "sniper");
      if (laneSniper) {
        const row = laneHunter?.row === 1 ? 3 : 1;
        const firingColumn = firingColumns
          .find((col) => col === laneSniper.col || !occupied.has(`${row}:${col}`));
        if (laneSniper.row === row && laneSniper.col === firingColumn) used.add(laneSniper.id);
        else if (firingColumn != null) schedule(laneSniper, row, firingColumn);
      }
    }

    for (const row of [1, 3]) {
      const col = session.convoyFlow.reachedCheckpointCount >= 3
        ? Math.min(FIELD.lastTroopCol, column + 1)
        : column;
      const occupant = troops.find((troop) => troop.row === row && troop.col === col);
      if (occupant) {
        used.add(occupant.id);
        continue;
      }
      const troop = troops
        .filter((entry) => !used.has(entry.id))
        .sort((left, right) => Number(right.row === row) - Number(left.row === row)
          || right.hp - left.hp || Math.abs(left.col - col) - Math.abs(right.col - col))[0];
      schedule(troop, row, col);
    }

    for (const troop of troops) {
      if (used.has(troop.id) || [0, 4].includes(troop.row) || targetColumns.includes(troop.col)) continue;
      const destination = targetColumns.find((col) => !occupied.has(`${troop.row}:${col}`));
      if (destination != null) schedule(troop, troop.row, destination);
    }
    if (!actions.length && getEscortTroops(session).length) {
      return [{ type: "startWave", priority: 190, reason: "convoyCheckpointReady" }];
    }
    return actions;
  }

  planConvoyEscort(session) {
    if (!["sectorActive", "checkpointPreparation"].includes(session.convoyFlow?.state)
      || getEscortTroops(session).length) return [];
    if (session.enemies.some((enemy) => !enemy.dead && enemy.hp > 0)) return [];
    const convoyColumn = getConvoyColumn(session.convoy);
    const columns = [convoyColumn, convoyColumn + 1, convoyColumn - 1]
      .filter((col) => col >= FIELD.firstTroopCol && col <= FIELD.lastTroopCol);
    for (const troopId of ["medicaNanites", "colono", "droneSentinela"]) {
      if (!session.loadout.includes(troopId)) continue;
      const stats = getEffectiveTroopStats(session, troopId);
      if (!stats || session.energy < stats.price || session.supply < stats.supply) continue;
      for (const row of [1, 3]) for (const col of columns) {
        if (canPlaceTroop(session, troopId, row, col)) continue;
        return [{ type: "place", troopId, row, col, priority: 205, reason: "convoyEscort", price: stats.price, supply: stats.supply }];
      }
    }
    return [];
  }

  planConvoyOpening(session) {
    if (session.convoyFlow?.state !== "initialPreparation") return [];
    const column = getConvoyColumn(session.convoy);
    const blueprint = session.phase.boss ? [
      ["colono", 1, column + 1], ["droneSentinela", 3, column + 1],
      ["cacadorLeviatas", 1, column], ["cacadorLeviatas", 3, column],
    ] : [
      ["colono", 0, FIELD.lastTroopCol], ["colono", 1, column],
      ["colono", 3, column], ["colono", 4, FIELD.lastTroopCol],
      ["sniper", 1, column + 1], ["sniper", 3, column + 1],
    ];
    for (const [troopId, row, col] of blueprint) {
      if (session.troops.some((troop) => !troop.dead && troop.row === row && troop.col === col)) continue;
      if (!session.loadout.includes(troopId)) continue;
      const stats = getEffectiveTroopStats(session, troopId);
      if (!stats || session.energy < stats.price || session.supply < stats.supply) continue;
      if (canPlaceTroop(session, troopId, row, col)) continue;
      return [{ type: "place", troopId, row, col, priority: 205, reason: "convoyOpening", price: stats.price, supply: stats.supply }];
    }
    return [{ type: "startWave", priority: 200, reason: "convoyOpeningReady" }];
  }

  planConvoyBaseDefense(session) {
    if (session.convoyFlow?.state !== "sectorActive" || !this.convoyStrikeScreenEstablished) return [];
    const artilleryStats = getEffectiveTroopStats(session, "artilheiraMorteiro");
    const outerRows = [0, 4].sort((left, right) =>
      session.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0 && enemy.row === right).length
      - session.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0 && enemy.row === left).length);
    for (const row of outerRows) {
      if (session.troops.some((troop) => !troop.dead && troop.type === "artilheiraMorteiro" && troop.row === row)) continue;
      if (!artilleryStats || session.energy < artilleryStats.price || session.supply < artilleryStats.supply) return [];
      for (const col of [FIELD.firstTroopCol + 2, FIELD.firstTroopCol + 1]) {
        if (!canPlaceTroop(session, "artilheiraMorteiro", row, col)) {
          return [{ type: "place", troopId: "artilheiraMorteiro", row, col, priority: 200,
            reason: "convoyBaseDefense", price: artilleryStats.price, supply: artilleryStats.supply }];
        }
      }
    }
    return [];
  }

  hasConvoyBaseScreen(session) {
    if (session.phase.progressionMode !== "convoy" || session.convoyFlow?.state !== "sectorActive") return true;
    const complete = [0, 4].every((row) =>
      session.troops.some((troop) => !troop.dead && troop.type === "artilheiraMorteiro" && troop.row === row));
    if (complete) this.convoyBaseScreenEstablished = true;
    return this.convoyBaseScreenEstablished;
  }

  planConvoyStrikeScreen(session) {
    if (session.convoyFlow?.state !== "sectorActive") return [];
    const stats = getEffectiveTroopStats(session, "cacadorLeviatas");
    const desiredPerRow = 1;
    const rows = [1, 3].sort((left, right) =>
      session.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0 && enemy.row === right).length
      - session.enemies.filter((enemy) => !enemy.dead && enemy.hp > 0 && enemy.row === left).length);
    for (const row of rows) {
      if (session.troops.filter((troop) => !troop.dead && troop.type === "cacadorLeviatas" && troop.row === row).length >= desiredPerRow) continue;
      if (!stats || session.energy < stats.price || session.supply < stats.supply) return [];
      const convoyColumn = getConvoyColumn(session.convoy);
      const columns = session.phase.boss && session.convoyFlow.sectorIndex === 3
        ? [FIELD.firstTroopCol + 3, FIELD.firstTroopCol + 2, FIELD.firstTroopCol + 4]
        : [convoyColumn - 2, convoyColumn - 1, convoyColumn - 3, convoyColumn, convoyColumn + 1];
      for (const col of columns) {
        if (col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) continue;
        if (!canPlaceTroop(session, "cacadorLeviatas", row, col)) {
          return [{ type: "place", troopId: "cacadorLeviatas", row, col, priority: 202,
            reason: "convoyStrikeScreen", price: stats.price, supply: stats.supply }];
        }
      }
    }
    return [];
  }

  hasConvoyStrikeScreen(session) {
    if (session.phase.progressionMode !== "convoy" || session.convoyFlow?.state !== "sectorActive") return true;
    const desiredPerRow = 1;
    const complete = [1, 3].every((row) => session.troops.filter((troop) =>
      !troop.dead && troop.type === "cacadorLeviatas" && troop.row === row).length >= desiredPerRow);
    if (complete) this.convoyStrikeScreenEstablished = true;
    return this.convoyStrikeScreenEstablished;
  }

  planConvoySupportScreen(session) {
    if (session.phase.chapterIndex < 5 || !this.convoyStrikeScreenEstablished
      || !this.convoyBaseScreenEstablished
      || session.convoyFlow?.state !== "sectorActive") return [];
    if (session.phase.boss && session.convoyFlow.sectorIndex === 3) {
      if (session.troops.some((troop) => !troop.dead && troop.hp > 0
        && troop.type === "sniper" && [1, 3].includes(troop.row))) return [];
      const stats = getEffectiveTroopStats(session, "sniper");
      if (!stats || session.energy < stats.price || session.supply < stats.supply) return [];
      const row = [1, 3].find((candidate) => !session.troops.some((troop) => !troop.dead && troop.hp > 0
        && troop.type === "cacadorLeviatas" && troop.row === candidate)) || 1;
      const convoyColumn = getConvoyColumn(session.convoy);
      const columns = session.convoyFlow.sectorIndex === 3
        ? [FIELD.firstTroopCol + 3, FIELD.firstTroopCol + 2, FIELD.firstTroopCol + 4]
        : [convoyColumn - 2, convoyColumn - 1, convoyColumn, convoyColumn + 1];
      for (const col of columns) {
        if (col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) continue;
        if (!canPlaceTroop(session, "sniper", row, col)) {
          return [{ type: "place", troopId: "sniper", row, col, priority: 199,
            reason: "convoySupportScreen", price: stats.price, supply: stats.supply }];
        }
      }
      return [];
    }
    const stats = getEffectiveTroopStats(session, "medicaNanites");
    for (const row of [1, 3]) {
      if (session.troops.some((troop) => !troop.dead && troop.type === "medicaNanites" && troop.row === row)) continue;
      if (!stats || session.energy < stats.price || session.supply < stats.supply) return [];
      const convoyColumn = getConvoyColumn(session.convoy);
      for (const col of [convoyColumn, convoyColumn + 1, convoyColumn - 1, convoyColumn + 2]) {
        if (col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) continue;
        if (!canPlaceTroop(session, "medicaNanites", row, col)) {
          return [{ type: "place", troopId: "medicaNanites", row, col, priority: 199,
            reason: "convoySupportScreen", price: stats.price, supply: stats.supply }];
        }
      }
    }
    return [];
  }

  hasConvoySupportScreen(session) {
    if (session.phase.chapterIndex < 5 || session.convoyFlow?.state !== "sectorActive") return true;
    const complete = session.phase.boss && session.convoyFlow.sectorIndex === 3
      ? session.troops.some((troop) => !troop.dead && troop.hp > 0
        && troop.type === "sniper" && [1, 3].includes(troop.row))
      : [1, 3].every((row) => session.troops.some((troop) =>
        !troop.dead && troop.type === "medicaNanites" && troop.row === row));
    if (complete) this.convoySupportScreenEstablished = true;
    return this.convoySupportScreenEstablished;
  }

  plan(
    session,
  ) {
    const observation = this.observe(
      session,
    );

    if (
      observation.state.outcome
      || session.result
    ) {
      return {
        observation,
        actions: [],
      };
    }

    const actions = [];

    actions.push(...this.planConvoyOpening(session));
    actions.push(...this.planConvoyReposition(session));
    actions.push(...this.planConvoyEscort(session));
    actions.push(...this.planConvoyBaseDefense(session));
    actions.push(...this.planConvoyStrikeScreen(session));
    actions.push(...this.planConvoySupportScreen(session));

    if (
      this.config.collectEnergyPickups
      && session.energyPickups?.length
    ) {
      actions.push({
        type: "collectPickup",
        priority: 210,
        reason: "energyPickup",
      });
    }

    actions.push(
      ...this.planAdaptiveAid(
        observation,
      ),
    );

    if (
      actions.some(
        (action) => (
          action.priority >= 190
        ),
      )
    ) {
      return {
        observation,
        actions: actions.sort(
          (left, right) => (
            right.priority
            - left.priority
          ),
        ),
      };
    }

    if (!this.hasConvoyStrikeScreen(session)) {
      return { observation, actions: [] };
    }
    if (!this.hasConvoyBaseScreen(session)) {
      return { observation, actions: [] };
    }
    if (!this.hasConvoySupportScreen(session)) {
      return { observation, actions: [] };
    }

    actions.push(
      ...this.planPendingDecision(
        session,
        observation,
      ),
    );

    if (
      observation.state.pendingDecision
      || waveOutroActive(observation)
    ) {
      return {
        observation,
        actions: actions.sort(
          (left, right) => (
            right.priority
            - left.priority
          ),
        ),
      };
    }

    if (isSystemEnabledForPhase(session.phase, "dematerializationPulse")) {
      actions.push(
        ...planDematerializationPulseActions(
          session,
          observation,
          this.profile,
        ),
      );
    }

    actions.push(
      ...planSpecialActions(
        session,
        observation,
        this.profile,
      ),
    );

    const replacementActions = (
      planReplacementActions(
        session,
        observation,
        this.profile,
        Math.max(
          1,
          this.config.maximumActionsPerTick - 1,
        ),
      ).filter((action) => session.phase.progressionMode !== "convoy" || action.troopId !== "droneSentinela")
    );

    actions.push(
      ...replacementActions.map(
        (action) => ({
          ...action,
          priority:
            130 + action.score,
        }),
      ),
    );

    const placementPlan = (
      planPlacementActions(
        session,
        observation,
        this.profile,
        Math.max(
          1,
          this.config.maximumActionsPerTick - 1,
        ),
      )
    );

    actions.push(
      ...placementPlan.actions.map(
        (action) => ({
          ...action,
          priority:
            60 + action.score,
        }),
      ),
    );

    actions.push(
      ...this.planWaveStart(
        observation,
      ),
    );

    const orderedActions = actions.sort((left, right) => right.priority - left.priority);
    let placementBudget = session.phase.progressionMode === "convoy" && session.convoyFlow?.sectorIndex === 3
      ? Math.max(0, session.energy - 5)
      : Infinity;
    const affordableActions = orderedActions.filter((action) => {
      if (action.type !== "place" || placementBudget === Infinity) return true;
      const cost = Number(action.price ?? getEffectiveTroopStats(session, action.troopId)?.price ?? 0);
      if (cost > placementBudget) return false;
      placementBudget -= cost;
      return true;
    });

    return {
      observation,
      reserve:
        placementPlan.reserve,
      emergency:
        placementPlan.emergency,
      actions: affordableActions
        .slice(
          0,
          this.config.maximumActionsPerTick,
        ),
    };
  }

  summary() {
    return this.memory.summary();
  }
}
