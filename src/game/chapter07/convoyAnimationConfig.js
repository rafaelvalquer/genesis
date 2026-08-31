export const CONVOY_ANIMATION_CONFIG = Object.freeze({
  idle: Object.freeze({ frames: 8, frameDuration: 150, loop: true }),
  energy_spawn: Object.freeze({ frames: 10, frameDuration: 90, loop: false }),
});

export const CONVOY_ANIMATION_STATES = Object.freeze(Object.keys(CONVOY_ANIMATION_CONFIG));
export const CONVOY_ENERGY_SPAWN_DURATION_MS = CONVOY_ANIMATION_CONFIG.energy_spawn.frames * CONVOY_ANIMATION_CONFIG.energy_spawn.frameDuration;
export const CONVOY_DEFEAT_RESULT_DELAY_MS = 500;
export const CONVOY_VISUAL_CONFIG = Object.freeze({
  energyEmitter: Object.freeze({ offsetX: 18, offsetY: -38 }),
});
