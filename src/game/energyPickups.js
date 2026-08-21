import { isSystemEnabledForPhase } from "./phaseRules.js";
import { ENEMIES } from "./content.js";

export const ENERGY_PICKUP_LIFETIME_MS = 10000;
export const ENERGY_PICKUP_MAGNET_RADIUS = 140;
export const ENERGY_PICKUP_COLLECT_RADIUS = 24;

let pickupId = 1;
const nextPickupId = () => `energy_pickup_${pickupId++}`;

export function spawnEnergyPickup(session, options = {}, events = []) {
  if (!session?.energyPickups) return null;
  const pickup = {
    id: nextPickupId(),
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    vx: Number(options.initialVx) || 0,
    vy: Number(options.initialVy) || 0,
    amount: Math.max(1, Number(options.amount) || 1),
    ageMs: 0,
    phase: Number.isFinite(options.phase) ? options.phase : (session.rng?.() || 0) * Math.PI * 2,
    sourceKind: options.sourceKind || "enemy",
    sourceTroopId: options.sourceTroopId || null,
    sourceEnemyId: options.sourceEnemyId || null,
    sourceConvoyId: options.sourceConvoyId || null,
  };
  session.energyPickups.push(pickup);
  events.push({
    type: "energyDropSpawned", x: pickup.x, y: pickup.y,
    amount: pickup.amount, color: "#fbbf24", sourceKind: pickup.sourceKind,
    sourceTroopId: pickup.sourceTroopId, sourceEnemyId: pickup.sourceEnemyId,
    sourceConvoyId: pickup.sourceConvoyId,
  });
  return pickup;
}

export function trySpawnEnemyEnergyPickup(session, source, events = []) {
  if (!isSystemEnabledForPhase(session.phase, "enemyEnergyPickups")) return null;
  const chance = ENEMIES[source?.type]?.energyDropChance;
  if (!chance || source.variant === "alpha") return null;
  const roll = session.rng();
  if (roll >= chance) return null;
  return spawnEnergyPickup(session, {
    x: source.x, y: source.y - 28, amount: 1,
    phase: roll * Math.PI * 2, sourceKind: "enemy", sourceEnemyId: source.id,
  }, events);
}

export function setEnergyPickupPointer(session, point) {
  if (!session) return false;
  session.energyPickupPointer = point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: point.x, y: point.y } : null;
  return true;
}

export function updateEnergyPickups(session, dt, events = [], { freezeLifetime = false } = {}) {
  if (session.pendingDecision || !session.energyPickups.length) return;
  const pointer = session.energyPickupPointer;
  const dtSeconds = Math.max(0, dt) / 1000;
  const remaining = [];
  for (const pickup of session.energyPickups) {
    if (!freezeLifetime) pickup.ageMs += Math.max(0, dt);
    if (pickup.ageMs >= ENERGY_PICKUP_LIFETIME_MS) continue;
    if (pointer) {
      const dx = pointer.x - pickup.x;
      const dy = pointer.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= ENERGY_PICKUP_MAGNET_RADIUS && distance > 0.001) {
        const attraction = 520 + (1 - distance / ENERGY_PICKUP_MAGNET_RADIUS) * 780;
        pickup.vx += dx / distance * attraction * dtSeconds;
        pickup.vy += dy / distance * attraction * dtSeconds;
        const speed = Math.hypot(pickup.vx, pickup.vy);
        if (speed > 390) { pickup.vx = pickup.vx / speed * 390; pickup.vy = pickup.vy / speed * 390; }
      } else {
        const damping = Math.exp(-4.5 * dtSeconds);
        pickup.vx *= damping; pickup.vy *= damping;
      }
    } else {
      const damping = Math.exp(-4.5 * dtSeconds);
      pickup.vx *= damping; pickup.vy *= damping;
    }
    pickup.x += pickup.vx * dtSeconds;
    pickup.y += pickup.vy * dtSeconds;
    const collectionDistance = pointer ? Math.hypot(pointer.x - pickup.x, pointer.y - pickup.y) : Infinity;
    if (collectionDistance <= ENERGY_PICKUP_COLLECT_RADIUS && session.energy < session.energyMax) {
      const amount = Math.min(pickup.amount, session.energyMax - session.energy);
      session.energy += amount;
      session.lastEnergyGainAt = session.elapsed;
      events.push({ type: "energyCollected", x: pickup.x, y: pickup.y, amount, sourceKind: pickup.sourceKind, color: "#fbbf24" });
      continue;
    }
    remaining.push(pickup);
  }
  session.energyPickups = remaining;
}
