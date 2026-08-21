import {
  ENEMIES,
} from "../../content.js";
import {
  buildSpawnQueue,
  enemyThreat,
  phaseBudget,
  wavePressure,
} from "../../domain.js";
import { getMissionEncounters } from "../../missionProgression.js";
import { buildSectorQueue } from "../../chapter07/convoySpawnDirector.js";

function collectWaveEntries(
  phase,
) {
  if (phase.progressionMode === "convoy") {
    return (phase.sectors || []).flatMap((sector, waveIndex) => [
      ...(sector.openingPackets || []),
      ...(sector.reinforcement?.packetPool || []),
    ].flatMap((packet) => (packet.units || []).map((entry) => ({ ...entry, waveIndex }))));
  }
  return phase.waves.flatMap(
    (wave, waveIndex) => {
      const entries = Array.isArray(
        wave.enemies,
      )
        ? wave.enemies
        : [];

      return entries.map((entry) => ({
        ...entry,
        waveIndex,
      }));
    },
  );
}

export function createPhaseForecast(
  phase,
  seed = 1,
) {
  const entries = collectWaveEntries(phase);

  const enemyTypes = [
    ...new Set(
      entries.map((entry) => entry.type),
    ),
  ];

  const enemyConfigs = enemyTypes
    .map((type) => ENEMIES[type])
    .filter(Boolean);

  const totalUnits = entries.reduce(
    (total, entry) => (
      total + Number(entry.count || 0)
    ),
    0,
  );

  const encounters = getMissionEncounters(phase);
  const waveQueues = encounters.map((_, waveIndex) => (
    phase.progressionMode === "convoy"
      ? buildSectorQueue(phase, waveIndex, seed + waveIndex * 997)
      : buildSpawnQueue(phase, waveIndex, seed + waveIndex * 997)
  ));
  const maximumWavePressure = phase.progressionMode === "convoy"
    ? Math.max(0, ...waveQueues.map((queue) => queue.reduce((total, entry) => total + enemyThreat(entry), 0)))
    : Math.max(0, ...encounters.map((_, waveIndex) => wavePressure(phase, waveIndex)));

  const explicitRows = Array.from(
    { length: 5 },
    () => 0,
  );

  waveQueues.forEach((queue) => {
    queue.forEach((entry) => {
      if (
        Number.isInteger(entry.row)
        && entry.row >= 0
        && entry.row < explicitRows.length
      ) {
        explicitRows[entry.row] += (
          enemyThreat(entry)
        );
      } else {
        const average = (
          enemyThreat(entry)
          / explicitRows.length
        );

        explicitRows.forEach(
          (_, row) => {
            explicitRows[row] += average;
          },
        );
      }
    });
  });

  const airborne = enemyConfigs.some(
    (enemy) => enemy.airborne === true,
  );

  const boss = enemyConfigs.some(
    (enemy) => enemy.boss === true,
  );

  const shields = enemyConfigs.some(
    (enemy) => (
      Number(enemy.shield) > 0
      || Number(enemy.shieldMax) > 0
      || Number(enemy.shieldPulseEveryMs) > 0
    ),
  );

  const summoners = enemyConfigs.some(
    (enemy) => (
      enemy.summoner
      || enemy.summonCount
      || enemy.maximumLivingSummons
      || enemy.hatchAfterMs
    ),
  );

  const highSpeed = enemyConfigs.some(
    (enemy) => (
      Number(enemy.speed) >= 70
    ),
  );

  const hazardId = (
    phase.environmentHazard?.id
    || null
  );

  const mechanicId = (
    phase.chapterMechanic?.id
    || null
  );

  return {
    phaseId: phase.id,
    totalUnits,
    totalThreat: phaseBudget(phase),
    maximumWavePressure,
    enemyTypes,
    airborne,
    boss,
    shields,
    summoners,
    highSpeed,
    hazardId,
    mechanicId,
    laneThreat: explicitRows,
    waveQueues,
    totalWaves: encounters.length,
    targetDurationMs: (
      Number(phase.targetDurationMs)
      || null
    ),
  };
}

export function getCurrentWaveForecast(
  phaseForecast,
  waveIndex,
) {
  const queue = (
    phaseForecast.waveQueues[
      Math.max(
        0,
        Math.min(
          phaseForecast.waveQueues.length - 1,
          Number(waveIndex) || 0,
        ),
      )
    ] || []
  );

  const laneThreat = Array.from(
    { length: 5 },
    () => 0,
  );

  queue.forEach((entry) => {
    const value = enemyThreat(entry);

    if (
      Number.isInteger(entry.row)
      && entry.row >= 0
      && entry.row < laneThreat.length
    ) {
      laneThreat[entry.row] += value;
    } else {
      laneThreat.forEach(
        (_, row) => {
          laneThreat[row] += (
            value / laneThreat.length
          );
        },
      );
    }
  });

  return {
    queue,
    laneThreat,
    totalThreat: laneThreat.reduce(
      (total, value) => total + value,
      0,
    ),
  };
}
