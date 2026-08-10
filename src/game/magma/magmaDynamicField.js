import { CELL } from "../visualGeometry.js";
import { pointIsInsideMagmaRegion } from "./magmaRegionBuilder.js";

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function lifeEnvelope(feature, visualTimeMs) {
  const duration = Math.max(1, feature.deathAt - feature.birthAt);
  const progress = (visualTimeMs - feature.birthAt) / duration;
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.18) return smooth(progress / 0.18);
  if (progress > 0.72) return smooth((1 - progress) / 0.28);
  return 1;
}

function pointInRegion(region, random, inset = 10) {
  const cell = region.cells[Math.floor(random() * region.cells.length)]
    || region.cells[0]
    || [0, 0];
  return {
    x: cell[1] * CELL.width + inset + random() * Math.max(1, CELL.width - inset * 2),
    y: cell[0] * CELL.height + inset + random() * Math.max(1, CELL.height - inset * 2),
  };
}

function lifespan(random, minimum, spread) {
  return minimum + random() * spread;
}

function createLocalCurrent(region, random, now, initial = false) {
  const point = pointInRegion(region, random, 8);
  const life = lifespan(random, 7500, 7500);
  const birthAt = initial ? now - random() * life * 0.68 : now;
  const angle = Math.PI + (random() - 0.5) * 0.72;
  return {
    id: `${region.id}-current-${Math.floor(random() * 0x7fffffff)}`,
    x: point.x,
    y: point.y,
    radiusX: 72 + random() * 118,
    radiusY: 30 + random() * 54,
    directionX: Math.cos(angle),
    directionY: Math.sin(angle),
    strength: 5 + random() * 14,
    phase: random() * TAU,
    phaseSpeed: 0.35 + random() * 0.72,
    birthAt,
    peakAt: birthAt + life * 0.28,
    deathAt: birthAt + life,
  };
}

function createVortex(region, random, now, initial = false) {
  const point = pointInRegion(region, random, 14);
  const life = lifespan(random, 9000, 9000);
  const birthAt = initial ? now - random() * life * 0.62 : now;
  return {
    id: `${region.id}-vortex-${Math.floor(random() * 0x7fffffff)}`,
    x: point.x,
    y: point.y,
    radius: 46 + random() * 74,
    strength: (random() > 0.5 ? 1 : -1) * (5 + random() * 10),
    pulsePhase: random() * TAU,
    birthAt,
    peakAt: birthAt + life * 0.32,
    deathAt: birthAt + life,
  };
}

function createCrustPatch(region, random, now, initial = false) {
  const point = pointInRegion(region, random, 12);
  const life = lifespan(random, 12000, 11000);
  const birthAt = initial ? now - random() * life * 0.85 : now;
  return {
    id: `${region.id}-crust-${Math.floor(random() * 0x7fffffff)}`,
    x: point.x,
    y: point.y,
    radiusX: 28 + random() * 58,
    radiusY: 16 + random() * 34,
    rotation: (random() - 0.5) * 0.8,
    strength: 0.12 + random() * 0.16,
    crackAngle: random() * TAU,
    crackFrequency: 0.085 + random() * 0.07,
    birthAt,
    peakAt: birthAt + life * 0.35,
    deathAt: birthAt + life,
  };
}

function createHotspot(region, random, now, initial = false) {
  const point = pointInRegion(region, random, 16);
  const life = lifespan(random, 5500, 6500);
  const birthAt = initial ? now - random() * life * 0.55 : now;
  return {
    id: `${region.id}-hotspot-${Math.floor(random() * 0x7fffffff)}`,
    x: point.x,
    y: point.y,
    radius: 14 + random() * 28,
    strength: 0.1 + random() * 0.19,
    drift: (random() - 0.5) * 8,
    birthAt,
    peakAt: birthAt + life * 0.24,
    deathAt: birthAt + life,
  };
}

function transientVentType(random) {
  const value = random();
  if (value < 0.45) return "bubblePop";
  if (value < 0.72) return "spatter";
  if (value < 0.93) return "ventJet";
  return "crustBurst";
}

function createTransientVent(region, random, now) {
  const point = pointInRegion(region, random, 18);
  const life = 1500 + random() * 1300;
  return {
    id: `${region.id}-transient-${Math.floor(random() * 0x7fffffff)}`,
    x: point.x,
    y: point.y,
    radius: 5 + random() * 7,
    strength: 0.58 + random() * 0.42,
    type: transientVentType(random),
    transient: true,
    seed: Math.floor(random() * 0x7fffffff),
    birthAt: now,
    peakAt: now + life * 0.58,
    deathAt: now + life,
    periodMs: life,
    phaseMs: -now,
  };
}

function regionalCount(region, minimum, maximum, divisor) {
  return Math.max(minimum, Math.min(maximum, Math.round(region.bounds.width / divisor)));
}

export function createMagmaDynamicRegion(region, random, visualTimeMs = 0) {
  const currentCount = regionalCount(region, 6, 12, 115);
  const vortexCount = regionalCount(region, 2, 5, 260);
  const patchCount = regionalCount(region, 4, 8, 170);
  const hotspotCount = regionalCount(region, 3, 6, 210);
  return {
    localCurrents: Array.from(
      { length: currentCount },
      () => createLocalCurrent(region, random, visualTimeMs, true),
    ),
    vortices: Array.from(
      { length: vortexCount },
      () => createVortex(region, random, visualTimeMs, true),
    ),
    crustPatches: Array.from(
      { length: patchCount },
      () => createCrustPatch(region, random, visualTimeMs, true),
    ),
    hotspots: Array.from(
      { length: hotspotCount },
      () => createHotspot(region, random, visualTimeMs, true),
    ),
    transientVents: [],
    nextTransientVentAt: visualTimeMs + 900 + random() * 1700,
    targetCounts: { currentCount, vortexCount, patchCount, hotspotCount },
  };
}

function replenish(list, target, factory, region, random, now) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].deathAt <= now) list.splice(index, 1);
  }
  while (list.length < target) list.push(factory(region, random, now, false));
}

const transientTargets = { stable: 1, active: 2, eruption: 3, cooldown: 0 };
const transientIntervals = {
  stable: [3200, 3400],
  active: [1500, 2200],
  eruption: [650, 1050],
  cooldown: [8000, 4000],
};

export function updateMagmaDynamicRegion(
  dynamic,
  region,
  runtime,
  options,
  deltaMs,
  random,
) {
  const now = runtime.visualTimeMs;
  const enteringCooldown = runtime.thermalState !== "cooldown"
    && options.thermalState === "cooldown";
  if (enteringCooldown) {
    const features = [
      dynamic.localCurrents,
      dynamic.vortices,
      dynamic.crustPatches,
      dynamic.hotspots,
      dynamic.transientVents,
    ];
    for (const list of features) {
      for (const feature of list) {
        feature.deathAt = Math.min(feature.deathAt, now + 2500 + random() * 2500);
      }
    }
  }
  const thermalScale = options.thermalState === "eruption"
    ? 1.3
    : options.thermalState === "active"
      ? 1.12
      : options.thermalState === "cooldown"
        ? 0.72
        : 1;
  replenish(
    dynamic.localCurrents,
    Math.max(3, Math.round(dynamic.targetCounts.currentCount * thermalScale)),
    createLocalCurrent,
    region,
    random,
    now,
  );
  replenish(
    dynamic.vortices,
    Math.max(1, Math.round(dynamic.targetCounts.vortexCount * thermalScale)),
    createVortex,
    region,
    random,
    now,
  );
  replenish(
    dynamic.crustPatches,
    dynamic.targetCounts.patchCount,
    createCrustPatch,
    region,
    random,
    now,
  );
  replenish(
    dynamic.hotspots,
    Math.max(2, Math.round(dynamic.targetCounts.hotspotCount * thermalScale)),
    createHotspot,
    region,
    random,
    now,
  );

  const seconds = deltaMs / 1000;
  const advectionScale = Math.max(0, options.flowMultiplier ?? 1);
  const flowX = runtime.currentFlowVector.x * seconds;
  const flowY = runtime.currentFlowVector.y * seconds;
  for (const current of dynamic.localCurrents) {
    current.x += flowX * 0.08;
    current.y += flowY * 0.08;
  }
  for (const vortex of dynamic.vortices) {
    vortex.x += flowX * 0.04;
    vortex.y += flowY * 0.04;
  }
  for (const patch of dynamic.crustPatches) {
    patch.x += flowX * 0.025;
    patch.y += flowY * 0.025;
  }
  for (const hotspot of dynamic.hotspots) {
    const local = sampleLocalCurrents(hotspot.x, hotspot.y, dynamic.localCurrents, now);
    hotspot.x += (
      runtime.currentFlowVector.x * 0.48 + local.x * 0.34 * advectionScale
    ) * seconds;
    hotspot.y += (
      runtime.currentFlowVector.y * 0.48
      + (local.y * 0.34 + hotspot.drift) * advectionScale
    ) * seconds;
    if (!pointIsInsideMagmaRegion(
      region,
      hotspot.x,
      hotspot.y,
      region.cellWidth || CELL.width,
      region.cellHeight || CELL.height,
    )) hotspot.deathAt = now;
  }

  for (let index = dynamic.transientVents.length - 1; index >= 0; index -= 1) {
    if (dynamic.transientVents[index].deathAt <= now) dynamic.transientVents.splice(index, 1);
  }
  const target = transientTargets[options.thermalState] ?? transientTargets.stable;
  if (target > 0 && dynamic.transientVents.length < target && now >= dynamic.nextTransientVentAt) {
    dynamic.transientVents.push(createTransientVent(region, random, now));
    const [minimum, spread] = transientIntervals[options.thermalState] || transientIntervals.stable;
    dynamic.nextTransientVentAt = now + minimum + random() * spread;
  }
}

export function sampleLocalCurrents(worldX, worldY, currents = [], visualTimeMs = 0) {
  let x = 0;
  let y = 0;
  for (const current of currents) {
    const dx = (worldX - current.x) / current.radiusX;
    const dy = (worldY - current.y) / current.radiusY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= 1) continue;
    const influence = smooth(1 - distanceSquared) * lifeEnvelope(current, visualTimeMs);
    const pulse = 0.72 + Math.sin(
      visualTimeMs * 0.001 * current.phaseSpeed + current.phase,
    ) * 0.28;
    x += current.directionX * current.strength * influence * pulse;
    y += current.directionY * current.strength * influence * pulse;
  }
  return { x, y };
}

export function sampleVortices(worldX, worldY, vortices = [], visualTimeMs = 0) {
  let x = 0;
  let y = 0;
  for (const vortex of vortices) {
    const dx = worldX - vortex.x;
    const dy = worldY - vortex.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= vortex.radius || distance < 0.001) continue;
    const influence = smooth(1 - distance / vortex.radius)
      * lifeEnvelope(vortex, visualTimeMs)
      * (0.8 + Math.sin(visualTimeMs * 0.00055 + vortex.pulsePhase) * 0.2);
    const tangentX = -dy / distance;
    const tangentY = dx / distance;
    x += tangentX * vortex.strength * influence;
    y += tangentY * vortex.strength * influence;
  }
  return { x, y };
}

export function sampleCrustPatches(worldX, worldY, patches = [], visualTimeMs = 0) {
  let heatDelta = 0;
  let crackHeat = 0;
  for (const patch of patches) {
    const cosine = Math.cos(patch.rotation);
    const sine = Math.sin(patch.rotation);
    const rawX = worldX - patch.x;
    const rawY = worldY - patch.y;
    const rotatedX = rawX * cosine - rawY * sine;
    const rotatedY = rawX * sine + rawY * cosine;
    const dx = rotatedX / patch.radiusX;
    const dy = rotatedY / patch.radiusY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= 1) continue;
    const duration = Math.max(1, patch.deathAt - patch.birthAt);
    const progress = clamp01((visualTimeMs - patch.birthAt) / duration);
    const mask = smooth(1 - distanceSquared);
    const forming = progress < 0.2 ? smooth(progress / 0.2) : 1;
    const melting = progress > 0.76 ? smooth((1 - progress) / 0.24) : 1;
    heatDelta -= patch.strength * mask * forming * melting;
    if (progress > 0.54 && progress < 0.84) {
      const alongCrack = Math.abs(
        Math.sin(
          (rotatedX * Math.cos(patch.crackAngle) + rotatedY * Math.sin(patch.crackAngle))
          * patch.crackFrequency,
        ),
      );
      const crack = smooth((0.15 - alongCrack) / 0.15);
      const breakEnvelope = Math.sin((progress - 0.54) / 0.3 * Math.PI);
      crackHeat += crack * mask * breakEnvelope * patch.strength * 1.45;
    }
  }
  return { heatDelta, crackHeat };
}

export function sampleHotspots(worldX, worldY, hotspots = [], visualTimeMs = 0) {
  let heat = 0;
  for (const hotspot of hotspots) {
    const dx = worldX - hotspot.x;
    const dy = worldY - hotspot.y;
    const distanceSquared = (dx * dx + dy * dy) / (hotspot.radius * hotspot.radius);
    if (distanceSquared >= 1) continue;
    heat += smooth(1 - distanceSquared)
      * hotspot.strength
      * lifeEnvelope(hotspot, visualTimeMs);
  }
  return Math.min(0.42, heat);
}

export function sampleMagmaDynamicField(
  worldX,
  worldY,
  dynamic,
  visualTimeMs,
) {
  if (!dynamic) {
    return {
      offsetX: 0,
      offsetY: 0,
      crustHeatDelta: 0,
      crackHeat: 0,
      hotspotHeat: 0,
    };
  }
  const current = sampleLocalCurrents(
    worldX,
    worldY,
    dynamic.localCurrents,
    visualTimeMs,
  );
  const vortex = sampleVortices(worldX, worldY, dynamic.vortices, visualTimeMs);
  const crust = sampleCrustPatches(
    worldX,
    worldY,
    dynamic.crustPatches,
    visualTimeMs,
  );
  return {
    offsetX: current.x + vortex.x,
    offsetY: current.y + vortex.y,
    crustHeatDelta: crust.heatDelta,
    crackHeat: crust.crackHeat,
    hotspotHeat: sampleHotspots(worldX, worldY, dynamic.hotspots, visualTimeMs),
  };
}

export function getMagmaFeatureEnvelope(feature, visualTimeMs) {
  return lifeEnvelope(feature, visualTimeMs);
}
