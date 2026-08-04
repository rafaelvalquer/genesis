import {
  enqueueSpawnEntries,
  sortSpawnQueue,
  syncSessionNextSpawnAt,
} from "./spawnQueueSystem.js";

export const BOSS_ENCOUNTER_PACKET_ID = "boss_encounter";
export const BOSS_REINFORCEMENT_BLOCK = "boss_reinforcement";
export const REINFORCEMENT_PENDING = "pending";
export const REINFORCEMENT_QUEUED = "queued";
export const REINFORCEMENT_COMPLETED = "completed";

export const sortBossSpawnQueue = sortSpawnQueue;

function createReinforcementStates(reinforcements = []) {
  return new Map(
    reinforcements
      .filter((entry) => entry?.packet)
      .map((entry) => [entry.packet, REINFORCEMENT_PENDING]),
  );
}

function ensureReinforcementState(encounter, packetKey) {
  encounter.reinforcementStates ||= createReinforcementStates(encounter.reinforcements);
  if (!encounter.reinforcementStates.has(packetKey)) {
    encounter.reinforcementStates.set(packetKey, REINFORCEMENT_PENDING);
  }
  return encounter.reinforcementStates.get(packetKey);
}

export function createBossEncounterState(wave) {
  if (!wave?.bossEncounter) return null;
  return {
    ...wave.bossEncounter,
    spawned: false,
    reinforcementPackets: new Set(),
    reinforcementStates: createReinforcementStates(wave.bossEncounter.reinforcements),
    nextReinforcementAt: 0,
  };
}

export function enqueueBoss(queue, encounter, options = {}) {
  if (!encounter) return null;
  const entry = {
    type: encounter.type,
    variant: null,
    sourceIndex: 0,
    row: Number.isInteger(options.row) ? options.row : 2,
    packetId: BOSS_ENCOUNTER_PACKET_ID,
    block: "boss",
    spawnAtMs: Number(encounter.spawnAtMs) || 0,
  };
  enqueueSpawnEntries(queue, entry);
  return entry;
}

export function initializeBossEncounterForWave(session, wave, queue = session.queue, options = {}) {
  const encounter = createBossEncounterState(wave);
  session.bossEncounter = encounter;
  if (encounter) enqueueBoss(queue, encounter, options);
  return encounter;
}

export function markBossEncounterSpawned(session, queued) {
  const encounter = session?.bossEncounter;
  if (!encounter || queued?.packetId !== BOSS_ENCOUNTER_PACKET_ID
    || queued?.type !== encounter.type) return false;
  encounter.spawned = true;
  return true;
}

export function markBossReinforcementSpawned(session, queued) {
  const encounter = session?.bossEncounter;
  const packetKey = queued?.reinforcementPacketKey;
  if (!encounter || queued?.block !== BOSS_REINFORCEMENT_BLOCK || !packetKey) return false;
  const stillQueued = session.queue.some((entry) => (
    entry?.block === BOSS_REINFORCEMENT_BLOCK
    && entry.reinforcementPacketKey === packetKey
  ));
  if (stillQueued) return false;
  ensureReinforcementState(encounter, packetKey);
  encounter.reinforcementStates.set(packetKey, REINFORCEMENT_COMPLETED);
  return true;
}

export function isBossSlotReserved(session) {
  const encounter = session?.bossEncounter;
  if (!encounter || encounter.spawned) return false;
  return Number(session.elapsed || 0)
    < Number(session.waveStartedAt || 0) + Number(encounter.spawnAtMs || 0);
}

export function shouldDeferBossAwareSpawn(session, queued, maximumLiving, livingCount) {
  if (!Number.isFinite(maximumLiving)
    || queued?.packetId === BOSS_ENCOUNTER_PACKET_ID) return false;
  const reserve = isBossSlotReserved(session) ? 1 : 0;
  return Number(livingCount || 0) >= maximumLiving - reserve;
}

export function enqueueBossReinforcement(
  session,
  packetKey,
  { packets, fieldRows = 5 } = {},
) {
  const encounter = session?.bossEncounter;
  const packet = packets?.[packetKey];
  if (!encounter || !packet) return [];

  const state = ensureReinforcementState(encounter, packetKey);
  if (state === REINFORCEMENT_QUEUED || state === REINFORCEMENT_COMPLETED
    || encounter.reinforcementPackets.has(packetKey)) return [];

  const livingByType = new Map();
  session.enemies
    .filter((enemy) => !enemy.dead)
    .forEach((enemy) => {
      livingByType.set(enemy.type, (livingByType.get(enemy.type) || 0) + 1);
    });

  const rowCount = Math.max(1, Math.floor(Number(fieldRows) || 1));
  const row = Math.floor(session.rng() * rowCount);
  const at = Math.max(0, session.elapsed - session.waveStartedAt);
  const packetId = `boss_${packet.id}_${encounter.reinforcementStates.size}`;
  const entries = [];

  for (const unit of packet.units || []) {
    const maximum = encounter.maximumLivingByType?.[unit.type] ?? Infinity;
    const available = Math.max(0, maximum - (livingByType.get(unit.type) || 0));
    const rows = unit.rows?.length ? unit.rows : [row];
    const countPerRow = unit.rows?.length ? unit.countPerRow || 1 : unit.count;
    const count = Math.min(rows.length * countPerRow, available);
    livingByType.set(unit.type, (livingByType.get(unit.type) || 0) + count);
    let remaining = count;

    rows.forEach((unitRow, rowIndex) => {
      for (let index = 0; index < countPerRow && remaining > 0; index += 1, remaining -= 1) {
        entries.push({
          type: unit.type,
          variant: null,
          sourceIndex: rowIndex * countPerRow + index,
          row: unitRow,
          packetId,
          reinforcementPacketKey: packetKey,
          block: BOSS_REINFORCEMENT_BLOCK,
          spawnAtMs: at + (unit.spawnDelayMs || 0) + index * (unit.spawnIntervalMs || 0),
          xOffsetTiles: unit.xOffsetTiles || 0,
          formationOffsetPx: unit.spawnIntervalMs
            ? 0
            : (index - (countPerRow - 1) / 2) * 10,
        });
      }
    });
  }

  if (!entries.length) {
    encounter.reinforcementStates.set(packetKey, REINFORCEMENT_PENDING);
    return [];
  }

  encounter.reinforcementStates.set(packetKey, REINFORCEMENT_QUEUED);
  encounter.reinforcementPackets.add(packetKey);
  enqueueSpawnEntries(session.queue, entries);
  syncSessionNextSpawnAt(session);
  return entries;
}

export function updateBossEncounter(session, options = {}) {
  const encounter = session?.bossEncounter;
  if (!encounter?.spawned) return [];
  const boss = session.enemies.find(
    (enemy) => !enemy.dead && enemy.type === encounter.type,
  );
  if (!boss || Number(session.elapsed || 0) < Number(encounter.nextReinforcementAt || 0)) {
    return [];
  }

  for (const reinforcement of encounter.reinforcements || []) {
    if (boss.hp > boss.maxHp * reinforcement.hpFactor) continue;
    const state = ensureReinforcementState(encounter, reinforcement.packet);
    if (state !== REINFORCEMENT_PENDING) continue;

    const entries = options.enqueueReinforcement?.(reinforcement.packet) || [];
    if (!entries.length) return [];

    const interval = Math.max(0, Number(
      encounter.reinforcementIntervalMs
        ?? options.minimumIntervalMs
        ?? 900,
    ));
    encounter.nextReinforcementAt = Number(session.elapsed || 0) + interval;
    return [reinforcement.packet];
  }
  return [];
}
