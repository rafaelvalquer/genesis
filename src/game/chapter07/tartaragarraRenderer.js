function seeded(seed = 1) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value = Math.imul(value ^ value >>> 15, value | 1) + 0x6d2b79f5;
    return ((value ^ value >>> 13) >>> 0) / 4294967296;
  };
}

export function drawTartaragarraShellReaction(ctx, enemy, now, settings = {}) {
  if (enemy.type !== "tartaragarra" || now >= (enemy.shellHitUntil || -Infinity)) return;
  const remaining = Math.max(0, (enemy.shellHitUntil - now) / 200);
  const strength = Math.max(.2, enemy.shellHitStrength || .5);
  const random = seeded(enemy.id?.length || 1);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = remaining * strength;
  ctx.strokeStyle = "#d58a46";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(enemy.x + 12, enemy.y - 38, 25 + (1 - remaining) * 5, Math.PI * 1.08, Math.PI * 1.9);
  ctx.stroke();
  ctx.fillStyle = "#f3c978";
  for (let index = 0; index < 3; index += 1) {
    const angle = -Math.PI * (.85 + random() * .3);
    const distance = 18 + random() * 14;
    ctx.beginPath();
    ctx.arc(enemy.x + 12 + Math.cos(angle) * distance, enemy.y - 38 + Math.sin(angle) * distance, 1.5 + random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTartaragarraChargeDust(ctx, enemy, elapsed, settings = {}) {
  if (enemy.type !== "tartaragarra") return;
  const state = enemy.tartaragarraState;
  const prep = state === "chargePrep" && elapsed >= (enemy.tartaragarraStateEndsAt || Infinity) - 250;
  const charging = state === "charge";
  if (!prep && !charging || settings.reduceMotion) return;
  const progress = charging ? Math.min(1, Math.max(0, (elapsed - enemy.tartaragarraStateStartedAt) / 280)) : .5;
  const random = seeded(enemy.id?.length || 1);
  ctx.save();
  ctx.fillStyle = "rgba(190,145,92,.55)";
  for (let index = 0; index < (settings.quality === "low" ? 3 : 6); index += 1) {
    const side = random() * 22;
    const x = enemy.x + 20 + side + (charging ? progress * 18 : 0);
    const y = enemy.y + 42 - random() * 10 - progress * 12;
    ctx.globalAlpha = .5 * (1 - progress * .45);
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTartaragarraEffects(ctx, session, now, settings = {}) {
  for (const enemy of session.enemies || []) {
    if (enemy.dead) continue;
    drawTartaragarraShellReaction(ctx, enemy, now, settings);
    drawTartaragarraChargeDust(ctx, enemy, session.elapsed, settings);
  }
}
