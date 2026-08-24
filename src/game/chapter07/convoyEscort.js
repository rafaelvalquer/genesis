import { getConvoyColumn } from "./convoyGeometry.js";

export function isEscortOperational(troop, session) {
  if (!troop || troop.dead || troop.hp <= 0 || troop.structure || troop.type === "thermalPlatform") return false;
  const elapsed = session?.elapsed || 0;
  return !troop.windRecovery
    && elapsed >= (troop.controlStunnedUntil || 0)
    && elapsed >= (troop.sporeConfusedUntil || 0)
    && elapsed >= (troop.stunnedUntil || 0)
    && elapsed >= (troop.paralyzedUntil || 0)
    && elapsed >= (troop.electricParalyzedUntil || 0)
    && !troop.rasgamarCoiledBy
    && !troop.incapacitated;
}

export function getEscortTroops(session) {
  const convoy = session.convoy;
  if (!convoy) return [];
  const rows = session.phase.convoy.escortRows || [1, 3];
  const radius = session.phase.convoy.escortColumnRadius ?? 1;
  const col = getConvoyColumn(convoy);
  return session.troops.filter((troop) => isEscortOperational(troop, session)
    && rows.includes(troop.row) && Math.abs(troop.col - col) <= radius);
}

export function updateConvoyEscort(session, events = []) {
  if (!session.convoy) return [];
  const wasEscorted = session.convoy.escorted;
  const escorts = getEscortTroops(session);
  session.convoy.escortTroopIds = escorts.map((troop) => troop.id);
  session.convoy.escorted = escorts.length > 0;
  if (wasEscorted !== session.convoy.escorted) events.push({
    type: session.convoy.escorted ? "escortRestored" : "escortLost",
    convoyId: session.convoy.id,
  });
  if (wasEscorted && !session.convoy.escorted && session.troops.some((troop) => elapsedSporeConfused(troop, session.elapsed))) {
    session.chapterSevenMetrics && (session.chapterSevenMetrics.escortLostWhileSporeConfused += 1);
  }
  return escorts;
}

const elapsedSporeConfused = (troop, elapsed) => elapsed < (troop?.sporeConfusedUntil || 0);
