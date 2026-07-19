import { FIELD, VIEWPORT } from "./battleModel.js";

const QUALITY_SCALE = { low: 1, medium: 1.5, high: 2 };
const DECAL_LIMIT = { low: 28, medium: 64, high: 110 };
const DEATH_LIFE = { enemy: 480, troop: 560 };
const PULSE_BEAM_LIFE = 360;
const DISINTEGRATION_LIFE = 420;
const PULSE_SCORCH_LIFE = 6000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRenderScale(settings = {}, devicePixelRatio = 1) {
  return Math.min(Math.max(1, Number(devicePixelRatio) || 1), QUALITY_SCALE[settings.quality] || 2);
}

export function configureHiDPICanvas(canvas, settings = {}, devicePixelRatio = 1) {
  const scale = getRenderScale(settings, devicePixelRatio);
  const width = Math.round(VIEWPORT.width * scale);
  const height = Math.round(VIEWPORT.height * scale);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.dataset.renderScale = String(scale);
  return scale;
}

export function createGraphicsRuntime() {
  return {
    hits: new Map(), deaths: [], decals: [], lights: [], deployments: [],
    pulseBeams: [], disintegrations: [], pulseScorches: [],
    containmentArcs: [], containmentInterferenceUntil: 0,
    camera: { amplitude: 0, seed: 1, startedAt: 0 },
    health: new Map(), metrics: { fps: 60, frameMs: 16.7, particles: 0, decals: 0, visualEntities: 0 },
  };
}

function eventShake(type) {
  return ({ hit: 0.5, shieldHit: 0.35, shieldBreak: 1.4, troopHit: 1.2, projectileImpact: 1, fireImpact: 1.8, iceImpact: 1.5,
    explosion: 5, breach: 7, enemyDeath: 2, troopDeath: 3.5, bossPhase: 8, bossDeath: 12, tileImpact: 4,
    pulseFired: 9, enemyDisintegrated: 1.5 })[type] || 0;
}

function lightFor(event, now) {
  const values = {
    shoot: { radius: 48, life: 100 }, beam: { radius: 110, life: 170 }, fireImpact: { radius: 76, life: 260 },
    iceImpact: { radius: 72, life: 300 }, energyGenerated: { radius: 92, life: 460 },
    explosion: { radius: 135, life: 420 }, bossPhase: { radius: 220, life: 650 },
    echoSpawn: { radius: 88, life: 520 }, prismaticPulse: { radius: 180, life: 760 },
    shieldBreak: { radius: 70, life: 360 }, tileImpact: { radius: event.lightRadius || 100, life: 330 },
    pulseCharging: { radius: 96, life: 420 }, pulseFired: { radius: 210, life: 420 },
  }[event.type];
  if (!values) return null;
  return { x: event.x ?? event.x0 ?? 0, y: event.y ?? event.y0 ?? 0, color: event.color || "#f8fafc", born: now, ...values };
}

function decalFor(event, now) {
  const kind = ({ projectileImpact: "bullet", fireImpact: "scorch", iceImpact: "frost", explosion: "crater", tileImpact: "crater", troopDeath: "debris", enemyDeath: "stain" })[event.type];
  if (!kind) return null;
  return { kind, x: event.x, y: event.y + (kind === "stain" ? 25 : 18), born: now, seed: event.seed || Math.round(event.x * 17 + event.y * 31), color: event.color };
}

export function consumeGraphicsEvents(runtime, events, now, settings = {}) {
  for (const event of events) {
    const shake = event.shake ?? eventShake(event.type);
    if (settings.cameraShake && !settings.reduceMotion && shake > 0) {
      runtime.camera.amplitude = Math.max(runtime.camera.amplitude, shake);
      runtime.camera.seed = (event.seed || runtime.camera.seed + 97) >>> 0;
      runtime.camera.startedAt = now;
    }
    if (["hit", "shieldHit", "shieldBreak", "troopHit"].includes(event.type) && event.targetId) {
      runtime.hits.set(event.targetId, { born: now, life: 170, direction: event.type === "hit" ? -1 : 1 });
    }
    if ((event.type === "enemyDeath" || event.type === "bossDeath") && event.entity) {
      runtime.deaths.push({ kind: "enemy", entity: { ...event.entity }, born: now, life: event.type === "bossDeath" ? 900 : DEATH_LIFE.enemy });
    }
    if (event.type === "enemyDisintegrated" && event.entity) {
      runtime.disintegrations.push({
        entity: { ...event.entity },
        born: now,
        life: DISINTEGRATION_LIFE,
        seed: event.entity.id?.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) || 1,
      });
    }
    if (event.type === "pulseFired") {
      runtime.pulseBeams.push({ ...event, born: now, life: PULSE_BEAM_LIFE });
      let seed = Number(event.seed) || 1;
      for (let index = 0; index < 8; index += 1) {
        seed = (Math.imul(seed ^ seed >>> 15, seed | 1) + 0x6d2b79f5) >>> 0;
        const random = seed / 4294967296;
        runtime.pulseScorches.push({
          row: event.row,
          x: event.x0 + 90 + random * Math.max(80, event.x1 - event.x0 - 150),
          y: event.y0 + 27 + ((index % 3) - 1) * 5,
          born: now,
          life: PULSE_SCORCH_LIFE,
          seed: seed + index,
        });
      }
    }
    if (event.type === "troopDeath" && event.entity) {
      runtime.deaths.push({ kind: "troop", entity: { ...event.entity }, born: now, life: DEATH_LIFE.troop });
    }
    if (event.type === "deploy") runtime.deployments.push({ kind: "deploy", x: event.x, y: event.y, born: now, life: 520 });
    if (event.type === "remove") runtime.deployments.push({ kind: "remove", x: event.x, y: event.y, born: now, life: 380 });
    if (event.type === "waveStart") runtime.deployments.push({ kind: "wave", x: FIELD.width - 42, y: FIELD.height / 2, born: now, life: 780 });
    if (event.type === "spawn") {
      runtime.containmentArcs.push({
        row: event.enemy?.row ?? 0,
        x: clamp(event.x ?? event.enemy?.x ?? FIELD.width - 32, 24, FIELD.width - 24),
        born: now,
        life: event.enemy?.variant === "alpha" ? 900 : 460,
        alpha: event.enemy?.variant === "alpha",
      });
      if (event.enemy?.variant === "alpha") runtime.containmentInterferenceUntil = Math.max(runtime.containmentInterferenceUntil, now + 1100);
    }
    if (event.type === "bossPhase") runtime.containmentInterferenceUntil = Math.max(runtime.containmentInterferenceUntil, now + 1250);
    if (event.type === "spawn" && event.enemy?.variant === "alpha") {
      runtime.camera.amplitude = settings.cameraShake && !settings.reduceMotion ? 10 : 0;
      runtime.camera.startedAt = now;
      runtime.lights.push({ x: event.enemy.x, y: event.enemy.y, color: "#f43f5e", born: now, radius: 260, life: 900 });
    }
    const light = lightFor(event, now);
    if (light) runtime.lights.push(light);
    const decal = decalFor(event, now);
    if (decal) runtime.decals.push(decal);
  }
  const decalLimit = DECAL_LIMIT[settings.quality] || DECAL_LIMIT.high;
  if (runtime.decals.length > decalLimit) runtime.decals.splice(0, runtime.decals.length - decalLimit);
  runtime.lights = runtime.lights.slice(-40);
  runtime.deaths = runtime.deaths.slice(-32);
  runtime.disintegrations = runtime.disintegrations.slice(-80);
  runtime.pulseBeams = runtime.pulseBeams.slice(-8);
  runtime.pulseScorches = runtime.pulseScorches.slice(-48);
  runtime.deployments = runtime.deployments.slice(-24);
  runtime.containmentArcs = runtime.containmentArcs.slice(-18);
}

export function updateGraphicsRuntime(runtime, now, frameMs, counts = {}) {
  runtime.hits.forEach((value, key) => { if (now - value.born >= value.life) runtime.hits.delete(key); });
  runtime.deaths = runtime.deaths.filter((entry) => now - entry.born < entry.life);
  runtime.disintegrations = runtime.disintegrations.filter((entry) => now - entry.born < entry.life);
  runtime.pulseBeams = runtime.pulseBeams.filter((entry) => now - entry.born < entry.life);
  runtime.pulseScorches = runtime.pulseScorches.filter((entry) => now - entry.born < entry.life);
  runtime.lights = runtime.lights.filter((entry) => now - entry.born < entry.life);
  runtime.deployments = runtime.deployments.filter((entry) => now - entry.born < entry.life);
  runtime.containmentArcs = runtime.containmentArcs.filter((entry) => now - entry.born < entry.life);
  runtime.camera.amplitude *= Math.pow(0.004, frameMs / 1000);
  if (runtime.camera.amplitude < 0.05) runtime.camera.amplitude = 0;
  const instantFps = frameMs > 0 ? 1000 / frameMs : 60;
  runtime.metrics.fps += (instantFps - runtime.metrics.fps) * 0.08;
  runtime.metrics.frameMs += (frameMs - runtime.metrics.frameMs) * 0.08;
  Object.assign(runtime.metrics, counts, {
    decals: runtime.decals.length + runtime.pulseScorches.length,
    visualEntities: runtime.deaths.length + runtime.disintegrations.length + runtime.pulseBeams.length,
  });
}

export function getCameraOffset(runtime, now, settings = {}) {
  if (!settings.cameraShake || settings.reduceMotion || runtime.camera.amplitude <= 0) return { x: 0, y: 0 };
  const t = (now - runtime.camera.startedAt) / 16.6667;
  const amplitude = runtime.camera.amplitude;
  return {
    x: Math.sin(t * 2.17 + runtime.camera.seed) * amplitude,
    y: Math.cos(t * 2.83 + runtime.camera.seed * 0.7) * amplitude * 0.65,
  };
}

export function getHitReaction(runtime, entityId, now) {
  const hit = runtime.hits.get(entityId);
  if (!hit) return { offsetX: 0, flash: 0 };
  const progress = clamp((now - hit.born) / hit.life, 0, 1);
  return { offsetX: Math.sin(progress * Math.PI) * 5 * hit.direction, flash: Math.sin(progress * Math.PI) };
}

export function getHealthVisual(runtime, entity, now) {
  const ratio = clamp(entity.hp / entity.maxHp, 0, 1);
  const previous = runtime.health.get(entity.id) || { ratio, trail: ratio, updatedAt: now };
  if (ratio < previous.ratio) {
    previous.trail = previous.ratio;
    previous.updatedAt = now;
  }
  previous.ratio = ratio;
  const progress = clamp((now - previous.updatedAt) / 480, 0, 1);
  previous.trail += (ratio - previous.trail) * progress;
  runtime.health.set(entity.id, previous);
  return { ratio, trail: Math.max(ratio, previous.trail) };
}

export function interpolateEntity(entity, alpha) {
  const previousX = Number.isFinite(entity.previousRenderX) ? entity.previousRenderX : entity.x;
  const previousY = Number.isFinite(entity.previousRenderY) ? entity.previousRenderY : entity.y;
  return { ...entity, x: previousX + (entity.x - previousX) * alpha, y: previousY + (entity.y - previousY) * alpha };
}

export function colorModeFilter(mode) {
  if (mode === "protanopia") return "saturate(.82) contrast(1.06) hue-rotate(7deg)";
  if (mode === "deuteranopia") return "saturate(.78) contrast(1.08) hue-rotate(16deg)";
  if (mode === "contrast") return "contrast(1.2) saturate(1.12)";
  return "none";
}
