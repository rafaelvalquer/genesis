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
  const thermalState = regionEntry.thermalState || options.thermalState;
  const useVent = nextMagmaRandom(runtime) < (thermalState === "eruption" ? 0.68 : 0.34);
  const availableVents = [
    ...regionEntry.vents,
    ...(regionEntry.dynamic?.transientVents || []),
  ].slice(0, Math.max(1, options.ventLimit));
  const vent = availableVents[Math.floor(nextMagmaRandom(runtime) * availableVents.length)];
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
  const eruption = thermalState === "eruption" ? 1 : 0;
  const flowVector = runtime.currentFlowVector || { x: 0, y: 0 };
  const typeRoll = nextMagmaRandom(runtime);
  const type = typeRoll < 0.43
    ? "ember"
    : typeRoll < 0.7
      ? "lavaDrop"
      : typeRoll < 0.86
        ? "crustFragment"
        : "spark";
  particle.active = true;
  particle.type = type;
  particle.x = x;
  particle.y = y;
  particle.surfaceY = y;
  particle.hasSplashed = false;
  const lateral = (nextMagmaRandom(runtime) - 0.5) * (22 + eruption * 24);
  if (type === "spark") {
    particle.vx = flowVector.x * 0.08 + lateral * 1.8;
    particle.vy = -(78 + nextMagmaRandom(runtime) * 90);
    particle.gravity = 8 + nextMagmaRandom(runtime) * 12;
    particle.maxLife = 220 + nextMagmaRandom(runtime) * 360;
  } else if (type === "lavaDrop") {
    particle.vx = flowVector.x * 0.24 + lateral * 0.8;
    particle.vy = -(42 + nextMagmaRandom(runtime) * (50 + eruption * 28));
    particle.gravity = 82 + nextMagmaRandom(runtime) * 42;
    particle.maxLife = 800 + nextMagmaRandom(runtime) * 700;
  } else if (type === "crustFragment") {
    particle.vx = flowVector.x * 0.12 + lateral * 0.7;
    particle.vy = -(22 + nextMagmaRandom(runtime) * 36);
    particle.gravity = 74 + nextMagmaRandom(runtime) * 48;
    particle.maxLife = 580 + nextMagmaRandom(runtime) * 620;
  } else {
    particle.vx = flowVector.x * (0.18 + nextMagmaRandom(runtime) * 0.12) + lateral;
    particle.vy = flowVector.y * 0.16 - (24 + nextMagmaRandom(runtime) * (40 + eruption * 45));
    particle.gravity = 18 + nextMagmaRandom(runtime) * 26;
    particle.maxLife = 850 + nextMagmaRandom(runtime) * 1050;
  }
  particle.life = particle.maxLife;
  particle.radius = type === "spark"
    ? 0.45 + nextMagmaRandom(runtime) * 0.65
    : type === "crustFragment"
      ? 1.3 + nextMagmaRandom(runtime) * 1.8
      : 0.8 + nextMagmaRandom(runtime) * (1.6 + eruption);
  particle.temperature = 0.72 + nextMagmaRandom(runtime) * 0.28;
  particle.thermalState = thermalState;
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
    if (
      particle.type === "lavaDrop"
      && particle.vy > 0
      && particle.y >= particle.surfaceY
      && !particle.hasSplashed
    ) {
      particle.hasSplashed = true;
      runtime.splashes.push({
        x: particle.x,
        y: particle.surfaceY,
        life: 180 + nextMagmaRandom(runtime) * 120,
        maxLife: 300,
        radius: 3 + particle.radius * 2.5,
      });
      particle.active = false;
    }
  }

  for (let index = runtime.splashes.length - 1; index >= 0; index -= 1) {
    runtime.splashes[index].life -= deltaMs;
    if (runtime.splashes[index].life <= 0) runtime.splashes.splice(index, 1);
  }

  const qualityLimit = options.maxParticles[options.quality.quality] || options.maxParticles.high;
  const baselineDesired = Math.min(
    qualityLimit,
    options.particleLimit,
    options.activeParticles[options.thermalState],
  ) * options.quality.particleScale;
  const permanentRegionBonus = runtime.regions.filter((entry) => entry.thermalState === "eruption").length * 2;
  const desired = Math.max(0, Math.round(Math.min(qualityLimit, options.particleLimit, baselineDesired + permanentRegionBonus)));
  const missing = desired - activeParticleCount(runtime);
  const spawnBudget = Math.min(missing, Math.max(1, Math.ceil(deltaMs / 10)));
  for (let index = 0; index < spawnBudget; index += 1) spawnParticle(runtime, options);
}

function particleColor(temperature) {
  if (temperature > 0.72) return "255,238,128";
  if (temperature > 0.4) return "255,128,24";
  return "221,52,10";
}

function drawSplash(ctx, splash, thermalVisual) {
  const progress = 1 - Math.max(0, splash.life / splash.maxLife);
  const alpha = Math.sin(progress * Math.PI) * thermalVisual.splashFactor;
  ctx.strokeStyle = `rgba(255,134,25,${alpha * 0.72})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(
    splash.x,
    splash.y,
    splash.radius * (0.6 + progress * 1.5),
    splash.radius * (0.18 + progress * 0.32),
    0,
    0,
    TAU,
  );
  ctx.stroke();
}

export function drawMagmaParticles(ctx, runtime, now, options) {
  if (!runtime?.particles?.length) return;
  updateMagmaParticles(runtime, now, options);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  const ambientThermal = getMagmaThermalVisual(options.thermalState);
  for (const splash of runtime.splashes || []) drawSplash(ctx, splash, ambientThermal);
  for (const particle of runtime.particles) {
    if (!particle.active) continue;
    const particleThermal = getMagmaThermalVisual(particle.thermalState || options.thermalState);
    const life = Math.max(0, particle.life / particle.maxLife);
    const alpha = Math.min(1, life * 1.4) * particleThermal.emberFactor;
    const color = particleColor(particle.temperature);
    if (particle.type === "crustFragment") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(27,10,7,${Math.min(0.9, alpha + 0.28)})`;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate((particle.seed + particle.life) * 0.012);
      ctx.fillRect(-particle.radius, -particle.radius * 0.55, particle.radius * 2, particle.radius * 1.1);
      ctx.restore();
      ctx.globalCompositeOperation = "screen";
      continue;
    }
    ctx.strokeStyle = `rgba(${color},${alpha * 0.45})`;
    ctx.lineWidth = particle.type === "spark"
      ? Math.max(0.45, particle.radius * 0.55)
      : Math.max(0.7, particle.radius * 0.7);
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    const trail = particle.type === "spark" ? 0.075 : 0.045;
    ctx.lineTo(particle.x - particle.vx * trail, particle.y - particle.vy * trail);
    ctx.stroke();
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.55 + life * 0.45), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
