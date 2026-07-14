const QUALITY = {
  low: { density: 0.3, trail: 0.45, budget: 140 },
  medium: { density: 0.62, trail: 0.72, budget: 260 },
  high: { density: 1, trail: 1, budget: 440 },
};

function profile(settings = {}) {
  return QUALITY[settings.quality] || QUALITY.high;
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
  const bodyCount = Math.max(3, Math.round(12 * quality.density));
  const emberCount = Math.max(4, Math.round(18 * quality.density));
  const ribbonCount = settings.quality === "low" ? 1 : 3;

  for (let index = 0; index < bodyCount; index += 1) {
    const life = 330 + random() * 150;
    const waveAmp = settings.reduceMotion ? 0 : 2.5 + random() * 4;
    const base = {
      kind: "flame", x: event.x0 + random() * 5, y: event.y0 + (random() - 0.5) * 6,
      travel: range * (0.72 + random() * 0.28), driftY: (random() - 0.5) * 8,
      waveAmp, waveFreq: 8 + random() * 6, wavePhase: random() * Math.PI * 2,
      size: 8 + random() * 9, born: now, life, color: event.color || "#f97316",
      inner: "255,248,185", outer: `255,${120 + Math.round(random() * 45)},${32 + Math.round(random() * 30)}`,
      soft: false,
    };
    particles.push(base);
    if (random() < 0.6 && settings.quality !== "low") {
      particles.push({
        ...base, x: base.x + random() * 4, y: base.y + (random() - 0.5) * 5,
        travel: base.travel * (0.72 + random() * 0.12), size: 17 + random() * 10,
        life: life + 45, inner: "255,190,90", outer: "255,82,28", soft: true,
      });
    }
  }

  addSparks(particles, { ...event, x: event.x0, y: event.y0 }, now, emberCount, random, {
    forward: true, color: "#ffd27a", minSpeed: 180, speed: 270, life: 360, size: 1.35,
  });

  for (let index = 0; index < ribbonCount; index += 1) {
    particles.push({
      kind: "flameRibbon", x: event.x0 + 8 + index * 7, y: event.y0 + (random() - 0.5) * 4,
      travel: range * (0.45 + random() * 0.32), length: 8 + random() * 13,
      width: 2.5 + random() * 2.5, born: now, life: 150 + random() * 90,
      color: random() < 0.5 ? "#fff0a3" : "#ffb15c",
    });
  }

  if (settings.quality !== "low") {
    particles.push({
      kind: "smoke", x: event.x0 + 2, y: event.y0 + (random() - 0.5) * 5,
      vx: 28 + random() * 24, vy: -10 - random() * 12, color: "#8c8582",
      born: now, life: 380 + random() * 100, size: 5 + random() * 5,
    });
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
  const quality = profile(settings);
  for (const event of events) {
    const random = seeded(event.seed || 1);
    const color = event.color || (event.type.includes("Death") ? "#fb7185" : "#67e8f9");

    if (event.type === "beam") {
      particles.push({ kind: "laser", ...event, color, born: now, life: 155 });
      particles.push({ kind: "ring", x: event.x1, y: event.y1, color, born: now, life: 220, maxRadius: 22 });
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
    if (event.type === "fireTrail") {
      particles.push(...createFireTrailParticles(event, now, settings));
      continue;
    }
    if (event.type === "shoot") {
      const flashColor = event.weapon === "ice" ? "#d9fbff" : ["microMissile", "fireball"].includes(event.weapon) ? "#ffcf8a" : "#fff7d6";
      const flashSize = event.weapon === "sniperBullet" ? 22 : event.weapon === "fireball" ? 12 : 15;
      particles.push({ kind: "muzzle", x: event.x, y: event.y, color: flashColor, born: now, life: event.weapon === "sniperBullet" ? 125 : 90, size: flashSize });
      if (["marineBullet", "sniperBullet"].includes(event.weapon)) {
        addSparks(particles, event, now, Math.max(2, Math.round(5 * quality.density)), random, { forward: true, color: event.color, speed: 100, life: 190, size: 1.4 });
        particles.push({ kind: "casing", x: event.x - 6, y: event.y + 2, vx: -22 - random() * 20, vy: -55 - random() * 25, gravity: 145, rotation: random() * Math.PI, color: "#fbbf24", born: now, life: 420, size: 3 });
      } else if (event.weapon === "ice") {
        particles.push(...createIceTrailParticles({ ...event, variant: "muzzle" }, now, settings));
      } else if (event.weapon === "microMissile") {
        particles.push({ kind: "smoke", x: event.x - 4, y: event.y, vx: -18, vy: 0, color: "#94a3b8", born: now, life: 360, size: 8 });
      } else if (event.weapon === "fireball") {
        addSparks(particles, event, now, Math.max(2, Math.round(4 * quality.density)), random, {
          forward: true, color: "#ffd27a", minSpeed: 35, speed: 70, life: 180, size: 1.1,
        });
      }
      continue;
    }

    if (event.type === "iceImpact") {
      addSparks(particles, event, now, Math.max(5, Math.round(16 * quality.density)), random, { kind: "snow", color: "#d8fbff", minSpeed: 24, speed: 85, life: 480, size: 2.8 });
      particles.push({ kind: "ring", x: event.x, y: event.y, color: "#67e8f9", born: now, life: 390, maxRadius: 48 });
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
    if (event.type === "projectileImpact") {
      const sniper = event.weapon === "sniperBullet";
      addSparks(particles, event, now, Math.max(3, Math.round((sniper ? 14 : 7) * quality.density)), random, { color, minSpeed: 35, speed: sniper ? 145 : 80, life: sniper ? 410 : 260, size: sniper ? 2.3 : 1.7 });
      if (sniper) particles.push({ kind: "ring", x: event.x, y: event.y, color, born: now, life: 250, maxRadius: 34 });
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
  }

  if (particles.length > quality.budget) particles.splice(0, particles.length - quality.budget);
  return particles;
}

function drawTracer(ctx, projectile, length, width, core) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const tailX = projectile.x - Math.cos(angle) * length;
  const tailY = projectile.y - Math.sin(angle) * length;
  const gradient = ctx.createLinearGradient(tailX, tailY, projectile.x, projectile.y);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(0.5, projectile.color);
  gradient.addColorStop(1, core);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = width;
  ctx.shadowBlur = 10;
  ctx.shadowColor = projectile.color;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(projectile.x, projectile.y);
  ctx.stroke();
}

function drawRoundBullet(ctx, projectile, { radius, glowRadius, rim, glowEdge }) {
  const glow = ctx.createRadialGradient(projectile.x - 1.5, projectile.y - 1.5, 0.5, projectile.x, projectile.y, glowRadius);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.3, "#fff7ed");
  glow.addColorStop(0.62, projectile.color);
  glow.addColorStop(1, glowEdge);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

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

function drawSniperBullet(ctx, projectile) {
  drawRoundBullet(ctx, projectile, {
    radius: 3.2, glowRadius: 7, rim: "#ea580c", glowEdge: "rgba(249,115,22,0)",
  });
}

function drawIceProjectile(ctx, projectile) {
  const glow = ctx.createRadialGradient(projectile.x - 1, projectile.y - 1, 0.5, projectile.x, projectile.y, 10);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.25, "#78c8ff");
  glow.addColorStop(0.58, "#167ece");
  glow.addColorStop(1, "rgba(22,126,206,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#167ece";
  ctx.strokeStyle = "#bfe9ff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFireball(ctx, projectile) {
  drawRoundBullet(ctx, projectile, {
    radius: 4, glowRadius: 8.5, rim: "#ea580c", glowEdge: "rgba(249,115,22,0)",
  });
}

export function drawFrozenEnemyEffect(ctx, entity, elapsed, settings = {}) {
  const motionTime = settings.reduceMotion ? 0 : elapsed;
  const pulse = 0.82 + Math.sin(motionTime / 180) * 0.08;
  const scale = entity.scale || 1;
  const radiusX = 28 * scale;
  const baseY = entity.y + 30 * scale;
  const halo = ctx.createRadialGradient(entity.x, entity.y + 4, 2, entity.x, entity.y + 4, 48 * scale);
  halo.addColorStop(0, `rgba(186,247,255,${0.16 * pulse})`);
  halo.addColorStop(0.58, `rgba(34,211,238,${0.1 * pulse})`);
  halo.addColorStop(1, "rgba(14,165,233,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 4, 48 * scale, 58 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

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
}

function drawMissileSalvo(ctx, projectile, quality) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const offsets = projectile.visualCount === 3 ? [-7, 0, 7] : [0];
  const trail = projectile.trail.slice(-Math.max(4, Math.round(14 * quality.trail)));
  trail.forEach((point, index) => {
    if (index % 2) return;
    const ratio = (index + 1) / trail.length;
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

export function drawProjectiles(ctx, projectiles, settings = {}) {
  const quality = profile(settings);
  for (const projectile of projectiles) {
    if (!projectile.launched) continue;
    ctx.save();
    if (projectile.visualKind === "sniperBullet") drawSniperBullet(ctx, projectile);
    else if (projectile.visualKind === "marineBullet") drawMarineBullet(ctx, projectile);
    else if (projectile.visualKind === "ice") drawIceProjectile(ctx, projectile);
    else if (projectile.visualKind === "fireball") drawFireball(ctx, projectile);
    else if (projectile.visualKind === "microMissile") drawMissileSalvo(ctx, projectile, quality);
    else drawTracer(ctx, projectile, 14, 2.5, "#ffffff");
    ctx.restore();
  }
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
    const gradient = ctx.createLinearGradient(particle.x0, particle.y0, endX, endY);
    gradient.addColorStop(0, `rgba(255,247,214,${1 - progress})`);
    gradient.addColorStop(1, `rgba(251,113,133,${0.08 * (1 - progress)})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(particle.x0, particle.y0);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function drawFlame(ctx, particle, progress, settings) {
  const travelProgress = Math.min(1, progress * (particle.soft ? 0.9 : 1.12));
  const x = particle.x + particle.travel * travelProgress;
  const wave = settings.reduceMotion ? 0 : Math.sin(progress * particle.waveFreq + particle.wavePhase) * particle.waveAmp;
  const y = particle.y + particle.driftY * progress + wave;
  const radius = Math.max(1.5, particle.size * (1 - progress * (particle.soft ? 0.55 : 0.76)));
  const alpha = (particle.soft ? 0.24 : 0.92) * (1 - progress);
  const glow = ctx.createRadialGradient(x, y, radius * 0.16, x, y, radius);
  glow.addColorStop(0, `rgba(${particle.inner},${alpha})`);
  glow.addColorStop(0.42, `rgba(${particle.outer},${alpha * 0.9})`);
  glow.addColorStop(1, `rgba(${particle.outer},0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlameRibbon(ctx, particle, progress) {
  const x = particle.x + particle.travel * progress;
  const alpha = 1 - progress;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = particle.color;
  ctx.shadowBlur = 9;
  ctx.shadowColor = particle.color;
  ctx.globalAlpha = alpha * 0.8;
  ctx.lineWidth = particle.width * alpha;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, particle.y);
  ctx.lineTo(x + particle.length, particle.y);
  ctx.stroke();
}

export function drawParticles(ctx, particles, now, settings = {}) {
  for (const particle of particles) {
    const progress = (now - particle.born) / particle.life;
    if (progress >= 1) continue;
    const seconds = (now - particle.born) / 1000;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    if (particle.kind === "spark" || particle.kind === "snow") {
      const sway = particle.kind === "snow" && !settings.reduceMotion
        ? Math.sin((particle.phase || 0) + seconds * (particle.phaseSpeed || 6)) * (particle.sway || 0)
        : 0;
      const x = particle.x + particle.vx * seconds + sway;
      const y = particle.y + particle.vy * seconds + (particle.gravity || 0) * seconds * seconds / 2;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = particle.kind === "snow" ? 7 : 3;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      if (particle.kind === "snow") ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      else ctx.arc(x, y, particle.size, 0, Math.PI * 2);
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
      ctx.arc(particle.x, particle.y, 5 + progress * (particle.maxRadius || 65), 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === "muzzle") {
      const radius = particle.size * (0.55 + progress * 0.85);
      const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(0.28, particle.color);
      glow.addColorStop(1, "rgba(255,160,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === "smoke") {
      const x = particle.x + particle.vx * seconds;
      const y = particle.y + particle.vy * seconds;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha *= 0.35;
      ctx.beginPath();
      ctx.arc(x, y, particle.size * (0.7 + progress), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === "laser") drawLaser(ctx, particle, progress, settings);
    else if (particle.kind === "shotgun") drawShotgun(ctx, particle, progress);
    else if (particle.kind === "flame") drawFlame(ctx, particle, progress, settings);
    else if (particle.kind === "flameRibbon") drawFlameRibbon(ctx, particle, progress);
    ctx.restore();
  }
  return particles.filter((particle) => now - particle.born < particle.life);
}
