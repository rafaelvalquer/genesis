import {
  TROOPS,
} from "../../content.js";
import {
  getEffectiveTroopStats,
  getSnapshot,
} from "../../battleModel.js";
import {
  createLaneThreatMap,
  getMostThreatenedLane,
} from "./laneThreatMap.js";
import {
  getCurrentWaveForecast,
} from "../planners/phaseForecast.js";
import {
  getTroopTags,
} from "../planners/troopTaxonomy.js";

function finiteOrNull(value) {
  return Number.isFinite(value)
    ? value
    : null;
}

export function createBattleObservation(
  session,
  agentContext,
) {
  const waveForecast = (
    getCurrentWaveForecast(
      agentContext.phaseForecast,
      session.waveIndex,
    )
  );

  const lanes = createLaneThreatMap(
    session,
    waveForecast,
  );

  const mostThreatenedLane = (
    getMostThreatenedLane(lanes)
  );

  const livingTroops = session.troops.filter(
    (troop) => (
      !troop.dead
      && Number(troop.hp) > 0
    ),
  );

  const livingEnemies = session.enemies.filter(
    (enemy) => (
      !enemy.dead
      && Number(enemy.hp) > 0
    ),
  );

  const deploymentStats = Object.fromEntries(
    session.loadout.map((troopId) => {
      const config = TROOPS[troopId];

      return [
        troopId,
        {
          ...getEffectiveTroopStats(
            session,
            troopId,
          ),
          activeCount: livingTroops.filter(
            (troop) => (
              troop.type === troopId
            ),
          ).length,
          tags: [
            ...getTroopTags(config),
          ],
        },
      ];
    }),
  );

  const integrityPercent = (
    session.integrityMax > 0
      ? (
        session.integrity
        / session.integrityMax
        * 100
      )
      : 0
  );

  const phaseProgress = (
    session.phase.waves.length > 0
      ? (
        session.waveIndex
        / session.phase.waves.length
      )
      : 1
  );

  const targetDurationMs = Number(
    session.phase.targetDurationMs,
  );

  const timePressure = Number.isFinite(
    targetDurationMs,
  ) && targetDurationMs > 0
    ? Math.max(
      0,
      session.elapsed / targetDurationMs,
    )
    : 0;

  const activeBosses = livingEnemies.filter(
    (enemy) => {
      const config = (
        agentContext.enemyConfigs[
          enemy.type
        ]
      );

      return (
        config?.boss
        || enemy.variant === "alpha"
      );
    },
  );

  return {
    snapshot: getSnapshot(session),

    phase: {
      id: session.phase.id,
      waveIndex: session.waveIndex,
      waveNumber: session.waveIndex + 1,
      totalWaves: session.phase.waves.length,
      phaseProgress,
      targetDurationMs:
        finiteOrNull(targetDurationMs),
      elapsedMs: session.elapsed,
      timePressure,
      boss: (
        agentContext.phaseForecast.boss
      ),
    },

    state: {
      waveActive: session.waveActive,
      preparing: session.preparing,
      pendingDecision:
        session.pendingDecision,
      pendingDecisionLevel:
        session.pendingDecisionLevel,
      waveOutroStatus:
        session.waveOutro?.status || "idle",
      outcome: session.outcome,
      pendingOutcome:
        session.pendingOutcome,
    },

    resources: {
      energy: session.energy,
      energyMax: session.energyMax,
      energyRatio: (
        session.energyMax > 0
          ? session.energy
            / session.energyMax
          : 0
      ),
      supply: session.supply,
      supplyMax: session.supplyMax,
      supplyRatio: (
        session.supplyMax > 0
          ? session.supply
            / session.supplyMax
          : 0
      ),
      deploymentStats,
    },

    base: {
      integrity: session.integrity,
      integrityMax: session.integrityMax,
      integrityPercent,
      critical: integrityPercent <= 25,
    },

    lanes,
    mostThreatenedLane,

    enemies: {
      living: livingEnemies,
      count: livingEnemies.length,
      queued: session.queue.length,
      activeBosses,
      projectiles:
        session.enemyProjectiles.length,
    },

    troops: {
      living: livingTroops,
      count: livingTroops.length,
      critical: livingTroops.filter(
        (troop) => (
          troop.hp
          / Math.max(1, troop.maxHp)
          < .35
        ),
      ),
      projectiles:
        session.projectiles.length,
      mines: session.mines.length,
    },

    forecast: waveForecast,

    environment: {
      hazardId:
        session.phase.environmentHazard?.id
        || null,
      mechanicId:
        session.phase.chapterMechanic?.id
        || null,
      sandstormState:
        session.sandstorm?.state || null,
      windState:
        session.windCurrent?.state || null,
      tideState:
        session.tideCycle?.state || null,
    },

    defenses: {
      dematerializationPulses: (session.dematerializationPulses || []).map((pulse) => ({
        id: pulse.id,
        row: pulse.row,
        state: pulse.state,
        chargeStartedAt: pulse.chargeStartedAt,
        fireAt: pulse.fireAt,
        activationSource: pulse.activationSource || null,
      })),
    },

    adaptiveAid: {
      status:
        session.adaptiveAid?.status
        || "disabled",
      availableOptions:
        session.adaptiveAid
          ?.availableOptions
        || [],
      capsule:
        session.adaptiveAid?.capsule
        || null,
    },
  };
}
