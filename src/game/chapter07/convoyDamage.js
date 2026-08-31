import { recordTimelineEvent } from "../telemetry/battleTimeline.js";

export function damageConvoy(session, amount, events = [], context = {}) {
  const convoy = session.convoy;
  if (!convoy || convoy.invulnerable || convoy.hp <= 0 || amount <= 0) return 0;
  const before = convoy.hp;
  convoy.hp = Math.max(0, convoy.hp - amount);
  const dealt = before - convoy.hp;
  if (session.telemetry) {
    session.telemetry.objective.damageTaken += dealt;
    if (context.enemyType) {
      session.telemetry.threats.enemyDamage += dealt;
      session.telemetry.threats.byEnemyType[context.enemyType] = (session.telemetry.threats.byEnemyType[context.enemyType] || 0) + dealt;
    }
  }
  if (dealt > 0) recordTimelineEvent(session, "objective_damage", { target: "convoy", amount: dealt, integrity: convoy.hp });
  convoy.lastHitAt = session.elapsed;
  if (context.underAttackHoldMs > 0) {
    convoy.underAttackHoldUntil = Math.max(convoy.underAttackHoldUntil || -Infinity, session.elapsed + context.underAttackHoldMs);
  }
  if (context.attackerId && !convoy.attackerIds.includes(context.attackerId)) convoy.attackerIds.push(context.attackerId);
  convoy.underAttack = true;
  const ratio = convoy.hp / convoy.maxHp;
  convoy.damageState = ratio <= 0 ? "destroyed" : ratio < .2 ? "critical" : ratio < .4 ? "heavy" : ratio < .7 ? "light" : "normal";
  if (convoy.hp <= 0) convoy.destroyedAt ??= session.elapsed;
  const dealtRatio = dealt / convoy.maxHp;
  const severity = dealtRatio >= .2 ? "critical" : dealtRatio >= .04 ? "heavy" : "normal";
  events.push({ type: "convoyHit", amount: dealt, hp: convoy.hp, attackerId: context.attackerId || null, x: convoy.x, y: convoy.y,
    severity, color: "#fb7185", shake: severity === "critical" ? 2.5 : severity === "heavy" ? 1.8 : 1.1,
    seed: Math.round((session.elapsed || 0) + convoy.x * 17 + convoy.y * 31) });
  if (ratio < .2 && before / convoy.maxHp >= .2) events.push({ type: "convoyCritical", hp: convoy.hp });
  return dealt;
}
