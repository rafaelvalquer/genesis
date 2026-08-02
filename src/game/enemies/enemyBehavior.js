/**
 * Stable behavior contract used by the battle model.  Keeping the no-op
 * implementation here means every registry entry is complete and makes new
 * enemy modules safe to add incrementally.
 */
export const GENERIC_ENEMY_BEHAVIOR = Object.freeze({
  createState: () => ({}),
  onSpawn: () => {},
  update: () => false,
  selectTarget: () => null,
  attack: () => false,
  receiveDamage: () => undefined,
  onDeath: () => {},
});

export function enemyBehavior(overrides = {}) {
  return Object.freeze({ ...GENERIC_ENEMY_BEHAVIOR, ...overrides });
}
