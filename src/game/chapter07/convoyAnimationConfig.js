export const CONVOY_ANIMATION_CONFIG = Object.freeze({
  idle: Object.freeze({ frames: 6, frameDuration: 160, loop: true }),
  run: Object.freeze({ frames: 8, frameDuration: 80, loop: true }),
  destroyed_transition: Object.freeze({ frames: 10, frameDuration: 120, loop: false }),
  destroyed_loop: Object.freeze({ frames: 6, frameDuration: 180, loop: true }),
});

export const CONVOY_ANIMATION_STATES = Object.freeze(Object.keys(CONVOY_ANIMATION_CONFIG));
export const CONVOY_DESTROYED_TRANSITION_MS = CONVOY_ANIMATION_CONFIG.destroyed_transition.frames * CONVOY_ANIMATION_CONFIG.destroyed_transition.frameDuration;
export const CONVOY_DESTROYED_HOLD_MS = 400;
export const CONVOY_DEFEAT_RESULT_DELAY_MS = CONVOY_DESTROYED_TRANSITION_MS + CONVOY_DESTROYED_HOLD_MS;
