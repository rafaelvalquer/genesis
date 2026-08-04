export function compareSpawnEntries(left, right) {
  return Number(left?.spawnAtMs || 0) - Number(right?.spawnAtMs || 0)
    || String(left?.packetId || "").localeCompare(String(right?.packetId || ""))
    || Number(left?.sourceIndex || 0) - Number(right?.sourceIndex || 0);
}

export function sortSpawnQueue(queue = []) {
  queue.sort(compareSpawnEntries);
  return queue;
}

export function enqueueSpawnEntries(queue, entries) {
  if (!Array.isArray(queue)) throw new TypeError("A fila de spawn deve ser um array.");
  const normalized = Array.isArray(entries) ? entries.filter(Boolean) : [entries].filter(Boolean);
  queue.push(...normalized);
  sortSpawnQueue(queue);
  return normalized;
}

export function getNextSpawnAt(queue = [], waveStartedAt = 0) {
  return Number(waveStartedAt || 0) + (queue[0]?.spawnAtMs ?? Infinity);
}

export function syncSessionNextSpawnAt(session) {
  session.nextSpawnAt = getNextSpawnAt(session.queue, session.waveStartedAt);
  return session.nextSpawnAt;
}
