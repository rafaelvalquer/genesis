export const BOSS_ENCOUNTER_PACKET_ID = "boss_encounter";
export const BOSS_REINFORCEMENT_BLOCK = "boss_reinforcement";

export function sortBossSpawnQueue(queue = []) {
  queue.sort((left, right) => (
    Number(left.spawnAtMs || 0) - Number(right.spawnAtMs || 0)
    || String(left.packetId || "").localeCompare(String(right.packetId || ""))
    || Number(left.sourceIndex || 0) - Number(right.sourceIndex || 0)
  ));
  return queue;
}

export function createBossEncounterState(wave) {
  if (!wave?.bossEncounter) return null;
  return {
    ...wave.bossEncounter,
    spawned: false,
    reinforcementPackets: new Set(),
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
  queue.push(entry);
  sortBossSpawnQueue(queue);
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
  if (!encounter || !packet || encounter.reinforcementPackets.has(packetKey)) return [];

  encounter.reinforcementPackets.add(packetKey);
  const livingByType = new Map();
  session.enemies
    .filter((enemy) => !enemy.dead)
    .forEach((enemy) => {
      livingByType.set(enemy.type, (livingByType.get(enemy.type) || 0) + 1);
    });

  const rowCount = Math.max(1, Math.floor(Number(fieldRows) || 1));
  const row = Math.floor(session.rng() * rowCount);
  const at = Math.max(0, session.elapsed - session.waveStartedAt);
  const packetId = `boss_${packet.id}_${encounter.reinforcementPackets.size}`;
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

  session.queue.push(...entries);
  sortBossSpawnQueue(session.queue);
  session.nextSpawnAt = session.waveStartedAt
    + (session.queue[0]?.spawnAtMs ?? Infinity);
  return entries;
}

export function updateBossEncounter(session, options = {}) {
  const encounter = session?.bossEncounter;
  if (!encounter?.spawned) return [];
  const boss = session.enemies.find(
    (enemy) => !enemy.dead && enemy.type === encounter.type,
  );
  if (!boss) return [];

  const triggered = [];
  for (const reinforcement of encounter.reinforcements || []) {
    if (boss.hp > boss.maxHp * reinforcement.hpFactor
      || encounter.reinforcementPackets.has(reinforcement.packet)) continue;
    options.enqueueReinforcement?.(reinforcement.packet);
    triggered.push(reinforcement.packet);
  }
  return triggered;
}
