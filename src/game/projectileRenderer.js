import { createExecutorParticles, drawExecutorParticle } from "./executorArcoRenderer.js";
import {
  forEachProjectileTrailPoint,
  projectileTrailLength,
  projectileTrailPoint,
} from "./projectileTrail.js";
import { drawCachedRadialGlow } from "./effectTextureCache.js";

const QUALITY = {
  low: { density: 0.3, trail: 0.45, budget: 140 },
  medium: { density: 0.62, trail: 0.72, budget: 260 },
  high: { density: 1, trail: 1, budget: 440 },
};

const ADAPTIVE_PARTICLE_SCALE = { full: 1, busy: 0.82, stress: 0.55 };
const adaptiveProfiles = new Map();

function profile(settings = {}, essential = false) {
  const base = QUALITY[settings.quality] || QUALITY.high;
  const level = essential ? "full" : settings.adaptiveLevel || "full";
  const scale = ADAPTIVE_PARTICLE_SCALE[level] || 1;
  if (scale === 1) return base;
  const key = `${settings.quality || "high"}:${level}`;
  if (!adaptiveProfiles.has(key)) adaptiveProfiles.set(key, {
    density: base.density * scale,
    trail: base.trail * scale,
    budget: Math.round(base.budget * scale),
  });
  return adaptiveProfiles.get(key);
}

export function isEssentialParticleEvent(event = {}) {
  return event.type === "hit" || event.type === "troopHit" || event.type === "shieldHit"
    || event.type === "shieldBreak" || event.type === "glassEchoShatter" || event.type === "bossPhase" || event.type === "bossDeath"
    || event.type === "prismaticPulse" || event.type === "iceImpact" || event.type === "cryoImpact"
    || event.type === "cryoShock" || event.type === "thermalPlatformCooled"
    || event.type === "voltaicDischarge" || event.type === "bastiaoOverload"
    || event.type === "scarabTransitionStart" || event.type === "scarabTransitionComplete"
    || event.type === "capsuleLanded" || event.type === "capsuleOpened" || event.type === "fortuneOrbitalStrike"
    || (event.type === "repulsorImpact" && event.stunned);
}

export function trimParticleBudget(particles, budget) {
  let remaining = Math.max(0, particles.length - budget);
  if (!remaining) return particles;
  let write = 0;
  for (let read = 0; read < particles.length; read += 1) {
    const particle = particles[read];
    if (remaining > 0 && !particle.essential) {
      remaining -= 1;
      continue;
    }
    particles[write] = particle;
    write += 1;
  }
  particles.length = write;
  return particles;
}

function seeded(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function addSparks(particles, event, now, count, random, options = {}) {
  for (let index = 0; index < count; index += 1) {
    const angle = (options.forward ? (random() - 0.5) * 1.25 : random() * Math.PI * 2);
    const speed = (options.minSpeed || 28) + random() * (options.speed || 90);
    particles.push({
      kind: options.kind || "spark", x: event.x ?? event.x0 ?? 0, y: event.y ?? event.y0 ?? 0,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      gravity: options.gravity || 0, rotation: random() * Math.PI,
      color: options.color || event.color || "#67e8f9", born: now,
      life: (options.life || 310) * (0.78 + random() * 0.55),
      size: (options.size || 2) * (0.65 + random() * 0.8),
    });
  }
}

export function createFlameStreamParticles(event, now, settings = {}) {
  const quality = profile(settings);
  const random = seeded(event.seed || 1);
  const particles = [];
  const range = Math.max(24, (event.x1 || event.x0 + 120) - event.x0);
  const bodyCount = Math.max(4, Math.round(14 * quality.density));
  const emberCount = Math.max(4, Math.round(18 * quality.density));
  const ribbonCount = settings.quality === "low" ? 1 : 3;

  particles.push({
    kind: "flameJet", ...event,
    bodyWidth: 12 + quality.density * 10,
    waveAmp: settings.reduceMotion ? 0 : 3 + quality.density * 4,
    wavePhase: random() * Math.PI * 2,
    born: now, life: 230,
    color: event.color || "#f97316",
  });

  for (let index = 0; index < bodyCount; index += 1) {
    const along = 0.06 + random() * 0.9;
    const life = 190 + random() * 120;
    const waveAmp = settings.reduceMotion ? 0 : 2.5 + random() * 4;
    const base = {
      kind: "flame", x: event.x0 + range * along, y: event.y0 + (random() - 0.5) * (5 + along * 13),
      driftX: range * (0.025 + random() * 0.045), driftY: (random() - 0.5) * 10,
      waveAmp, waveFreq: 8 + random() * 6, wavePhase: random() * Math.PI * 2,
      size: 5 + along * (10 + random() * 9), born: now, life, color: event.color || "#f97316",
      inner: "255,248,185", outer: `255,${120 + Math.round(random() * 45)},${32 + Math.round(random() * 30)}`,
      soft: false,
    };
    particles.push(base);
    if (random() < 0.6 && settings.quality !== "low") {
      particles.push({
        ...base, x: base.x + random() * 4, y: base.y + (random() - 0.5) * 5,
        driftX: base.driftX * 0.65, size: base.size * (1.25 + random() * 0.25),
        life: life + 45, inner: "255,190,90", outer: "255,82,28", soft: true,
      });
    }
  }

  addSparks(particles, { ...event, x: event.x0, y: event.y0 }, now, emberCount, random, {
    forward: true, color: "#ffd27a", minSpeed: 180, speed: 270, life: 360, size: 1.35,
  });

  for (let index = 0; index < ribbonCount; index += 1) {
    particles.push({
      kind: "flameRibbon", x0: event.x0 + 5, y0: event.y0 + (random() - 0.5) * 3,
      x1: event.x0 + range * (0.48 + random() * 0.38), y1: event.y0 + (random() - 0.5) * 8,
      waveAmp: settings.reduceMotion ? 0 : 2 + random() * 4,
      wavePhase: random() * Math.PI * 2,
      width: 2.2 + random() * 2.8, born: now, life: 180 + random() * 70,
      color: random() < 0.5 ? "#fff0a3" : "#ffb15c",
    });
  }

  if (settings.quality !== "low") {
    const smokeCount = settings.quality === "high" ? 2 : 1;
    for (let index = 0; index < smokeCount; index += 1) {
      particles.push({
        kind: "smoke", x: event.x1 - random() * 26, y: event.y1 + (random() - 0.5) * 13,
        vx: 12 + random() * 22, vy: -13 - random() * 17, color: "#766c69",
        born: now, life: 420 + random() * 140, size: 6 + random() * 7,
      });
    }
  }
  return particles;
}

export function createIceTrailParticles(event, now, settings = {}) {
  const quality = profile(settings);
  const random = seeded(event.seed || 1);
  const longLived = event.variant === "long";
  const muzzle = event.variant === "muzzle";
  const baseCount = muzzle ? 8 : longLived ? 1 : 2 + Math.floor(random() * 2);
  const count = Math.max(1, Math.round(baseCount * quality.density));
  return Array.from({ length: count }, () => ({
    kind: "snow",
    x: event.x + (random() * 6 - 3),
    y: event.y + (random() * 6 - 3),
    vx: muzzle ? random() * 18 - 9 : longLived ? random() * 18 - 9 : random() * 10 - 5,
    vy: muzzle ? random() * 14 - 5 : longLived ? 24 + random() * 30 : 5 + random() * 12,
    gravity: muzzle ? 16 : longLived ? 10 + random() * 16 : 22 + random() * 18,
    sway: settings.reduceMotion ? 0 : longLived ? 1.5 + random() * 3.2 : 0.8 + random() * 2.2,
    phase: random() * Math.PI * 2,
    phaseSpeed: 5 + random() * 4,
    color: "rgba(255,255,255,0.95)",
    born: now,
    life: muzzle ? 650 + random() * 260 : longLived ? 2400 + random() * 1600 : 900 + random() * 480,
    size: longLived ? 1.5 + random() * 1.5 : 1 + random() * 1.5,
  }));
}

export function createFireTrailParticles(event, now, settings = {}) {
  const quality = profile(settings);
  const random = seeded(event.seed || 1);
  if (event.variant === "smoke") {
    if (settings.quality === "low") return [];
    return [{
      kind: "smoke", x: event.x - 3, y: event.y + (random() - 0.5) * 3,
      vx: -12 - random() * 10, vy: -8 - random() * 9,
      color: "#6b625f", born: now, life: 260 + random() * 120,
      size: 2.5 + random() * 2.5,
    }];
  }
  const count = Math.max(1, Math.round(3 * quality.density));
  return Array.from({ length: count }, () => ({
    kind: "spark", x: event.x - 3 - random() * 4, y: event.y + (random() - 0.5) * 5,
    vx: -22 - random() * 36, vy: (random() - 0.5) * 24,
    gravity: 20, rotation: random() * Math.PI,
    color: random() < 0.45 ? "#fff1a8" : "#fb923c",
    born: now, life: 150 + random() * 120, size: 0.8 + random() * 1.3,
  }));
}

export function pushEventParticles(particles, events, now, settings = {}) {
  if (settings.floatingDamage !== false) {
    for (const event of events) {
      if (event.type === "hit" && event.amount) {
        const isCrit = event.damageTakenFactor > 1;
        particles.push({
          kind: "floatingText",
          text: isCrit ? `⚡-${event.amount}` : `-${event.amount}`,
          x: event.x + (Math.random() * 16 - 8),
          y: event.y - 18,
          vx: (Math.random() - 0.5) * 16,
          vy: isCrit ? -54 : -46,
          color: isCrit ? "#ff2a5f" : "#ffe600",
          glowColor: isCrit ? "#ff0055" : "#f59e0b",
          fontSize: isCrit ? 25 : 19,
          born: now,
          life: isCrit ? 850 : 750,
          essential: true,
        });
      } else if (event.type === "shieldHit" && event.absorbed) {
        particles.push({
          kind: "floatingText",
          text: `🛡-${event.absorbed}`,
          x: event.x + (Math.random() * 12 - 6),
          y: event.y - 20,
          vx: 0,
          vy: -42,
          color: "#e0aaff",
          glowColor: "#9333ea",
          fontSize: 18,
          born: now,
          life: 750,
          essential: true,
        });
      } else if (event.type === "glassEchoShatter") {
        particles.push({
          kind: "floatingText",
          text: "💥 REFRATADO",
          x: event.x,
          y: event.y - 22,
          vx: 0,
          vy: -50,
          color: "#5eead4",
          glowColor: "#0d9488",
          fontSize: 21,
          born: now,
          life: 800,
          essential: true,
        });
      }
    }
  }
  for (const event of events) {
    const essential = isEssentialParticleEvent(event);
    const quality = profile(settings, essential);
    const particleStart = particles.length;
    try {
    const random = seeded(event.seed || 1);
    const color = event.color || (event.type.includes("Death") ? "#fb7185" : "#67e8f9");
    if (["capsuleIncoming", "capsuleLanded", "capsuleOpening", "capsuleOpened", "fortuneReconstruction"].includes(event.type)) {
      const landed = event.type === "capsuleLanded";
      const opened = event.type === "capsuleOpened";
      particles.push({ kind: "ring", x: event.x, y: event.y, color: landed ? "#fbbf24" : "#22d3ee", born: now, life: opened ? 700 : 480, maxRadius: opened ? 110 : landed ? 72 : 42, essential: landed || opened });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#fff7d6", born: now, life: opened ? 360 : 190, size: opened ? 48 : 24, essential: opened });
      addSparks(particles, event, now, settings.reduceMotion ? 5 : Math.max(10, Math.round((opened ? 34 : 22) * quality.density)), random, {
        color: "#fbbf24", minSpeed: 28, speed: opened ? 155 : 105, gravity: landed ? 150 : 30, life: 560, size: 2.3,
      });
      continue;
    }
    if (event.type === "fortuneOrbitalStrike") {
      for (let index = 0; index < 8; index += 1) {
        const x = 100 + index * 125;
        const y = event.row * 120 + 60;
        particles.push({ kind: "muzzle", x, y, color: index % 2 ? "#fbbf24" : "#67e8f9", born: now + index * 22, life: 420, size: 34, essential: true });
        particles.push({ kind: "ring", x, y, color: "#fbbf24", born: now + index * 22, life: 520, maxRadius: 56, essential: true });
      }
      continue;
    }
    const executorParticles = createExecutorParticles(event, now, settings);
    if (executorParticles) {
      particles.push(...executorParticles);
      continue;
    }
    if (event.type === "leviathanChargeStarted") {
      particles.push({
        kind: "ring", x: event.x, y: event.y - 34, color,
        born: now, life: 1500, maxRadius: 52, essential: true,
      });
      addSparks(particles, event, now, settings.reduceMotion ? 4 : 12, random, {
        color, minSpeed: 18, speed: 70, gravity: 0, life: 900, size: 1.8,
      });
      continue;
    }
    if (event.type === "leviathanFire") {
      particles.push({
        kind: "muzzle", x: event.x, y: event.y, color: "#ffffff",
        born: now, life: 260, size: 52, essential: true,
      });
      particles.push({
        kind: "ring", x: event.x, y: event.y, color,
        born: now, life: 420, maxRadius: 74, essential: true,
      });
      addSparks(particles, event, now, settings.reduceMotion ? 6 : 20, random, {
        color, minSpeed: 55, speed: 180, gravity: 35, life: 520, size: 2.2,
      });
      continue;
    }
    if (["leviathanImpact", "leviathanSecondImpact", "structuralRuptureApplied"].includes(event.type)) {
      const ruptured = event.type === "structuralRuptureApplied";
      particles.push({
        kind: "ring", x: event.x, y: event.y, color,
        born: now, life: ruptured ? 760 : 440, maxRadius: ruptured ? 84 : 46,
        essential: ruptured,
      });
      addSparks(particles, event, now, settings.reduceMotion ? 5 : ruptured ? 24 : 14, random, {
        color: ruptured ? "#e0f2fe" : color,
        minSpeed: 35, speed: ruptured ? 155 : 105, gravity: 60, life: 620, size: 2,
      });
      continue;
    }

    if (event.type === "repulsorImpact") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#22d3ee", born: now, life: 360, maxRadius: 58 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#ecfeff", born: now, life: 170, size: 25 });
      addSparks(particles, event, now, Math.max(6, Math.round(18 * quality.density)), random, {
        color: event.stunned ? "#a5f3fc" : "#67e8f9",
        minSpeed: 42, speed: 125, life: 420, size: 2,
      });
      if (!settings.reduceMotion && event.pushedToX > event.pushedFromX) {
        particles.push({
          kind: "repulsorWake", x0: event.pushedFromX, x1: event.pushedToX,
          y: event.y, color: "#67e8f9", born: now, life: 300,
        });
      }
      continue;
    }

    if (event.type === "tileImpact") {
      const special = event.mode === "special";
      particles.push({ kind: "ring", x: event.x, y: event.y, color: special ? "#fbbf24" : color, born: now, life: special ? 540 : 360, maxRadius: special ? 104 : 64 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: special ? "#fff7d6" : "#d1fae5", born: now, life: special ? 220 : 150, size: special ? 38 : 24 });
      addSparks(particles, event, now, Math.max(8, Math.round((special ? 28 : 16) * quality.density)), random, {
        color: special ? "#fbbf24" : "#a7f3d0", minSpeed: special ? 55 : 34, speed: special ? 155 : 98,
        gravity: 180, life: special ? 560 : 390, size: special ? 2.8 : 2.1,
      });
      continue;
    }

    if (event.type === "prismaticPulse") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#a78bfa", born: now, life: 760, maxRadius: 145 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#ecfeff", born: now, life: 300, size: 34 });
      addSparks(particles, event, now, Math.max(12, Math.round(30 * quality.density)), random, {
        color: "#7fffd4", minSpeed: 35, speed: 130, life: 620, size: 2.2,
      });
      continue;
    }

    if (event.type === "bastiaoOverload") {
      const delayMs = Math.max(0, Number(event.delayMs) || 0);
      const born = now + delayMs;
      const durationMs = Math.max(180, Number(event.durationMs) || 420);
      const originX = Number(event.x) || 0;
      const originY = Number(event.y) || 0;
      const centerX = Number(event.centerX ?? event.x) || 0;
      const centerY = Number(event.centerY ?? event.y) || 0;
      const radius = Math.max(44, Number(event.radiusX) || 100);
      const effectColor = event.color || "#22d3ee";
      const coreColor = event.coreColor || "#ecfeff";

      particles.push({
        kind: "ring", x: centerX, y: centerY, color: effectColor,
        born, life: durationMs, maxRadius: radius, essential: true,
      });
      particles.push({
        kind: "muzzle", x: originX, y: originY, color: coreColor,
        born, life: Math.min(220, durationMs), size: settings.quality === "low" ? 24 : 34,
        essential: true,
      });

      const localArcCount = settings.reduceMotion
        ? 2
        : settings.quality === "low" ? 3 : settings.quality === "medium" ? 5 : 8;
      for (let index = 0; index < localArcCount; index += 1) {
        const angle = random() * Math.PI * 2;
        const nextAngle = angle + (0.35 + random() * 0.75) * (random() < 0.5 ? -1 : 1);
        const innerRadius = 18 + random() * 18;
        const outerRadius = 32 + random() * 32;
        particles.push({
          kind: "voltaicArc",
          x0: originX + Math.cos(angle) * innerRadius,
          y0: originY + Math.sin(angle) * innerRadius * 0.72,
          x1: originX + Math.cos(nextAngle) * outerRadius,
          y1: originY + Math.sin(nextAngle) * outerRadius * 0.72,
          color: effectColor,
          seed: (event.seed || 1) + index + 1,
          width: settings.quality === "low" ? 2.4 : 3.2,
          born,
          life: settings.reduceMotion ? 150 : 210,
          primary: false,
          essential: index < 2,
        });
      }

      addSparks(particles, { ...event, x: originX, y: originY }, born,
        settings.reduceMotion ? 4 : Math.max(7, Math.round(16 * quality.density)), random, {
          color: "#a5f3fc", minSpeed: 20, speed: 100, life: 380, size: 1.8,
        });

      (event.targets || []).forEach((target, index) => {
        const targetBorn = born + (settings.reduceMotion ? 0 : 28);
        particles.push({
          kind: "voltaicArc",
          x0: originX, y0: originY,
          x1: target.x, y1: target.y,
          color: effectColor,
          seed: (event.seed || 1) + 100 + index,
          width: settings.quality === "low" ? 3 : 4,
          born: targetBorn,
          life: settings.reduceMotion ? 140 : 190,
          primary: false,
          essential: true,
        });
        particles.push({
          kind: "ring", x: target.x, y: target.y,
          color: target.boss ? "#bae6fd" : effectColor,
          born: targetBorn, life: 230,
          maxRadius: target.boss ? 24 : 30, essential: true,
        });
        addSparks(particles, { ...event, x: target.x, y: target.y }, targetBorn,
          settings.reduceMotion ? 2 : Math.max(3, Math.round(7 * quality.density)), random, {
            color: coreColor, minSpeed: 14, speed: 66, life: 280, size: 1.4,
          });
      });
      continue;
    }

    if (event.type === "voltaicDischarge") {
      const primaryLife = settings.reduceMotion ? 150 : 190;
      particles.push({
        kind: "voltaicArc",
        x0: event.x0, y0: event.y0, x1: event.x1, y1: event.y1,
        color: event.color || "#22d3ee", seed: event.seed,
        width: 7, born: now, life: primaryLife, primary: true, essential: true,
      });
      particles.push({
        kind: "muzzle", x: event.x0, y: event.y0,
        color: "#cffafe", born: now, life: 150, size: 18, essential: true,
      });
      particles.push({
        kind: "ring", x: event.x1, y: event.y1,
        color: event.color || "#22d3ee", born: now, life: 260,
        maxRadius: event.primaryInWater ? 42 : 28, essential: true,
      });
      addSparks(particles, { ...event, x: event.x1, y: event.y1 }, now,
        settings.reduceMotion ? 5 : Math.max(9, Math.round(18 * quality.density)), random, {
          color: "#a5f3fc", minSpeed: 22, speed: 98, life: 360, size: 1.8,
        });
      (event.chains || []).forEach((chain, index) => {
        particles.push({
          kind: "voltaicArc",
          x0: chain.x0, y0: chain.y0, x1: chain.x1, y1: chain.y1,
          color: event.color || "#22d3ee", seed: chain.seed || event.seed + index + 1,
          width: 4.2, born: now + (settings.reduceMotion ? 0 : 40),
          life: settings.reduceMotion ? 130 : 160, primary: false, essential: true,
        });
        particles.push({
          kind: "ring", x: chain.x1, y: chain.y1,
          color: chain.inWater ? "#67e8f9" : event.color || "#22d3ee",
          born: now + (settings.reduceMotion ? 0 : 40), life: 220,
          maxRadius: chain.inWater ? 34 : 20, essential: true,
        });
        addSparks(particles, { ...event, x: chain.x1, y: chain.y1 }, now,
          settings.reduceMotion ? 3 : Math.max(5, Math.round(10 * quality.density)), random, {
            color: chain.inWater ? "#ecfeff" : "#67e8f9",
            minSpeed: 16, speed: 72, life: 300, size: 1.5,
          });
      });
      continue;
    }

    if (event.type === "electricCharge") {
      particles.push({
        kind: "ring", x: event.x, y: event.y, color: event.paralyzed ? "#f0f9ff" : "#22d3ee",
        born: now, life: event.paralyzed ? 520 : 280, maxRadius: event.paralyzed ? 52 : 26,
        essential: event.paralyzed,
      });
      addSparks(particles, event, now, Math.max(6, Math.round((event.paralyzed ? 24 : 12) * quality.density)), random, {
        color: event.paralyzed ? "#ffffff" : "#67e8f9",
        minSpeed: 24, speed: event.paralyzed ? 135 : 76, life: 440, size: 1.9,
      });
      continue;
    }

    if (event.type === "stormShieldPulse") {
      particles.push({
        kind: "ring", x: event.x, y: event.y, color: "#22d3ee",
        born: now, life: 720, maxRadius: 118,
      });
      addSparks(particles, event, now, Math.max(10, Math.round(24 * quality.density)), random, {
        color: "#a5f3fc", minSpeed: 30, speed: 112, life: 560, size: 2,
      });
      continue;
    }

    if (event.type === "gorjalChargeImpact") {
      particles.push({
        kind: "ring", x: event.x, y: event.y + 22, color: event.pushed ? "#22d3ee" : "#f59e0b",
        born: now, life: 520, maxRadius: event.pushed ? 86 : 66,
      });
      addSparks(particles, { ...event, y: event.y + 26 }, now, Math.max(12, Math.round(30 * quality.density)), random, {
        color: event.pushed ? "#67e8f9" : "#fbbf24",
        minSpeed: 38, speed: 150, gravity: 190, life: 560, size: 2.8,
      });
      continue;
    }

    if (event.type === "groundingBeam") {
      particles.push({ kind: "laser", ...event, color, born: now, life: 210 });
      particles.push({ kind: "ring", x: event.x1, y: event.y1, color, born: now, life: 320, maxRadius: 34 });
      addSparks(particles, event, now, Math.max(8, Math.round(20 * quality.density)), random, {
        color: "#67e8f9", minSpeed: 28, speed: 110, life: 420, size: 2,
      });
      continue;
    }

    if (event.type === "shieldHit" || event.type === "shieldBreak" || event.type === "glassEchoShatter") {
      particles.push({
        kind: "ring", x: event.x, y: event.y, color,
        born: now, life: event.type === "glassEchoShatter" ? 340 : event.type === "shieldBreak" ? 360 : 190,
        maxRadius: event.type === "glassEchoShatter" ? 58 : event.type === "shieldBreak" ? 48 : 24,
      });
      addSparks(particles, event, now, Math.max(3, Math.round((event.type === "shieldBreak" ? 16 : 6) * quality.density)), random, {
        color: event.type === "glassEchoShatter" ? "#f0fdff" : event.type === "shieldBreak" ? "#e9d5ff" : "#7fffd4",
        minSpeed: 24, speed: event.type === "glassEchoShatter" ? 135 : event.type === "shieldBreak" ? 115 : 65, life: 360, size: 1.8,
      });
      continue;
    }

    if (event.type === "echoSpawn") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#7fffd4", born: now, life: 520, maxRadius: 48 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#e9d5ff", born: now, life: 220, size: 22 });
      addSparks(particles, event, now, Math.max(8, Math.round(22 * quality.density)), random, {
        color: "#c4b5fd", minSpeed: 38, speed: 125, life: 480, size: 2.4,
      });
      continue;
    }

    if (event.type === "duneRipperRoar") {
      const mouth = { ...event, x: event.x - 34, y: event.y - 30 };
      particles.push({
        kind: "ring", x: mouth.x, y: mouth.y, color: "#22d3ee",
        born: now, life: 680, maxRadius: settings.reduceMotion ? 54 : 118,
      });
      particles.push({
        kind: "muzzle", x: mouth.x, y: mouth.y, color: "#cffafe",
        born: now, life: 260, size: 28,
      });
      addSparks(particles, mouth, now, settings.reduceMotion ? 3 : Math.max(8, Math.round(18 * quality.density)), random, {
        color: "#67e8f9", minSpeed: 24, speed: 96, life: 520, size: 2.1,
      });
      for (let index = 0; index < event.summonCount; index += 1) {
        const crackX = event.spawnX - index * 18;
        const crackY = event.spawnY + 38;
        particles.push({
          kind: "ring", x: crackX, y: crackY, color: "#d6a65f",
          born: now, life: 520, maxRadius: settings.reduceMotion ? 13 : 22,
        });
        addSparks(particles, {
          ...event, x: crackX, y: crackY, color: "#d6a65f",
        }, now, settings.reduceMotion ? 2 : Math.max(5, Math.round(10 * quality.density)), random, {
          color: "#d6a65f", minSpeed: 18, speed: 72, gravity: 170, life: 540, size: 2.5,
        });
      }
      continue;
    }

    if (event.type === "workerQueenGuardSummoned") {
      particles.push({
        kind: "ring", x: event.x, y: event.y + 24, color: "#f59e0b",
        born: now, life: 480, maxRadius: settings.reduceMotion ? 32 : 64,
      });
      (event.summonXs || []).forEach((x) => {
        const origin = { ...event, x, y: event.y + 30, color: "#d6a65f" };
        particles.push({
          kind: "ring", x, y: origin.y, color: "#d6a65f",
          born: now, life: 420, maxRadius: settings.reduceMotion ? 11 : 19,
        });
        addSparks(particles, origin, now, settings.reduceMotion ? 2 : Math.max(4, Math.round(8 * quality.density)), random, {
          color: "#d6a65f", minSpeed: 14, speed: 58, gravity: 150, life: 460, size: 2.3,
        });
      });
      continue;
    }

    if (event.type === "workerQueenEggDeposited" || event.type === "workerQueenEggHatched") {
      const hatched = event.type === "workerQueenEggHatched";
      particles.push({
        kind: "ring", x: event.x, y: event.y + 24,
        color: hatched ? "#22d3ee" : "#f59e0b",
        born: now, life: hatched ? 560 : 360, maxRadius: hatched ? 42 : 24,
      });
      addSparks(particles, event, now, settings.reduceMotion ? 3 : Math.max(7, Math.round((hatched ? 18 : 10) * quality.density)), random, {
        color: hatched ? "#67e8f9" : "#fbbf24",
        minSpeed: 18, speed: hatched ? 105 : 62, gravity: 120,
        life: hatched ? 620 : 420, size: 2.2,
      });
      continue;
    }

    if (event.type === "inhibitorWebImpact") {
      particles.push({
        kind: "ring", x: event.x, y: event.y,
        color: "#f5e7c6", born: now, life: 360, maxRadius: 34,
      });
      addSparks(particles, event, now, settings.reduceMotion ? 4 : Math.max(10, Math.round(22 * quality.density)), random, {
        color: "#f5e7c6", minSpeed: 12, speed: 58, gravity: 35, life: 560, size: 2,
      });
      continue;
    }

    if (event.type === "abyssCharge") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color, born: now, life: 520, maxRadius: 30 });
      addSparks(particles, event, now, Math.max(4, Math.round(10 * quality.density)), random, {
        color: "#d8b4fe", minSpeed: 18, speed: 52, life: 480, size: 1.6,
      });
      continue;
    }

    if (event.type === "ramChargePrep" || event.type === "ramChargeStarted") {
      const started = event.type === "ramChargeStarted";
      particles.push({
        kind: "ring", x: event.x - 20, y: event.y + 30,
        color: started ? "#fb923c" : "#d6a65f", born: now,
        life: started ? 280 : 520, maxRadius: started ? 48 : 32,
      });
      addSparks(particles, { ...event, y: event.y + 34 }, now, Math.max(6, Math.round((started ? 18 : 11) * quality.density)), random, {
        color: started ? "#fbbf24" : "#c79a5b",
        minSpeed: 18, speed: started ? 105 : 58, gravity: 150,
        life: started ? 420 : 560, size: started ? 2.6 : 2.1,
      });
      continue;
    }

    if (event.type === "ramImpact" || event.type === "ramChargeMissed") {
      const impact = event.type === "ramImpact";
      particles.push({
        kind: "ring", x: event.x, y: event.y + 18,
        color: impact ? "#f59e0b" : "#b88952", born: now,
        life: impact ? 460 : 300, maxRadius: impact ? 76 : 42,
      });
      addSparks(particles, { ...event, y: event.y + 26 }, now, Math.max(8, Math.round((impact ? 30 : 14) * quality.density)), random, {
        color: random() < 0.35 ? "#fed7aa" : "#c98b4b",
        minSpeed: 35, speed: impact ? 155 : 85, gravity: 210,
        life: impact ? 560 : 390, size: impact ? 3 : 2.2,
      });
      if (impact && settings.quality !== "low") particles.push({
        kind: "smoke", x: event.x, y: event.y + 24, vx: -12, vy: -20,
        color: "#9a6a45", born: now, life: 520, size: 15,
      });
      continue;
    }

    if (event.type === "beam") {
      particles.push({ kind: "laser", ...event, color, born: now, life: 155 });
      particles.push({ kind: "ring", x: event.x1, y: event.y1, color, born: now, life: 220, maxRadius: 22 });
      continue;
    }
    if (event.type === "energyGenerated") {
      particles.push({ kind: "ring", x: event.x, y: event.y - 8, color, born: now, life: 520, maxRadius: event.reason === "wave" ? 82 : 48 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y - 24, color: "#ecfeff", born: now, life: 240, size: event.reason === "wave" ? 30 : 18 });
      addSparks(particles, event, now, Math.max(5, Math.round((event.reason === "wave" ? 18 : 10) * quality.density)), random, {
        color, minSpeed: 24, speed: 90, life: 420, size: 1.8,
      });
      continue;
    }
    if (event.type === "energyCollected") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#fbbf24", born: now, life: 420, maxRadius: 54 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#fff7ae", born: now, life: 220, size: 26 });
      addSparks(particles, event, now, Math.max(8, Math.round(18 * quality.density)), random, {
        color: "#facc15", minSpeed: 32, speed: 112, life: 440, size: 2.2,
      });
      continue;
    }
    if (event.type === "naniteHealPulse") {
      const count = settings.reduceMotion ? 1 : Math.max(3, Math.round(7 * quality.density));
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#34d399", born: now, life: 260, maxRadius: 24 });
      addSparks(particles, event, now, count, random, {
        color: "#6ee7b7", minSpeed: 12, speed: 42, life: 300, size: 1.5,
      });
      continue;
    }
    if (event.type === "veuSalinoHealPulse") {
      const membraneScale = event.flooded ? 1.2 : 1;
      particles.push({ kind: "veuSalinoHealCore", x: event.x, y: event.y + 6, born: now, life: 550, flooded: event.flooded });
      particles.push({ kind: "veuSalinoHealMembrane", x: event.x, y: event.y + 12, born: now + 330, life: 220, scale: membraneScale, flooded: event.flooded });
      for (const target of event.targets || []) {
        const curveOffset = 18 + Math.abs(target.x - event.x) * 0.08;
        particles.push({ kind: "veuSalinoHealLink", x0: event.x, y0: event.y + 22, x1: target.x, y1: target.y, curveOffset,
          born: now, life: settings.reduceMotion ? 180 : 240, flooded: event.flooded, seed: event.seed + curveOffset });
        particles.push({ kind: "veuSalinoHealImpact", x: target.x, y: target.y, born: now + 120, life: 420, flooded: event.flooded });
        particles.push({ kind: "floatingText", x: target.x, y: target.y - 12, born: now + 130, life: 700,
          text: `+${Math.round(target.healedAmount)}`, color: "#a5f3fc", glowColor: "#67e8f9", fontSize: 15 });
      }
      continue;
    }
    if (event.type === "veuSalinoProjectile") {
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#f0abfc", born: now, life: 180, size: 18 });
      continue;
    }
    if (event.type === "veuSalinoAttackSpeedDebuff") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#c084fc", born: now, life: 440, maxRadius: 30 });
      particles.push({ kind: "veuSalinoDebuff", x: event.x, y: event.y, born: now, life: event.durationMs || 4000, color: "#e879f9", seed: event.seed || 1 });
      addSparks(particles, event, now, settings.reduceMotion ? 3 : Math.max(7, Math.round(14 * quality.density)), random, {
        color: "#e9d5ff", minSpeed: 8, speed: 38, life: 460, size: 1.7,
      });
      continue;
    }
    if (event.type === "veuSalinoRetreat") {
      addSparks(particles, { ...event, y: event.y + 20 }, now, settings.reduceMotion ? 2 : Math.max(5, Math.round(10 * quality.density)), random, {
        color: "#67e8f9", minSpeed: 10, speed: 34, life: 340, size: 1.5,
      });
      continue;
    }
    if (event.type === "shotgun") {
      particles.push({ kind: "shotgun", ...event, color, born: now, life: 170 });
      particles.push({ kind: "muzzle", x: event.x0, y: event.y0, color: "#fff7d6", born: now, life: 95, size: 18 });
      addSparks(particles, { ...event, x: event.x0, y: event.y0 }, now, Math.max(2, Math.round(7 * quality.density)), random, { forward: true, color: "#ffd7a3", speed: 115 });
      continue;
    }
    if (event.type === "flame") {
      particles.push(...createFlameStreamParticles({ ...event, color }, now, settings));
      continue;
    }
    if (event.type === "iceTrail") {
      particles.push(...createIceTrailParticles(event, now, settings));
      continue;
    }
    if (event.type === "cryoShock") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#67e8f9", born: now, life: 520, maxRadius: event.fireTarget ? 42 : 32 });
      addSparks(particles, event, now, settings.reduceMotion ? 4 : Math.max(8, Math.round(16 * quality.density)), random, {
        kind: "snow", color: "#dffcff", minSpeed: 22, speed: 78, life: 520, size: 2.2,
      });
      continue;
    }
    if (event.type === "thermalPlatformCooled") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#67e8f9", born: now, life: 520, maxRadius: 34 });
      addSparks(particles, event, now, settings.reduceMotion ? 2 : 5, random, {
        color: "#dffcff", minSpeed: 12, speed: 42, life: 360, size: 1.5,
      });
      continue;
    }
    if (event.type === "fireTrail") {
      particles.push(...createFireTrailParticles(event, now, settings));
      continue;
    }
    if (event.type === "shoot") {
      const icaro = ["icaroBullet", "icaroInterceptionShot"].includes(event.weapon);
      const flashColor = icaro ? "#67e8f9" : event.weapon === "cryoJet" ? "#dffcff" : event.weapon === "naniteBullet" ? "#ccfbf1" : event.weapon === "ice" ? "#d9fbff" : event.weapon === "abyssOrb" ? "#ead7ff" : event.weapon === "prismBolt" ? "#fff1b8" : ["microMissile", "fireball"].includes(event.weapon) ? "#ffcf8a" : "#fff7d6";
      const flashSize = event.weapon === "icaroInterceptionShot" ? 12 : event.weapon === "icaroBullet" ? 9 : event.weapon === "sniperBullet" ? 22 : event.weapon === "cryoJet" ? 20 : ["abyssOrb", "prismBolt"].includes(event.weapon) ? 24 : event.weapon === "fireball" ? 12 : 15;
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: flashColor, born: now, life: event.weapon === "sniperBullet" ? 125 : 90, size: flashSize });
      if (["marineBullet", "sniperBullet"].includes(event.weapon)) {
        addSparks(particles, event, now, Math.max(2, Math.round(5 * quality.density)), random, { forward: true, color: event.color, speed: 100, life: 190, size: 1.4 });
        particles.push({ kind: "casing", x: event.x - 6, y: event.y + 2, vx: -22 - random() * 20, vy: -55 - random() * 25, gravity: 145, rotation: random() * Math.PI, color: "#fbbf24", born: now, life: 420, size: 3 });
      } else if (icaro) {
        addSparks(particles, event, now, Math.max(2, Math.round(5 * quality.density)), random, {
          forward: true, color: "#22d3ee", minSpeed: 30, speed: 95, life: 210, size: 1.4,
        });
      } else if (event.weapon === "ice") {
        particles.push(...createIceTrailParticles({ ...event, variant: "muzzle" }, now, settings));
      } else if (event.weapon === "cryoJet") {
        particles.push(...createIceTrailParticles({ ...event, variant: "muzzle" }, now, settings));
        addSparks(particles, event, now, settings.reduceMotion ? 2 : Math.max(5, Math.round(10 * quality.density)), random, {
          forward: true, color: "#a5f3fc", minSpeed: 35, speed: 110, life: 300, size: 1.7,
        });
      } else if (event.weapon === "microMissile") {
        particles.push({ kind: "smoke", x: event.x - 4, y: event.y, vx: -18, vy: 0, color: "#94a3b8", born: now, life: 360, size: 8 });
      } else if (event.weapon === "fireball") {
        addSparks(particles, event, now, Math.max(2, Math.round(4 * quality.density)), random, {
          forward: true, color: "#ffd27a", minSpeed: 35, speed: 70, life: 180, size: 1.1,
        });
      } else if (event.weapon === "abyssOrb") {
        addSparks(particles, event, now, Math.max(3, Math.round(7 * quality.density)), random, {
          color: "#d8b4fe", minSpeed: 22, speed: 64, life: 260, size: 1.5,
        });
      } else if (event.weapon === "prismBolt") {
        addSparks(particles, event, now, Math.max(3, Math.round(8 * quality.density)), random, {
          color: "#7fffd4", minSpeed: 28, speed: 78, life: 260, size: 1.7,
        });
      } else if (event.weapon === "naniteBullet") {
        addSparks(particles, event, now, settings.reduceMotion ? 1 : Math.max(2, Math.round(4 * quality.density)), random, {
          forward: true, color: "#5eead4", minSpeed: 24, speed: 54, life: 180, size: 1.2,
        });
      }
      continue;
    }
    if (event.type === "icaroTargetLock") {
      particles.push({
        kind: "ring", x: event.x, y: event.y - 34, color: "#22d3ee",
        born: now, life: 800, maxRadius: 42,
      });
      for (const lock of event.locks || []) {
        particles.push({
          kind: "ring", x: lock.x, y: lock.y, color: "#f59e0b",
          born: now, life: 800, maxRadius: 30,
        });
      }
      continue;
    }
    if (event.type === "icaroBulletImpact" || event.type === "icaroInterceptionImpact") {
      const special = event.type === "icaroInterceptionImpact";
      particles.push({
        kind: "ring", x: event.x, y: event.y, color: special ? "#f59e0b" : "#22d3ee",
        born: now, life: special ? 330 : 220, maxRadius: special ? 38 : 22,
      });
      addSparks(particles, event, now, Math.max(3, Math.round((special ? 12 : 6) * quality.density)), random, {
        color: special ? "#fb923c" : "#67e8f9",
        minSpeed: 28, speed: special ? 110 : 72, life: 300, size: special ? 2 : 1.4,
      });
      continue;
    }

    if (event.type === "iceImpact") {
      addSparks(particles, event, now, Math.max(5, Math.round(16 * quality.density)), random, { kind: "snow", color: "#d8fbff", minSpeed: 24, speed: 85, life: 480, size: 2.8 });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#67e8f9", born: now, life: 390, maxRadius: 48 });
      continue;
    }
    if (event.type === "cryoImpact") {
      addSparks(particles, event, now, Math.max(7, Math.round(20 * quality.density)), random, {
        kind: "snow", color: "#e6fcff", minSpeed: 28, speed: 105, life: 540, size: 2.4,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#67e8f9", born: now, life: 460, maxRadius: 46 });
      continue;
    }
    if (event.type === "fireImpact") {
      addSparks(particles, event, now, Math.max(4, Math.round(11 * quality.density)), random, {
        color: "#fb923c", minSpeed: 24, speed: 86, life: 300, size: 1.7,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#f59e0b", born: now, life: 210, maxRadius: 20 });
      if (settings.quality !== "low") particles.push({
        kind: "smoke", x: event.x, y: event.y - 2, vx: -5, vy: -18,
        color: "#665653", born: now, life: 380, size: 7,
      });
      continue;
    }
    if (event.type === "emberGlobImpact") {
      addSparks(particles, event, Math.max(3, Math.round((settings.reduceMotion ? 3 : 7) * quality.density)), random, {
        color: "#fb923c", minSpeed: 24, speed: 88, life: 300, size: 2,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#f59e0b", born: now, life: 260, maxRadius: 28 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#fff7c2", born: now, life: 130, size: 24 });
      continue;
    }
    if (event.type === "abyssImpact") {
      const prism = event.weapon === "prismBolt";
      addSparks(particles, event, now, Math.max(6, Math.round(18 * quality.density)), random, {
        color: prism ? "#7fffd4" : "#c084fc", minSpeed: 35, speed: 115, life: 420, size: 2.2,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: prism ? "#ffcf70" : "#a855f7", born: now, life: 360, maxRadius: 52 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: prism ? "#effff8" : "#f3e8ff", born: now, life: 180, size: 28 });
      continue;
    }
    if (event.type === "projectileImpact") {
      const sniper = event.weapon === "sniperBullet";
      const nanite = event.weapon === "naniteBullet";
      addSparks(particles, event, now, settings.reduceMotion && nanite ? 1 : Math.max(3, Math.round((sniper ? 14 : nanite ? 4 : 7) * quality.density)), random, { color: nanite ? "#5eead4" : color, minSpeed: nanite ? 18 : 35, speed: sniper ? 145 : nanite ? 48 : 80, life: sniper ? 410 : 260, size: sniper ? 2.3 : nanite ? 1.3 : 1.7 });
      if (sniper) particles.push({ kind: "ring", x: event.x, y: event.y, color, born: now, life: 250, maxRadius: 34 });
      continue;
    }
    if (event.type === "mantisSpikeSalvo") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#e879f9", born: now, life: 300, maxRadius: 32 });
      addSparks(particles, event, now, settings.reduceMotion ? 2 : Math.max(4, Math.round(10 * quality.density)), random, {
        color: "#67e8f9", minSpeed: 18, speed: 64, life: 260, size: 1.6,
      });
      continue;
    }
    if (event.type === "mantisSpikeImpact") {
      addSparks(particles, event, now, settings.reduceMotion ? 2 : Math.max(4, Math.round(9 * quality.density)), random, {
        color: "#f0abfc", minSpeed: 24, speed: 90, life: 300, size: 1.8,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#22d3ee", born: now, life: 220, maxRadius: 20 });
      continue;
    }
    if (event.type === "mantisSpikeDetonation") {
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#e879f9", born: now, life: 360, maxRadius: Math.min(74, event.radius || 58) });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#f5d0fe", born: now, life: 150, size: 24 });
      addSparks(particles, event, now, settings.reduceMotion ? 3 : Math.max(7, Math.round(16 * quality.density)), random, {
        color: "#67e8f9", minSpeed: 28, speed: 105, life: 420, size: 2,
      });
      continue;
    }
    if (event.type === "scarabTransitionStart") {
      addSparks(particles, event, now, Math.max(10, Math.round((event.toPhase === 3 ? 34 : 24) * quality.density)), random, {
        color: event.toPhase === 3 ? "#fbbf24" : "#fb923c", minSpeed: 35, speed: 135, life: 620, size: 3.1,
      });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#22d3ee", born: now, life: 650, maxRadius: event.toPhase === 3 ? 105 : 82 });
      if (settings.quality !== "low") particles.push({
        kind: "smoke", x: event.x, y: event.y + 28, vx: -10, vy: -26,
        color: "#9a6b42", born: now, life: 780, size: event.toPhase === 3 ? 26 : 20,
      });
      continue;
    }
    if (event.type === "scarabTransitionComplete") {
      addSparks(particles, event, now, Math.max(5, Math.round(12 * quality.density)), random, {
        color: "#22d3ee", minSpeed: 20, speed: 75, life: 360, size: 2,
      });
      continue;
    }
    if (event.type === "scarabAttackImpact") {
      addSparks(particles, event, now, Math.max(4, Math.round(10 * quality.density)), random, {
        color: "#f59e0b", minSpeed: 28, speed: 92, life: 300, size: 2.2,
      });
      continue;
    }

    const baseBursts = event.type === "bossDeath" ? 36 : event.type === "explosion" ? 22 : event.type === "breach" ? 24 : event.type === "hit" ? 3 : 8;
    addSparks(particles, event, now, Math.max(2, Math.round(baseBursts * quality.density)), random, {
      color, speed: event.type === "bossDeath" ? 155 : event.type === "explosion" ? 130 : 80,
      life: event.type === "explosion" ? 430 : 340,
    });
    if (["deploy", "spawn", "explosion", "breach", "bossPhase", "bossDeath"].includes(event.type)) {
      particles.push({ kind: "ring", x: event.x || 0, y: event.y || 0, color, born: now, life: 450, maxRadius: event.type === "explosion" ? 70 : 65 });
    }
    if (event.type === "explosion") {
      particles.push({ kind: "smoke", x: event.x, y: event.y, vx: -8, vy: -22, color: "#475569", born: now, life: 620, size: 18 });
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: "#fff0c2", born: now, life: 170, size: 34 });
    }
    } finally {
      if (essential) {
        for (let index = particleStart; index < particles.length; index += 1) particles[index].essential = true;
      }
    }
  }

  trimParticleBudget(particles, profile(settings).budget);
  return particles;
}

function drawTracer(ctx, projectile, length, width, core) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const tailX = projectile.x - Math.cos(angle) * length;
  const tailY = projectile.y - Math.sin(angle) * length;
  ctx.strokeStyle = core;
  ctx.globalAlpha *= 0.72;
  ctx.lineWidth = width;
  ctx.shadowBlur = 10;
  ctx.shadowColor = projectile.color;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(projectile.x, projectile.y);
  ctx.stroke();
}

function drawVeuSalinoMucus(ctx, projectile, quality) {
  const age = Math.max(0, Number(projectile.ageMs) || 0);
  const seed = Number(projectile.seed) || 1;
  const pulse = 1 + Math.sin(age * 0.018 + seed) * 0.06;
  const wobble = Math.sin(age * 0.024 + seed * 0.7) * 2.5;
  const angle = Math.atan2(projectile.vy || 0, projectile.vx || -1);
  const density = quality?.density || 1;
  const filamentCount = density < .5 ? 1 : 2;

  ctx.save();
  ctx.translate(projectile.x, projectile.y + wobble);
  ctx.rotate(angle);
  ctx.scale(pulse, 1 / pulse);
  ctx.lineCap = "round";

  for (let index = 0; index < filamentCount; index += 1) {
    const offset = index ? 2.4 : -2.4;
    ctx.strokeStyle = index ? "rgba(232,121,249,.58)" : "rgba(103,232,249,.66)";
    ctx.lineWidth = index ? 1.15 : 1.35;
    ctx.beginPath();
    ctx.moveTo(-3, offset * 0.35);
    ctx.quadraticCurveTo(-10, offset + Math.sin(age * 0.022 + index) * 2, -20, offset * 0.75);
    ctx.stroke();
  }

  const membrane = ctx.createRadialGradient(-2, -2, 1, 0, 0, 11);
  membrane.addColorStop(0, "rgba(255,255,255,.95)");
  membrane.addColorStop(.28, "rgba(240,171,252,.92)");
  membrane.addColorStop(.62, "rgba(103,232,249,.78)");
  membrane.addColorStop(1, "rgba(34,211,238,.12)");
  ctx.fillStyle = membrane;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(103,232,249,.55)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 4;
  ctx.fillStyle = "rgba(126,34,206,.9)";
  ctx.beginPath();
  ctx.ellipse(-1, 0, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (density > .9) {
    ctx.fillStyle = "rgba(186,230,253,.8)";
    for (let index = 0; index < 2; index += 1) {
      const x = -13 - index * 6;
      const y = Math.sin(age * .02 + seed + index) * 3;
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawRoundBullet(ctx, projectile, { radius, glowRadius, rim, glowEdge }) {
  drawCachedRadialGlow(
    ctx,
    `round-bullet:${projectile.color}:${glowEdge}`,
    projectile.x,
    projectile.y,
    glowRadius,
    glowRadius,
    "#ffffff",
    projectile.color,
    glowEdge,
    0.62,
  );

  ctx.fillStyle = "#f8fdff";
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.4;
  ctx.shadowBlur = glowRadius * 0.7;
  ctx.shadowColor = projectile.color;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawMarineBullet(ctx, projectile) {
  drawRoundBullet(ctx, projectile, {
    radius: 2.4, glowRadius: 5.5, rim: "#0ea5e9", glowEdge: "rgba(56,189,248,0)",
  });
}

function drawIcaroBullet(ctx, projectile, special = false) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const offsets = special ? [-5, 0, 5] : [0];
  const perpendicularX = -Math.sin(angle);
  const perpendicularY = Math.cos(angle);

  for (const offset of offsets) {
    const x = projectile.x + perpendicularX * offset;
    const y = projectile.y + perpendicularY * offset;
    const length = special ? 13 : 10;
    const width = special ? 2.5 : 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.strokeStyle = "rgba(103,232,249,.62)";
    ctx.lineWidth = special ? 2 : 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-length * 1.7, 0);
    ctx.lineTo(-2, 0);
    ctx.stroke();

    ctx.shadowBlur = special ? 12 : 8;
    ctx.shadowColor = "#f97316";
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(-length * 0.45, -width);
    ctx.lineTo(length * 0.35, -width);
    ctx.lineTo(length, 0);
    ctx.lineTo(length * 0.35, width);
    ctx.lineTo(-length * 0.45, width);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 5;
    ctx.shadowColor = "#22d3ee";
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(-length * 0.32, -width * 0.42);
    ctx.lineTo(length * 0.3, -width * 0.42);
    ctx.lineTo(length * 0.72, 0);
    ctx.lineTo(length * 0.3, width * 0.42);
    ctx.lineTo(-length * 0.32, width * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawNaniteBullet(ctx, projectile) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const trailLength = Math.min(projectileTrailLength(projectile.trail), 4);
  const trailStart = projectileTrailPoint(projectile.trail, 0, trailLength);
  if (trailLength > 1) {
    ctx.strokeStyle = "rgba(103,232,249,.58)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(trailStart.x, trailStart.y);
    ctx.lineTo(projectile.x, projectile.y);
    ctx.stroke();
  }
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#2dd4bf";
  ctx.fillStyle = "#ecfeff";
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function drawMantisSpike(ctx, projectile, quality) {
  const angle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  // Spikes are compact missiles: keep only a tiny motion accent instead of a long comet tail.
  const trailLength = Math.min(projectileTrailLength(projectile.trail), quality === "low" ? 2 : 3);
  const trailStart = projectileTrailPoint(projectile.trail, 0, trailLength);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (projectile.phase !== "attached" && trailLength > 1) {
    ctx.strokeStyle = "rgba(34,211,238,.58)";
    ctx.lineWidth = quality === "low" ? 1.5 : 2;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(trailStart.x, trailStart.y); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
  }
  ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
  ctx.shadowColor = projectile.color || "#22d3ee"; ctx.shadowBlur = quality === "low" ? 8 : 14;
  ctx.fillStyle = "#f5f3ff";
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -3); ctx.lineTo(-3, 0); ctx.lineTo(-7, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = projectile.color || "#e879f9"; ctx.lineWidth = 1.4; ctx.stroke();
  if (projectile.phase === "attached") {
    const pulse = 1 + Math.sin((projectile.detonationProgress || 0) * Math.PI * 4) * 0.12;
    ctx.shadowBlur = (quality === "low" ? 8 : 14) * pulse;
    ctx.strokeStyle = projectile.color || "#e879f9";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-2, 0, 7 * pulse, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawSniperBullet(ctx, projectile) {
  drawRoundBullet(ctx, projectile, {
    radius: 3.2, glowRadius: 7, rim: "#ea580c", glowEdge: "rgba(249,115,22,0)",
  });
}

function drawLeviathanRound(ctx, projectile, quality) {
  const angle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  const recent = quality === "low" ? 4 : 8;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  forEachProjectileTrailPoint(projectile.trail, recent, (point, index, count) => {
    const alpha = (index + 1) / Math.max(1, count) * 0.42;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = index > count * 0.55 ? "#e0f2fe" : projectile.color || "#38bdf8";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2 + index / Math.max(1, count) * 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.shadowColor = projectile.color || "#38bdf8";
  ctx.shadowBlur = quality === "low" ? 8 : 18;
  const gradient = ctx.createLinearGradient(-25, 0, 15, 0);
  gradient.addColorStop(0, "rgba(56, 189, 248, 0)");
  gradient.addColorStop(0.55, projectile.color || "#38bdf8");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-28, -4);
  ctx.lineTo(12, -3);
  ctx.lineTo(20, 0);
  ctx.lineTo(12, 3);
  ctx.lineTo(-28, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIceProjectile(ctx, projectile) {
  drawCachedRadialGlow(
    ctx, "projectile-ice", projectile.x, projectile.y, 10, 10,
    "#ffffff", "#167ece", "rgba(22,126,206,0)", 0.58,
  );
  ctx.fillStyle = "#167ece";
  ctx.strokeStyle = "#bfe9ff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawCryoJet(ctx, projectile) {
  forEachProjectileTrailPoint(projectile.trail, 12, (point, index, count) => {
    const ratio = (index + 1) / count;
    ctx.fillStyle = `rgba(103,232,249,${ratio * 0.24})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2 + ratio * 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  drawCachedRadialGlow(
    ctx, "projectile-cryo-jet", projectile.x, projectile.y, 13, 13,
    "#ffffff", "#67e8f9", "rgba(34,211,238,0)", 0.7,
  );
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#f5feff";
  ctx.strokeStyle = "#a5f3fc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(1, -4); ctx.lineTo(-5, 0); ctx.lineTo(1, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#67e8f9";
  ctx.beginPath(); ctx.arc(-6, 0, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFireball(ctx, projectile) {
  drawRoundBullet(ctx, projectile, {
    radius: 4, glowRadius: 8.5, rim: "#ea580c", glowEdge: "rgba(249,115,22,0)",
  });
}

function drawAbyssOrb(ctx, projectile, quality) {
  const recent = Math.max(4, Math.round(12 * quality.trail));
  forEachProjectileTrailPoint(projectile.trail, recent, (point, index, count) => {
    const ratio = (index + 1) / count;
    ctx.fillStyle = `rgba(168,85,247,${ratio * 0.24})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3 + ratio * 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 18;
  ctx.shadowColor = projectile.color || "#a855f7";
  drawCachedRadialGlow(
    ctx,
    `abyss-orb:${projectile.color || "#a855f7"}`,
    projectile.x,
    projectile.y,
    16,
    16,
    "#ffffff",
    projectile.color || "#a855f7",
    "rgba(88,28,135,0)",
    0.55,
  );
  ctx.fillStyle = "#f5e8ff";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagneticMine(ctx, x, y, rotation = 0, image = null, size = 52) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 10;
  if (image) {
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#57462f";
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.42, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#a5f3fc";
    ctx.beginPath();
    ctx.arc(0, -1, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawMines(ctx, mines, image = null, elapsed = 0) {
  for (const mine of mines) {
    if (!mine.active) continue;
    const pulse = 0.88 + Math.sin((elapsed + mine.seed) / 180) * 0.08;
    drawMagneticMine(ctx, mine.x, mine.y + 42, 0, image, 58 * pulse);
    ctx.save();
    ctx.globalAlpha = 0.22 + pulse * 0.12;
    ctx.strokeStyle = mine.color || "#22d3ee";
    ctx.beginPath();
    ctx.ellipse(mine.x, mine.y + 43, 31 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawFrozenEnemyEffect(ctx, entity, elapsed, settings = {}) {
  const motionTime = settings.reduceMotion ? 0 : elapsed;
  const pulse = 0.82 + Math.sin(motionTime / 180) * 0.08;
  const scale = entity.scale || 1;
  const radiusX = 28 * scale;
  const baseY = entity.y + 30 * scale;
  ctx.save();
  ctx.globalAlpha = pulse;
  drawCachedRadialGlow(
    ctx, "frozen-enemy", entity.x, entity.y + 4, 48 * scale, 58 * scale,
    "rgba(186,247,255,.16)", "rgba(34,211,238,.1)", "rgba(14,165,233,0)", 0.58,
  );
  ctx.restore();

  const crystals = settings.quality === "low" ? [-0.55, 0.5] : [-0.72, -0.2, 0.34, 0.72];
  ctx.fillStyle = `rgba(165,243,252,${0.72 * pulse})`;
  ctx.strokeStyle = "rgba(224,252,255,.9)";
  ctx.lineWidth = 1;
  crystals.forEach((offset, index) => {
    const x = entity.x + radiusX * offset;
    const height = (7 + (index % 2) * 4) * scale;
    ctx.beginPath();
    ctx.moveTo(x - 3 * scale, baseY);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + 3 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.save();
  ctx.globalAlpha = 0.68 * pulse;
  ctx.fillStyle = "#e0fbff";
  ctx.font = `${Math.round(13 * scale)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("❄", entity.x, entity.y - 56 * scale);
  ctx.restore();
}

export function drawStunnedEnemyEffect(ctx, entity, elapsed, settings = {}) {
  const pulse = settings.reduceMotion ? 1 : 0.86 + Math.sin(elapsed / 110) * 0.14;
  const scale = entity.scale || 1;
  ctx.save();
  ctx.strokeStyle = "rgba(250,204,21,.9)";
  ctx.fillStyle = "rgba(254,240,138,.95)";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#fbbf24";
  for (let index = 0; index < 3; index += 1) {
    const angle = elapsed / 220 + index * Math.PI * 2 / 3;
    const x = entity.x + Math.cos(angle) * 22 * scale;
    const y = entity.y - 48 * scale + Math.sin(angle) * 7 * scale;
    ctx.beginPath();
    ctx.arc(x, y, 3.2 * pulse * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawMissileSalvo(ctx, projectile, quality) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const offsets = projectile.visualCount === 3 ? [-7, 0, 7] : [0];
  const recent = Math.max(4, Math.round(14 * quality.trail));
  forEachProjectileTrailPoint(projectile.trail, recent, (point, index, count) => {
    if (index % 2) return;
    const ratio = (index + 1) / count;
    ctx.fillStyle = `rgba(100,116,139,${0.06 + ratio * 0.16})`;
    ctx.beginPath();
    ctx.arc(point.x - Math.cos(angle) * 6, point.y - Math.sin(angle) * 6, 5 + (1 - ratio) * 5, 0, Math.PI * 2);
    ctx.fill();
  });
  offsets.forEach((offset) => {
    const x = projectile.x + nx * offset;
    const y = projectile.y + ny * offset;
    ctx.strokeStyle = "#ffe2a8";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#fb923c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * 12, y - Math.sin(angle) * 12);
    ctx.lineTo(x - Math.cos(angle) * 3, y - Math.sin(angle) * 3);
    ctx.stroke();
    ctx.fillStyle = offset === 0 ? "#f8fafc" : "#cbd5e1";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -3.5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawMortarShell(ctx, projectile, quality) {
  const recent = Math.max(4, Math.round(12 * quality.trail));
  forEachProjectileTrailPoint(projectile.trail, recent, (point, index, count) => {
    const ratio = (index + 1) / count;
    ctx.fillStyle = `rgba(148,163,184,${ratio * 0.18})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2 + (1 - ratio) * 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = projectile.color || "#fbbf24";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.ellipse(projectile.targetX, projectile.targetY, 34, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.rotation || 0);
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#fbbf24";
  ctx.fillStyle = "#d6a54a";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(3, -4);
  ctx.lineTo(-7, -4);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-7, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#334155";
  ctx.fillRect(-6, -3, 9, 6);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPrismBolt(ctx, projectile, quality) {
  const recent = Math.max(4, Math.round(12 * quality.trail));
  forEachProjectileTrailPoint(projectile.trail, recent, (point, index, count) => {
    const ratio = (index + 1) / count;
    ctx.strokeStyle = index % 2 ? `rgba(139,92,246,${ratio * .5})` : `rgba(127,255,212,${ratio * .62})`;
    ctx.lineWidth = 1 + ratio * 3;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - (1 - ratio) * 6);
    ctx.lineTo(projectile.x, projectile.y);
    ctx.stroke();
  });
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#7fffd4";
  ctx.fillStyle = "#ffcf70";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-5, -7);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f5f3ff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawInhibitorWeb(ctx, projectile) {
  const angle = Math.atan2(projectile.vy || 0, projectile.vx || -1);
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#f59e0b";
  ctx.fillStyle = "rgba(245,231,198,.94)";
  ctx.strokeStyle = "rgba(255,251,235,.92)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  for (let index = 0; index < 6; index += 1) {
    const angleOffset = index * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, Math.sin(angleOffset) * 8, -18, Math.cos(angleOffset) * 5);
    ctx.stroke();
  }
}

function drawRepulsorFist(ctx, projectile) {
  const trailLength = projectileTrailLength(projectile.trail);
  const trailStart = projectileTrailPoint(projectile.trail, 0, trailLength);
  if (trailLength > 1) {
    ctx.strokeStyle = "rgba(165,243,252,.62)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(trailStart.x, trailStart.y);
    forEachProjectileTrailPoint(projectile.trail, trailLength, (point, index) => {
      if (index > 0) ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  ctx.translate(projectile.x, projectile.y);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#22d3ee";
  ctx.strokeStyle = "#67e8f9";
  ctx.fillStyle = "rgba(34,211,238,.68)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9, -7, 19, 14, 5);
  ctx.fill();
  ctx.stroke();
  for (let index = 0; index < 3; index += 1) {
    ctx.beginPath();
    ctx.roundRect(4 + index * 4, -8 + index * 0.7, 5, 6, 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(236,254,255,.82)";
  ctx.lineWidth = 1.5;
  for (const radius of [13, 18]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawExecutorArcSlash(ctx, projectile, quality, assets = {}) {
  const phase = projectile.phase === "impact" ? "impact" : "flying";
  const frames = assets.executorArcSlash?.[phase] || [];
  const frameDuration = 60;
  const age = phase === "impact" ? projectile.phaseAgeMs || 0 : projectile.ageMs || 0;
  const rawIndex = Math.floor(age / frameDuration);
  const frameIndex = phase === "impact"
    ? Math.min(5, rawIndex)
    : rawIndex % Math.max(1, frames.length || 8);
  const image = frames[frameIndex] || frames.find(Boolean);

  if (phase === "impact") {
    if (image) {
      ctx.drawImage(image, projectile.x - 32, projectile.y - 32, 64, 64);
      return;
    }
    ctx.translate(projectile.x, projectile.y);
    ctx.strokeStyle = "#fff7ed";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -15);
    ctx.lineTo(15, 15);
    ctx.moveTo(15, -15);
    ctx.lineTo(-15, 15);
    ctx.stroke();
    return;
  }

  const recent = Math.max(2, Math.round(6 * quality.trail));
  const trailLength = Math.min(projectileTrailLength(projectile.trail), recent);
  const trailStart = projectileTrailPoint(projectile.trail, 0, trailLength);
  if (trailLength > 1) {
    ctx.strokeStyle = "rgba(251,146,60,.48)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trailStart.x, trailStart.y);
    forEachProjectileTrailPoint(projectile.trail, recent, (point, index) => {
      if (index > 0) ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }
  if (image) {
    ctx.drawImage(image, projectile.x - 48, projectile.y - 24, 96, 48);
    return;
  }
  ctx.translate(projectile.x, projectile.y);
  ctx.strokeStyle = "#fff7ed";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-4, 8, 28, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.strokeStyle = "#fb923c";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawRasgamarOrb(ctx, projectile, quality) {
  const trailLength = Math.min(projectileTrailLength(projectile.trail), Math.max(2, Math.round(5 * quality.trail)));
  if (trailLength > 1) {
    const start = projectileTrailPoint(projectile.trail, 0, trailLength);
    ctx.strokeStyle = "rgba(34,211,238,.42)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    forEachProjectileTrailPoint(projectile.trail, trailLength, (point, index) => { if (index) ctx.lineTo(point.x, point.y); });
    ctx.stroke();
  }
  ctx.translate(projectile.x, projectile.y);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#22d3ee";
  ctx.fillStyle = "rgba(14,116,144,.9)";
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#67e8f9";
  ctx.beginPath(); ctx.arc(-2, -2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ecfeff";
  ctx.beginPath(); ctx.arc(-4, -4, 2.2, 0, Math.PI * 2); ctx.fill();
}

function drawEmberGlob(ctx, projectile, quality) {
  const trailLength = Math.min(projectileTrailLength(projectile.trail), Math.max(2, Math.round(6 * quality.trail)));
  if (trailLength > 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(249,115,22,.36)";
    ctx.lineWidth = quality.trail > .7 ? 5 : 3;
    ctx.beginPath();
    forEachProjectileTrailPoint(projectile.trail, trailLength, (point, index) => {
      if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.rotation || 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 15;
  ctx.shadowColor = "#f97316";
  ctx.fillStyle = "#c2410c";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(-1, -1, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff7ae";
  ctx.beginPath();
  ctx.arc(-2.5, -2.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  const sparks = quality.trail > .7 ? 3 : quality.trail > .35 ? 2 : 1;
  ctx.fillStyle = "#fbbf24";
  for (let index = 0; index < sparks; index += 1) {
    const phase = (Number(projectile.seed) || 1) * .17 + index * 2.1 + (projectile.ageMs || 0) * .012;
    ctx.beginPath();
    ctx.arc(-7 - Math.cos(phase) * (3 + index * 2), Math.sin(phase) * (4 + index * 2), 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const projectileScratchState = { entity: null, x: 0, y: 0 };
const projectileScratch = new Proxy(projectileScratchState, {
  get(state, property) {
    if (property === "x" || property === "y") return state[property];
    if (property === "entity") return state.entity;
    return state.entity?.[property];
  },
});

export function drawProjectileCollection(
  ctx,
  projectiles,
  interpolation = 1,
  settings = {},
  assets = {},
) {
  const quality = profile(settings);
  for (const projectile of projectiles) {
    if (!projectile.launched) continue;
    const previousX = Number.isFinite(projectile.previousRenderX)
      ? projectile.previousRenderX
      : projectile.x;
    const previousY = Number.isFinite(projectile.previousRenderY)
      ? projectile.previousRenderY
      : projectile.y;
    projectileScratchState.entity = projectile;
    projectileScratchState.x = previousX + (projectile.x - previousX) * interpolation;
    projectileScratchState.y = previousY + (projectile.y - previousY) * interpolation;
    ctx.save();
    if (projectile.visualKind === "leviathanRound") drawLeviathanRound(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "rasgamarOrb") drawRasgamarOrb(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "emberGlob") drawEmberGlob(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "executorArcSlash") drawExecutorArcSlash(ctx, projectileScratch, quality, assets);
    else if (projectile.visualKind === "magneticMine") drawMagneticMine(ctx, projectileScratch.x, projectileScratch.y, projectile.rotation, assets.mine?.[0], 46);
    else if (projectile.visualKind === "repulsorFist") drawRepulsorFist(ctx, projectileScratch);
    else if (projectile.visualKind === "sniperBullet") drawSniperBullet(ctx, projectileScratch);
    else if (projectile.visualKind === "marineBullet") drawMarineBullet(ctx, projectileScratch);
    else if (projectile.visualKind === "icaroBullet") drawIcaroBullet(ctx, projectileScratch);
    else if (projectile.visualKind === "icaroInterceptionShot") drawIcaroBullet(ctx, projectileScratch, true);
    else if (projectile.visualKind === "naniteBullet") drawNaniteBullet(ctx, projectileScratch);
    else if (projectile.visualKind === "mantisSpike") drawMantisSpike(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "ice") drawIceProjectile(ctx, projectileScratch);
    else if (projectile.visualKind === "cryoJet") drawCryoJet(ctx, projectileScratch);
    else if (projectile.visualKind === "fireball") drawFireball(ctx, projectileScratch);
    else if (projectile.visualKind === "abyssOrb") drawAbyssOrb(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "prismBolt") drawPrismBolt(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "inhibitorWeb") drawInhibitorWeb(ctx, projectileScratch);
    else if (projectile.visualKind === "veuSalinoMucus") drawVeuSalinoMucus(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "microMissile") drawMissileSalvo(ctx, projectileScratch, quality);
    else if (projectile.visualKind === "mortarShell") drawMortarShell(ctx, projectileScratch, quality);
    else drawTracer(ctx, projectileScratch, 14, 2.5, "#ffffff");
    ctx.restore();
  }
  projectileScratchState.entity = null;
}

function drawVoltaicArc(ctx, particle, progress, settings) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const alpha = Math.pow(1 - clampedProgress, 0.72);
  const dx = particle.x1 - particle.x0;
  const dy = particle.y1 - particle.y0;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const segmentCount = settings.reduceMotion
    ? 1
    : Math.max(5, Math.min(10, Math.round(distance / 58)));
  const phase = settings.reduceMotion ? 0 : Math.floor(clampedProgress * 4);
  const random = seeded((particle.seed || 1) + phase * 7919);
  const points = [{ x: particle.x0, y: particle.y0 }];
  for (let index = 1; index < segmentCount; index += 1) {
    const ratio = index / segmentCount;
    const envelope = Math.sin(ratio * Math.PI);
    const jitter = (random() - 0.5) * (particle.primary ? 18 : 12) * envelope;
    points.push({
      x: particle.x0 + dx * ratio + normalX * jitter,
      y: particle.y0 + dy * ratio + normalY * jitter,
    });
  }
  points.push({ x: particle.x1, y: particle.y1 });

  const stroke = (color, width, shadowBlur = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width);
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
  };

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  stroke("rgba(8,47,73,.72)", particle.width * 1.9, 12);
  stroke(particle.color || "#22d3ee", particle.width, 18);
  stroke("rgba(236,254,255," + (0.96 * alpha) + ")", particle.width * 0.3, 6);
}

function drawLaser(ctx, particle, progress, settings) {
  const alpha = 1 - progress;
  ctx.lineCap = "round";
  ctx.strokeStyle = particle.color;
  ctx.shadowBlur = 18;
  ctx.shadowColor = particle.color;
  ctx.lineWidth = 9 * alpha + 2;
  ctx.beginPath();
  ctx.moveTo(particle.x0, particle.y0);
  ctx.lineTo(particle.x1, particle.y1);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.92 * alpha})`;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function drawShotgun(ctx, particle, progress) {
  const random = seeded(particle.seed || 1);
  const count = particle.pellets || 5;
  const length = particle.x1 - particle.x0;
  ctx.lineCap = "round";
  for (let index = 0; index < count; index += 1) {
    const spread = (index - (count - 1) / 2) * 7 + (random() - 0.5) * 4;
    const endX = particle.x0 + length * (0.76 + random() * 0.22);
    const endY = particle.y0 + spread;
    ctx.strokeStyle = `rgba(255,247,214,${0.72 * (1 - progress)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(particle.x0, particle.y0);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function drawRepulsorWake(ctx, particle, progress) {
  const alpha = Math.pow(1 - progress, 1.5);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = particle.color;
  ctx.shadowBlur = 10;
  ctx.shadowColor = particle.color;
  ctx.lineWidth = 3 * alpha;
  ctx.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    const y = particle.y + (index - 1) * 8;
    ctx.beginPath();
    ctx.moveTo(particle.x0 - 12, y);
    ctx.lineTo(particle.x1 - progress * 18, y);
    ctx.stroke();
  }
}

function drawFlameJet(ctx, particle, progress, settings) {
  const range = particle.x1 - particle.x0;
  const fade = Math.pow(1 - progress, 0.42);
  const wave = settings.reduceMotion
    ? 0
    : Math.sin(particle.wavePhase + progress * Math.PI * 2) * particle.waveAmp;
  const controlX = particle.x0 + range * 0.54;
  const controlY = particle.y0 + wave;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const startRadius = particle.bodyWidth * 0.22;
  const endRadius = particle.bodyWidth * 0.82;
  ctx.fillStyle = `rgba(249,115,22,${0.72 * fade})`;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(249,115,22,.88)";
  ctx.beginPath();
  ctx.moveTo(particle.x0, particle.y0 - startRadius);
  ctx.quadraticCurveTo(controlX, controlY - endRadius * 0.72, particle.x1, particle.y1 - endRadius + wave * 0.35);
  ctx.lineTo(particle.x1, particle.y1 + endRadius + wave * 0.35);
  ctx.quadraticCurveTo(controlX, controlY + endRadius * 0.72, particle.x0, particle.y0 + startRadius);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(255,137,28,${0.88 * fade})`;
  ctx.lineWidth = particle.bodyWidth * (0.48 + Math.sin(particle.wavePhase + progress * 9) * 0.06);
  ctx.beginPath();
  ctx.moveTo(particle.x0, particle.y0);
  ctx.quadraticCurveTo(controlX, controlY, particle.x1, particle.y1 + wave * 0.35);
  ctx.stroke();

  const coreEndX = particle.x0 + range * 0.46;
  ctx.strokeStyle = `rgba(255,246,174,${0.82 * fade})`;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#fff1a8";
  ctx.lineWidth = Math.max(2, particle.bodyWidth * 0.16);
  ctx.beginPath();
  ctx.moveTo(particle.x0, particle.y0);
  ctx.quadraticCurveTo(particle.x0 + range * 0.38, particle.y0 + wave * 0.45, coreEndX, particle.y0 + wave * 0.28);
  ctx.stroke();
}

function drawFlame(ctx, particle, progress, settings) {
  const x = particle.x + particle.driftX * progress;
  const wave = settings.reduceMotion ? 0 : Math.sin(progress * particle.waveFreq + particle.wavePhase) * particle.waveAmp;
  const y = particle.y + particle.driftY * progress + wave;
  const pulse = 0.88 + Math.sin(particle.wavePhase + progress * 12) * 0.12;
  const radius = Math.max(1.5, particle.size * pulse * (1 - progress * (particle.soft ? 0.42 : 0.58)));
  const alpha = (particle.soft ? 0.28 : 0.88) * Math.pow(1 - progress, 0.72);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  drawCachedRadialGlow(
    ctx,
    `flame:${particle.inner}:${particle.outer}`,
    x,
    y,
    radius,
    radius,
    `rgb(${particle.inner})`,
    `rgb(${particle.outer})`,
    `rgba(${particle.outer},0)`,
    0.42,
  );
}

function drawFlameRibbon(ctx, particle, progress) {
  const alpha = Math.pow(1 - progress, 0.55);
  const controlX = particle.x0 + (particle.x1 - particle.x0) * 0.55;
  const controlY = (particle.y0 + particle.y1) / 2
    + Math.sin(particle.wavePhase + progress * 8) * particle.waveAmp;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = particle.color;
  ctx.shadowBlur = 9;
  ctx.shadowColor = particle.color;
  ctx.globalAlpha = alpha * 0.8;
  ctx.lineWidth = particle.width * alpha;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(particle.x0, particle.y0);
  ctx.quadraticCurveTo(controlX, controlY, particle.x1, particle.y1);
  ctx.stroke();
}

const NON_EMISSIVE_PARTICLE_KINDS = new Set(["casing", "smoke", "floatingText"]);

export function drawParticles(ctx, particles, now, settings = {}, emissiveOnly = false) {
  let write = 0;
  for (const particle of particles) {
    const progress = (now - particle.born) / particle.life;
    if (progress >= 1) continue;
    particles[write] = particle;
    write += 1;
    if (progress < 0) continue;
    if (emissiveOnly && NON_EMISSIVE_PARTICLE_KINDS.has(particle.kind)) continue;
    const seconds = (now - particle.born) / 1000;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    if (drawExecutorParticle(ctx, particle, progress)) {
      // Dedicated Vórtice particles draw themselves while sharing this lifecycle.
    } else if (particle.kind === "spark" || particle.kind === "snow") {
      const sway = particle.kind === "snow" && !settings.reduceMotion
        ? Math.sin((particle.phase || 0) + seconds * (particle.phaseSpeed || 6)) * (particle.sway || 0)
        : 0;
      const x = particle.x + particle.vx * seconds + sway;
      const y = particle.y + particle.vy * seconds + (particle.gravity || 0) * seconds * seconds / 2;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = particle.kind === "snow" ? 7 : 3;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      const radius = Math.max(0.01, Number(particle.size) || 0);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === "casing") {
      const x = particle.x + particle.vx * seconds;
      const y = particle.y + particle.vy * seconds + particle.gravity * seconds * seconds / 2;
      ctx.translate(x, y);
      ctx.rotate(particle.rotation + seconds * 11);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size, -1, particle.size * 2, 2);
    } else if (particle.kind === "ring") {
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath();
      const maxRadius = Math.max(0, Number(particle.maxRadius) || 0);
      const radius = Math.max(0.01, 5 + progress * maxRadius);
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === "veuSalinoDebuff") {
      const wobble = settings.reduceMotion ? 0 : Math.sin(seconds * 5 + particle.seed) * 3;
      ctx.lineCap = "round";
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(232,121,249,.72)";
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#c084fc";
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI / 2 + .35;
        const startX = particle.x + Math.cos(angle) * 10;
        const startY = particle.y + Math.sin(angle) * 7;
        const endX = particle.x + Math.cos(angle) * 24;
        const endY = particle.y + Math.sin(angle) * 17 + wobble;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo((startX + endX) / 2 + wobble, (startY + endY) / 2 - wobble, endX, endY);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(196,181,253,.8)";
      ctx.beginPath(); ctx.arc(particle.x, particle.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    } else if (particle.kind === "veuSalinoHealCore") {
      const pulse = .62 + Math.sin(progress * Math.PI * 4) * .18;
      drawCachedRadialGlow(ctx, "veu-salino-heal-core", particle.x, particle.y, 34 * pulse, 24 * pulse,
        "#ecfeff", particle.flooded ? "#22d3ee" : "#67e8f9", "rgba(167,139,250,0)", .42);
    } else if (particle.kind === "veuSalinoHealMembrane") {
      const radius = (18 + progress * 58) * particle.scale;
      ctx.fillStyle = `rgba(167,139,250,${.16 * (1 - progress)})`;
      ctx.strokeStyle = `rgba(103,232,249,${.82 * (1 - progress)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let index = 0; index <= 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 3 + progress * 6) * .1;
        const x = particle.x + Math.cos(angle) * radius * wobble;
        const y = particle.y + Math.sin(angle) * radius * .62 * wobble;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (particle.kind === "veuSalinoHealLink") {
      const midX = (particle.x0 + particle.x1) / 2;
      const midY = Math.min(particle.y0, particle.y1) - particle.curveOffset;
      ctx.lineCap = "round"; ctx.lineWidth = particle.flooded ? 3.5 : 2.5;
      ctx.strokeStyle = "rgba(103,232,249,.86)"; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.moveTo(particle.x0, particle.y0); ctx.quadraticCurveTo(midX, midY, particle.x1, particle.y1); ctx.stroke();
      ctx.fillStyle = "#f0abfc";
      for (let index = 0; index < 2; index += 1) {
        const t = (progress + index * .42) % 1;
        const x = (1 - t) ** 2 * particle.x0 + 2 * (1 - t) * t * midX + t ** 2 * particle.x1;
        const y = (1 - t) ** 2 * particle.y0 + 2 * (1 - t) * t * midY + t ** 2 * particle.y1;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (particle.kind === "veuSalinoHealImpact") {
      const radius = 7 + progress * 14;
      ctx.strokeStyle = `rgba(103,232,249,${.8 * (1 - progress)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2); ctx.stroke();
      drawCachedRadialGlow(ctx, "veu-salino-heal-impact", particle.x, particle.y - 4, 18, 24,
        "#ecfeff", particle.flooded ? "#22d3ee" : "#67e8f9", "rgba(103,232,249,0)", .35);
    } else if (particle.kind === "muzzle") {
      const radius = particle.size * (0.55 + progress * 0.85);
      drawCachedRadialGlow(
        ctx,
        `muzzle:${particle.color}`,
        particle.x,
        particle.y,
        radius,
        radius,
        "#ffffff",
        particle.color,
        "rgba(255,160,40,0)",
        0.28,
      );
    } else if (particle.kind === "smoke") {
      const x = particle.x + particle.vx * seconds;
      const y = particle.y + particle.vy * seconds;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha *= 0.35;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.01, (Number(particle.size) || 0) * (0.7 + progress)), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === "floatingText") {
      const x = particle.x + (particle.vx || 0) * seconds;
      const y = particle.y + (particle.vy || -46) * seconds;
      const popFactor = progress < 0.15 ? 1 + (0.15 - progress) * 2.2 : 1;
      const size = Math.round((particle.fontSize || 19) * popFactor);
      ctx.font = `900 ${size}px 'Chakra Petch', 'Arial Black', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeText(particle.text, x, y);
      ctx.shadowColor = particle.glowColor || particle.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = particle.color;
      ctx.fillText(particle.text, x, y);
    } else if (particle.kind === "voltaicArc") drawVoltaicArc(ctx, particle, progress, settings);
    else if (particle.kind === "laser") drawLaser(ctx, particle, progress, settings);
    else if (particle.kind === "shotgun") drawShotgun(ctx, particle, progress);
    else if (particle.kind === "repulsorWake") drawRepulsorWake(ctx, particle, progress);
    else if (particle.kind === "flameJet") drawFlameJet(ctx, particle, progress, settings);
    else if (particle.kind === "flame") drawFlame(ctx, particle, progress, settings);
    else if (particle.kind === "flameRibbon") drawFlameRibbon(ctx, particle, progress);
    ctx.restore();
  }
  particles.length = write;
  return particles;
}
