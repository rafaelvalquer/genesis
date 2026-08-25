export const VERTEBRAL_TOXIN_FACTOR = 0.70;

export function applyVertebralToxin(session, troop, durationMs = 3000, factor = VERTEBRAL_TOXIN_FACTOR) {
  if (!troop || troop.dead) return false;
  const now = session.elapsed;
  const active = (troop.vertebralToxinUntil || 0) > now;
  troop.vertebralToxinUntil = Math.max(troop.vertebralToxinUntil || 0, now + durationMs);
  troop.vertebralToxinFactor = factor;
  if (typeof session.refreshTroopAttackSpeedFactor === "function") session.refreshTroopAttackSpeedFactor(troop);
  return active;
}

export function isVertebralToxinActive(session, troop) {
  return Boolean(troop && (troop.vertebralToxinUntil || 0) > session.elapsed);
}

export function getVertebralToxinAttackSpeedFactor(session, troop) {
  return isVertebralToxinActive(session, troop) ? troop.vertebralToxinFactor || VERTEBRAL_TOXIN_FACTOR : 1;
}
