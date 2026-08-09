import { CELL } from "../visualGeometry.js";
import { nextMagmaRandom } from "./magmaFlowRuntime.js";
import { getMagmaThermalVisual } from "./magmaVisualConfig.js";

const TAU = Math.PI * 2;

function activeParticleCount(runtime) {
  let count = 0;
  for (const particle of runtime.particles) if (particle.active) count += 1;
  return count;
}

function spawnParticle(runtime, options) {
  const particle = runtime.particles.find((candidate) => !candidate.active);
  if (!particle || !runtime.regions.length) return false;
  const regionEntry = runtime.regions[Math.floor(nextMagmaRandom(runtime) * runtime.regions.length)];
  const useVent = nextMagmaRandom(runtime) < (options.thermalState === "eruption" ? 0.68 : 0.34);
  const ventLimit = Math.max(1, Math.min(regionEntry.vents.length, options.ventLimit));
  const vent = regionEntry.vents[Math.floor(nextMagmaRandom(runtime) * ventLimit)];
  let x;
  let y;
  if (useVent && vent) {
    x = vent.x + (nextMagmaRandom(runtime) - 0.5) * vent.radius * 2;
    y = vent.y + (nextMagmaRandom(runtime) - 0.5) * 5;
  } else {
    const cell = regionEntry.region.cells[Math.floor(nextMagmaRandom(runtime) * regionEntry.region.cells.length)];
    x = cell[1] * CELL.width + 8 + nextMagmaRandom(runtime) * (CELL.width - 16);
    y = cell[0] * CELL.height + 12 + nextMagmaRandom(runtime) * (CELL.height - 24);
  }
  const eruption = options.thermalState === "eruption" ? 1 : 0;
  const flowVector = runtime.currentFlowVector || { x: 0, y: 0 };
  particle.active = true;
  particle.x = x;
  particle.y = y;
  particle.vx = flowVector.x * (0.18 + nextMagmaRandom(runtime) * 0.12)
    + (nextMagmaRandom(runtime) - 0.5) * (22 + eruption * 24);
  particle.vy = flowVector.y * 0.16 - (24 + nextMagmaRandom(runtime) * (40 + eruption * 45));
  particle.gravity = 18 + nextMagmaRandom(runtime) * 26;
  particle.maxLife = 850 + nextMagmaRandom(runtime) * 1050;
  particle.life = particle.maxLife;
  particle.radius = 0.8 + nextMagmaRandom(runtime) * (1.6 + eruption);
  particle.temperature = 0.72 + nextMagmaRandom(runtime) * 0.28;
  particle.seed = Math.floor(nextMagmaRandom(runtime) * 9999);
  return true;
}

export function updateMagmaParticles(runtime, now, options) {
  if (!runtime?.particles?.length) return;
  if (runtime.lastParticleUpdateAt == null) runtime.lastParticleUpdateAt = now;
  const deltaMs = Math.max(0, Math.min(64, now - runtime.lastParticleUpdateAt));
  runtime.lastParticleUpdateAt = now;
  if (options.paused) return;
  const seconds = deltaMs / 1000;
  for (const particle of runtime.particles) {
    if (!particle.active) continue;
    particle.life -= deltaMs;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.vy += particle.gravity * seconds;
    particle.vx += Math.sin((particle.life + particle.seed) * 0.008) * seconds * 5;
    particle.temperature = Math.max(0, particle.life / particle.maxLife);
  }

  const qualityLimit = options.maxParticles[options.quality.quality] || options.maxParticles.high;
  const desired = Math.max(0, Math.round(Math.min(
    qualityLimit,
    options.particleLimit,
    options.activeParticles[options.thermalState],
  ) * options.quality.particleScale));
  const missing = desired - activeParticleCount(runtime);
  const spawnBudget = Math.min(missing, Math.max(1, Math.ceil(deltaMs / 10)));
  for (let index = 0; index < spawnBudget; index += 1) spawnParticle(runtime, options);
}

function particleColor(temperature) {
  if (temperature > 0.72) return "255,238,128";
  if (temperature > 0.4) return "255,128,24";
  return "221,52,10";
}

export function drawMagmaParticles(ctx, runtime, now, options) {
  if (!runtime?.particles?.length) return;
  updateMagmaParticles(runtime, now, options);
  const thermal = getMagmaThermalVisual(options.thermalState);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (const particle of runtime.particles) {
    if (!particle.active) continue;
    const life = Math.max(0, particle.life / particle.maxLife);
    const alpha = Math.min(1, life * 1.4) * thermal.emberFactor;
    const color = particleColor(particle.temperature);
    ctx.strokeStyle = `rgba(${color},${alpha * 0.45})`;
    ctx.lineWidth = Math.max(0.7, particle.radius * 0.7);
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(particle.x - particle.vx * 0.045, particle.y - particle.vy * 0.045);
    ctx.stroke();
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.55 + life * 0.45), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
