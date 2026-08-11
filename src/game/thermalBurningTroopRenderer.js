const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function intensityFor(troop, elapsed, state) {
  if (state === "burning") {
    const starts = [troop.thermalBurnStartedAt, troop.emberBurnStartedAt]
      .filter((value) => Number.isFinite(value));
    const startedAt = starts.length ? Math.min(...starts) : elapsed;
    return clamp((elapsed - startedAt) / 220, 0, 1);
  }
  if (state === "extinguishing") {
    const ends = [troop.thermalBurnEndedAt, troop.emberBurnEndedAt]
      .filter((value) => Number.isFinite(value));
    const endedAt = ends.length ? Math.max(...ends) : elapsed;
    return clamp(1 - (elapsed - endedAt) / 320, 0, 1);
  }
  return state === "exposed" ? 0.28 : 0;
}

export function getTroopThermalVisualState(troop, elapsed) {
  if (troop?.thermalBurning || elapsed < Number(troop?.emberBurnUntil || 0)) return "burning";
  const thermalEnded = troop?.thermalBurnEndedAt != null && elapsed - troop.thermalBurnEndedAt < 320;
  const emberEnded = troop?.emberBurnEndedAt != null && elapsed - troop.emberBurnEndedAt < 320;
  if (thermalEnded || emberEnded) return "extinguishing";
  if (troop?.thermalExposed) return "exposed";
  return "none";
}

function flame(ctx, x, baseY, width, height, phase, alpha = 1) {
  const sway = Math.sin(phase) * width * 0.45;
  const tipX = x + sway;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#c2410c";
  ctx.beginPath();
  ctx.moveTo(x - width, baseY);
  ctx.bezierCurveTo(x - width * .75, baseY - height * .45, tipX - width * .25, baseY - height * .8, tipX, baseY - height);
  ctx.bezierCurveTo(tipX + width * .35, baseY - height * .7, x + width, baseY - height * .2, x + width, baseY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f97316";
  ctx.beginPath(); ctx.ellipse(x, baseY - height * .28, width * .68, height * .52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.beginPath(); ctx.ellipse(tipX, baseY - height * .38, width * .36, height * .38, 0, 0, Math.PI * 2); ctx.fill();
}

function ember(ctx, x, y, phase, alpha) {
  ctx.globalAlpha = alpha; ctx.fillStyle = "#facc15";
  ctx.beginPath(); ctx.arc(x + Math.sin(phase) * 4, y, 1.5, 0, Math.PI * 2); ctx.fill();
}

export function drawThermalBurnBackLayer(ctx, troop, rect, elapsed, settings = {}, state) {
  const amount = intensityFor(troop, elapsed, state); if (!amount) return;
  const reduce = settings.reduceMotion ? .25 : 1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(249,115,22,.22)";
  ctx.beginPath(); ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height - 2, rect.width * .32, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (state !== "exposed") {
    const h = clamp(rect.height * .25, 18, 42), w = clamp(rect.width * .1, 6, 15);
    flame(ctx, rect.x + rect.width * .3, rect.y + rect.height, w, h * .9, elapsed * .012 * reduce + 1, amount);
    flame(ctx, rect.x + rect.width * .68, rect.y + rect.height, w, h, elapsed * .012 * reduce + 3, amount);
    flame(ctx, rect.x + rect.width * .5, rect.y + rect.height - rect.height * .08, w * .8, h * .7, elapsed * .015 * reduce + 5, amount);
  }
  ctx.restore();
}

export function drawThermalBurnFrontLayer(ctx, troop, rect, elapsed, settings = {}, state) {
  const amount = intensityFor(troop, elapsed, state); if (!amount) return;
  const reduce = settings.reduceMotion ? .2 : 1;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  if (state !== "exposed") {
    const h = clamp(rect.height * .2, 16, 34), w = clamp(rect.width * .08, 5, 12);
    [0.18, .42, .76, .9].forEach((position, index) => flame(ctx, rect.x + rect.width * position, rect.y + rect.height - 2, w, h * (index % 2 ? .75 : 1), elapsed * .013 * reduce + index * 1.73, amount));
  }
  const count = settings.reduceMotion ? 2 : 4;
  for (let index = 0; index < count; index += 1) {
    const progress = ((elapsed * (.00055 + index * .00007) + index * .23) % 1);
    ember(ctx, rect.x + rect.width * (.2 + index * .2), rect.y + rect.height - progress * 70, elapsed * .01 + index, amount * (1 - progress));
  }
  if (state === "burning" && !settings.reduceMotion) {
    ctx.fillStyle = "rgba(30,30,30,.22)";
    for (let index = 0; index < 2; index += 1) { const p = ((elapsed * .00018 + index * .5) % 1); ctx.globalAlpha = amount * (1 - p) * .45; ctx.beginPath(); ctx.arc(rect.x + rect.width * (.35 + index * .3), rect.y + rect.height * .2 - p * 22, 3 + p * 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
