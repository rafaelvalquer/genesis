const QUALITY_COUNT = { low: 3, medium: 6, high: 10 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function random(seed) { const next = (Math.imul(seed ^ seed >>> 15, seed | 1) + 0x6d2b79f5) >>> 0; return [next, next / 4294967296]; }
export function drawConvoyImpacts(ctx, impacts = [], now = 0, settings = {}) {
  if (!ctx) return;
  const quality = settings.quality || "high";
  for (const impact of impacts) {
    const progress = clamp((now - impact.born) / impact.life, 0, 1);
    if (progress >= 1) continue;
    const count = (QUALITY_COUNT[quality] || 10) + (impact.severity === "critical" ? 4 : impact.severity === "heavy" ? 2 : 0);
    let seed = impact.seed || 1;
    ctx.save();
    ctx.globalAlpha = (1 - progress) * (settings.reduceMotion ? .45 : .9);
    ctx.lineWidth = impact.severity === "critical" ? 2 : 1.4;
    for (let index = 0; index < count; index += 1) {
      [seed, seed] = random(seed); const angle = seed * Math.PI * 2;
      [seed, seed] = random(seed); const length = 4 + seed * (impact.severity === "critical" ? 14 : 9);
      [seed, seed] = random(seed); const drift = (seed - .5) * 18 * progress;
      const x = impact.x + Math.cos(angle) * (8 + drift);
      const y = impact.y - 12 + Math.sin(angle) * (8 + drift);
      ctx.strokeStyle = index % 3 === 0 ? "#fff7ed" : index % 2 ? "#fb7185" : "#fbbf24";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length + 10 * progress); ctx.stroke();
    }
    ctx.restore();
  }
}
