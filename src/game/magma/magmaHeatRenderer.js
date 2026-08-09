import { getMagmaThermalVisual } from "./magmaVisualConfig.js";

const TAU = Math.PI * 2;

export function drawMagmaHeatShimmer(ctx, regionRuntime, blend, now, options) {
  if (!options.quality.shimmer || options.paused) return;
  const frame = blend < 0.5 ? regionRuntime.previous : regionRuntime.next;
  const source = frame?.surfaceCanvas;
  if (!source) return;
  const { bounds } = regionRuntime.region;
  const stripHeight = 6;
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let localY = 3; localY < bounds.height; localY += stripHeight * 2) {
    const sourceY = localY / bounds.height * frame.height;
    const sourceHeight = stripHeight / bounds.height * frame.height;
    const distortion = Math.sin(now * 0.003 + (bounds.y + localY) * 0.08 + regionRuntime.region.seed) * 1.5;
    ctx.drawImage(
      source,
      0,
      sourceY,
      frame.width,
      Math.max(1, sourceHeight),
      bounds.x + distortion,
      bounds.y + localY,
      bounds.width,
      stripHeight,
    );
  }
  ctx.restore();
}

export function drawMagmaSmoke(ctx, runtime, now, options) {
  if (!runtime?.smoke?.length || options.quality.smokeScale <= 0) return;
  const thermal = getMagmaThermalVisual(options.thermalState);
  const desired = Math.min(
    runtime.smoke.length,
    Math.round(options.smokeCount[options.thermalState] * options.quality.smokeScale),
  );
  const visualTime = options.paused ? runtime.visualTimeMs : runtime.visualTimeMs + Math.max(0, now - runtime.lastClockAt);
  ctx.save();
  for (let index = 0; index < desired; index += 1) {
    const smoke = runtime.smoke[index];
    const progress = ((visualTime + smoke.phaseMs) % smoke.periodMs) / smoke.periodMs;
    const rise = progress * smoke.rise;
    const x = smoke.x + Math.sin(progress * TAU + smoke.seed) * smoke.drift;
    const y = smoke.y - 8 - rise;
    const radius = smoke.radius * (0.5 + progress * 0.65);
    const fade = Math.sin(progress * Math.PI) * smoke.opacity * thermal.smokeFactor;
    for (let lobe = 0; lobe < 3; lobe += 1) {
      const lobePhase = smoke.seed * 1.7 + lobe * 2.19 + progress * TAU * (0.7 + lobe * 0.08);
      const lobeRadius = radius * (0.58 + lobe * 0.13);
      const lobeX = x + Math.cos(lobePhase) * radius * (0.08 + lobe * 0.035);
      const lobeY = y + Math.sin(lobePhase) * radius * 0.055 - lobe * radius * 0.045;
      const gradient = ctx.createRadialGradient(
        lobeX,
        lobeY,
        lobeRadius * 0.06,
        lobeX,
        lobeY,
        lobeRadius,
      );
      gradient.addColorStop(0, `rgba(96,31,12,${0.055 * fade})`);
      gradient.addColorStop(0.45, `rgba(62,19,10,${0.044 * fade})`);
      gradient.addColorStop(1, "rgba(26,8,6,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(lobeX, lobeY, lobeRadius, lobeRadius * 0.46, -0.08 + lobe * 0.06, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}
