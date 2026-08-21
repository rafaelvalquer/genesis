import { choosePacketRows, createRng } from "../domain.js";

const expandPacket = (packet, rows, generationId, sectorId) => (packet.units || []).flatMap((unit) =>
  Array.from({ length: unit.count || 1 }, (_, index) => ({
    type: unit.type, variant: unit.variant || null, row: rows[index % rows.length],
    sourceIndex: index, spawnAtMs: (packet.atMs || 0) + index * (unit.intervalMs || 180),
    packetId: packet.id, sectorId, generationId, spawnSource: "convoySector",
  })));

export function buildSectorQueue(phase, sectorIndex, seed) {
  const sector = phase.sectors[sectorIndex];
  if (!sector) return [];
  const rng = createRng(seed + sectorIndex * 1009);
  const allowedRows = phase.rules.combatRows;
  const recentRows = [];
  const pressure = Array(5).fill(0);
  return (sector.openingPackets || []).flatMap((packet, index) => {
    const rows = choosePacketRows({ strategy: packet.routeStrategy || "split", rng, recentRows,
      routePressure: pressure, packetIndex: index, fixedRows: packet.fixedRows, allowedRows });
    return expandPacket(packet, rows.length ? rows : [allowedRows[0]], sectorIndex + 1, sector.id);
  }).sort((a, b) => a.spawnAtMs - b.spawnAtMs || a.packetId.localeCompare(b.packetId));
}

export function updateConvoyReinforcements(session, events = []) {
  if (session.convoyFlow.state !== "sectorActive") return;
  const sector = session.phase.sectors[session.convoyFlow.sectorIndex];
  const config = sector?.reinforcement;
  if (!config) return;
  const director = session.convoyFlow.spawnDirector;
  const sectorElapsed = session.elapsed - session.convoyFlow.sectorStartedAt;
  if (!director.warningEmitted && sectorElapsed >= config.warningAtMs) {
    director.warningEmitted = true;
    events.push({ type: "reinforcementWarning", sectorIndex: session.convoyFlow.sectorIndex });
  }
  if (sectorElapsed < config.startsAtMs || session.elapsed < director.nextReinforcementAt) return;
  director.nextReinforcementAt = session.elapsed + config.intervalMs;
  if (session.enemies.length >= config.maxAliveEnemies) {
    events.push({ type: "reinforcementSkipped", reason: "enemyCap", cap: config.maxAliveEnemies });
    return;
  }
  const pool = config.packetPool || [];
  if (!pool.length) return;
  const packet = pool[Math.floor(session.rng() * pool.length)];
  const allowedRows = session.phase.rules.combatRows;
  const weighted = allowedRows.flatMap((row) => Array.from({ length: Math.max(1, Math.round(sector.routeWeights?.[row] || 1)) }, () => row));
  const row = weighted[Math.floor(session.rng() * weighted.length)] ?? allowedRows[0];
  const generationId = director.generationId;
  const entries = expandPacket({ ...packet, atMs: session.elapsed - session.convoyFlow.sectorStartedAt }, [row], generationId, sector.id)
    .map((entry) => ({ ...entry, spawnAtMs: entry.spawnAtMs }));
  session.queue.push(...entries);
  session.queue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);
  session.nextSpawnAt = session.waveStartedAt + (session.queue[0]?.spawnAtMs || 0);
  session.convoyFlow.reinforcementLevel += 1;
  events.push({ type: "reinforcementQueued", count: entries.length, row });
}

export function cancelConvoySectorSpawns(session) {
  session.queue = [];
  session.nextSpawnAt = Infinity;
  session.convoyFlow.spawnDirector.generationId += 1;
}
