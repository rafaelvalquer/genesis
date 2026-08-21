export function damageConvoy(session, amount, events = [], context = {}) {
  const convoy = session.convoy;
  if (!convoy || convoy.invulnerable || convoy.hp <= 0 || amount <= 0) return 0;
  const before = convoy.hp;
  convoy.hp = Math.max(0, convoy.hp - amount);
  convoy.lastHitAt = session.elapsed;
  if (context.attackerId && !convoy.attackerIds.includes(context.attackerId)) convoy.attackerIds.push(context.attackerId);
  convoy.underAttack = true;
  const ratio = convoy.hp / convoy.maxHp;
  convoy.damageState = ratio <= 0 ? "destroyed" : ratio < .2 ? "critical" : ratio < .4 ? "heavy" : ratio < .7 ? "light" : "normal";
  if (convoy.hp <= 0) convoy.destroyedAt ??= session.elapsed;
  events.push({ type: "convoyHit", amount: before - convoy.hp, hp: convoy.hp, attackerId: context.attackerId || null, x: convoy.x, y: convoy.y });
  if (ratio < .2 && before / convoy.maxHp >= .2) events.push({ type: "convoyCritical", hp: convoy.hp });
  return before - convoy.hp;
}
