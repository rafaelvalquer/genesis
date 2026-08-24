const SPARK_COUNT = { low: 2, medium: 5, high: 8 };

function seeded(seed = 1) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function drawDeploymentVisual(ctx, effect, visualNow, settings = {}) {
  const life = Math.max(1, effect.life || 520);
  const progress = Math.max(0, Math.min(1, (visualNow - effect.born) / life));
  const alpha = 1 - progress;
  const color = effect.color || (effect.kind === "remove" ? "#fbbf24" : effect.kind === "wave" ? "#f43f5e" : "#67e8f9");
  const sourceType = effect.sourceType || effect.kind;
  const deployment = sourceType === "deploy" || effect.kind === "deploy" || effect.kind === "droneStack";
  const supported = deployment || effect.kind === "remove" || effect.kind === "wave";

  if (sourceType === "deploy") {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, Math.max(0.01, 5 + progress * 65), 0, Math.PI * 2);
    ctx.stroke();

    const random = seeded(effect.seed);
    const count = SPARK_COUNT[settings.quality] || SPARK_COUNT.high;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 28 + random() * 80;
      const sparkLife = 340 * (0.78 + random() * 0.55);
      const sparkProgress = Math.max(0, Math.min(1, (visualNow - effect.born) / sparkLife));
      if (sparkProgress >= 1) continue;
      const seconds = (visualNow - effect.born) / 1000;
      const distance = speed * seconds;
      const size = 2 * (0.65 + random() * 0.8);
      ctx.globalAlpha = (1 - sparkProgress) * 0.95;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!supported) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(effect.x, effect.y + 42, 34 + progress * 20, 9 + progress * 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (settings.quality !== "low") {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = color;
    const y = effect.kind === "remove" ? effect.y - 55 + progress * 120 : effect.y + 60 - progress * 120;
    ctx.fillRect(effect.x - 31, y, 62, 2);
  }
  ctx.globalAlpha = 1;
}
