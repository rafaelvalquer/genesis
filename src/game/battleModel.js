// Public compatibility facade for the battle simulation.
// Keep external consumers importing this module while implementation modules
// live under ./battle.
export * from "./battle/engine.js";
