import { CELL, FIELD } from "../visualGeometry.js";
import { chapterFourAlphaMultipliers } from "../chapterFourEnemies.js";
import { ENEMY_BEHAVIORS, getEnemyBehavior } from "./enemyRegistry.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Creates the state all enemies share, independent from their behavior. */
export function createBaseEnemy(session, queued, config, createId) {
  const alpha = queued.variant === "alpha" && config.allowAlphaVariant !== false;
  const alphaModifiers = alpha && queued.alphaModifiers;
  const echo = Boolean(queued.isEcho);
  const mechanic = session.phase.chapterMechanic;
  const chapterFourAlpha = alpha ? chapterFourAlphaMultipliers(queued.type) : null;
  const alphaHpFactor = alphaModifiers?.hpMultiplier ?? chapterFourAlpha?.hp ?? (alpha ? 8 : 1);
  const alphaDamageFactor = alphaModifiers?.damageMultiplier ?? chapterFourAlpha?.damage ?? (alpha ? 2 : 1);
  const alphaSpeedFactor = alphaModifiers?.speedMultiplier ?? chapterFourAlpha?.speed ?? (alpha ? 0.75 : 1);
  const alphaScaleFactor = alphaModifiers?.scaleMultiplier ?? chapterFourAlpha?.scale ?? (alpha ? 1.45 : 1);
  const echoHpFactor = echo ? mechanic?.hpFactor ?? 0.45 : 1;
  const echoSpeedFactor = echo ? mechanic?.speedFactor ?? 1.2 : 1;
  const echoDamageFactor = echo ? mechanic?.damageFactor ?? 0.6 : 1;
  const maxHp = config.hp * alphaHpFactor * echoHpFactor * (session.sandboxSettings?.enemyHpMultiplier ?? 1);
  const row = Number.isInteger(queued.row) ? clamp(queued.row, 0, FIELD.rows - 1) : Math.floor(session.rng() * FIELD.rows);
  const x = Number.isFinite(queued.x)
    ? queued.x
    : FIELD.spawnX + (queued.xOffsetTiles || 0) * CELL.width + (queued.formationOffsetPx || 0);
  const enemy = {
    id: createId("enemy"), type: queued.type, variant: alpha ? "alpha" : undefined, isEcho: echo,
    echoSourceId: queued.echoSourceId || null, row, x, y: row * CELL.height + CELL.height / 2,
    spawnedAt: session.elapsed, packetId: queued.packetId || null, spawnBlock: queued.block || null, spawnSource: queued.spawnSource || "wave",
    hp: maxHp, maxHp, speed: config.speed * alphaSpeedFactor * echoSpeedFactor,
    damage: config.damage * alphaDamageFactor * echoDamageFactor,
    attackReadyAt: 0, lastAttackAt: -Infinity, casting: false, castStartedAt: -Infinity,
    castReadyAt: Infinity, moving: !config.stationary, jumpConsumed: false, jumping: false,
    jumpStartedAt: -Infinity, jumpProgress: 0, jumpFromX: null, jumpTargetTroopId: null,
    attachedToTroopId: null, slowUntil: 0, slowFactor: 1, stunnedUntil: 0,
    emergeState: null, emergeStartedAt: -Infinity, emergeEndsAt: -Infinity,
    bossPhase: config.id === "scarabEmperor" ? 1 : 0, shield: 0, shieldMax: 0,
    lastShieldPulseAt: -Infinity, structuralRuptureHits: 0, structuralRuptured: false,
    structuralRuptureAppliedAt: null, structuralRuptureDamageTakenFactor: 1,
    meleeAttackPending: false, meleeAttackStartedAt: -Infinity, meleeImpactAt: Infinity,
    meleeTargetId: null, sprintUntil: 0, sprintCooldownUntil: 0, lastSprintCellKey: null,
    queenGuardOwnerId: queued.queenGuardOwnerId || null, eggOwnerId: queued.eggOwnerId || null,
    ramState: queued.type === "ramBeetle" ? "walking" : null,
    ramStateStartedAt: queued.type === "ramBeetle" ? session.elapsed : -Infinity,
    ramStateEndsAt: Infinity, ramIdleMode: null, ramChargeConsumed: false, ramChargeTargetId: null,
    ramChargeEndX: null, ramAttackPending: false, ramAttackImpactAt: Infinity, ramAttackTargetId: null,
    summoned: Boolean(queued.summoned), summonerId: queued.summonerId || null,
    baseDamage: (alphaModifiers ? config.baseDamage * alphaDamageFactor : (alpha ? 40 : config.baseDamage)) * echoDamageFactor,
    scale: config.scale * alphaScaleFactor * (echo ? 0.94 : 1), previousRenderX: x,
    previousRenderY: row * CELL.height + CELL.height / 2, dead: false,
  };
  return enemy;
}

export function createEnemyEntity(session, queued, config, createId) {
  const behavior = getEnemyBehavior(queued.type);
  const enemy = {
    ...createBaseEnemy(session, queued, config, createId),
    ...behavior.createState(session, queued, config),
  };
  behavior.onSpawn(session, enemy, config);
  return { enemy, behavior, registry: ENEMY_BEHAVIORS };
}
