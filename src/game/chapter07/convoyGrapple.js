export function isConvoyGrappled(session) {
  return Boolean(session?.convoy?.grappledByEnemyId);
}

export function canReserveConvoyGrapple(session, enemyId) {
  const convoy = session?.convoy;
  if (!convoy || !enemyId || convoy.invulnerable || convoy.hp <= 0) return false;
  return !convoy.grappledByEnemyId && (!convoy.grappleReservationEnemyId || convoy.grappleReservationEnemyId === enemyId);
}

export function reserveConvoyGrapple(session, enemyId) {
  if (!canReserveConvoyGrapple(session, enemyId)) return false;
  session.convoy.grappleReservationEnemyId = enemyId;
  return true;
}

export function commitConvoyGrapple(session, enemyId) {
  const convoy = session?.convoy;
  if (!convoy || convoy.grappleReservationEnemyId !== enemyId || convoy.grappledByEnemyId) return false;
  convoy.grappledByEnemyId = enemyId;
  convoy.grappleReservationEnemyId = null;
  convoy.grappledSince = session.elapsed;
  return true;
}

export function releaseConvoyGrapple(session, enemyId) {
  const convoy = session?.convoy;
  if (!convoy) return false;
  let released = false;
  if (convoy.grappledByEnemyId === enemyId) { convoy.grappledByEnemyId = null; convoy.grappledSince = null; released = true; }
  if (convoy.grappleReservationEnemyId === enemyId) { convoy.grappleReservationEnemyId = null; released = true; }
  return released;
}
