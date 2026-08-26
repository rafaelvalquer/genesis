export const TREE_BROOD_ENEMY_ID = "larvaRaizFerro";

export const TREE_BROOD_CONFIG = Object.freeze({
  fragile: Object.freeze({ chance: .10, maxSpawnsPerTree: 1, rollCooldownMs: 900 }),
  ferrivore: Object.freeze({ chance: .18, maxSpawnsPerTree: 2, rollCooldownMs: 900 }),
  mineralized: Object.freeze({ chance: .24, maxSpawnsPerTree: 3, rollCooldownMs: 900 }),
  spores: Object.freeze({ chance: .20, maxSpawnsPerTree: 2, rollCooldownMs: 900 }),
});

export const TREE_BROOD_PHASE_CONFIG = Object.freeze({
  fase_49: Object.freeze({ enabled: false, maxActiveBroodLarvae: 0 }),
  fase_50: Object.freeze({ enabled: false, maxActiveBroodLarvae: 0 }),
  fase_51: Object.freeze({ enabled: false, maxActiveBroodLarvae: 0 }),
  fase_52: Object.freeze({ enabled: true, maxActiveBroodLarvae: 3 }),
  fase_53: Object.freeze({ enabled: true, maxActiveBroodLarvae: 4 }),
  fase_54: Object.freeze({ enabled: true, maxActiveBroodLarvae: 5 }),
  fase_55: Object.freeze({ enabled: true, maxActiveBroodLarvae: 6 }),
  fase_56: Object.freeze({ enabled: true, maxActiveBroodLarvae: 8 }),
});
