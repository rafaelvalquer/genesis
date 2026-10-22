import { CHAPTER_ONE_BIOME } from "./chapter01Variants.js";
import { CHAPTER_TWO_BIOME } from "./chapter02Glass.js";
import { CHAPTER_THREE_BIOME } from "./chapter03Dunes.js";
import { CHAPTER_FOUR_BIOME } from "./chapter04Highlands.js";
import { CHAPTER_FIVE_BIOME } from "./chapter05Abyss.js";

// Each chapter with a biome battlefield registers a table here:
//
//   plate     how ground plates are drawn: "kit" (tile images) or the name of
//             a procedural plate style (see biomeGround.js)
//   fallback  phase key used when a phase's theme id has no entry
//   phases    variants keyed by battlefieldTheme.id
//
// Phase variant fields ("r,g,b" triplets are used inside rgba(); hex values
// go through tinting):
//
//   tint     hue the ground plates are re-colored to ("color" blend), or null
//   scatter  ground detail kinds picked from at random (repeat to weight them)
//   rail     frame style (see biomeGround.js)
//   vents    floor grates (or style "burrow" holes) with steam, or null
//   lights   rail lights palette and blink style (pulse | strobe | slow), or null
//   sparks   spark bursts from the rails, or null
//   motes    drifting particles rising from the floor, or null
//   glow     glowing ground decals (cracks | runes | veins | spots | eggs), or null
//   sandDrift  streaks of sand or wind blown low across the floor, or absent
//   grassSway  grass tufts swaying (leaning with an active wind current), or absent
//   cloudShadows  large soft shadows drifting across the field, or absent
//   caustics  rippling water light on the floor, or absent
//   bubbles   bubbles rising from the seabed, or absent
//   sheen    diagonal band of light sweeping across the floor, or absent
//   flares   prismatic star flares at fixed spots, or absent
//   weather  extra whole-field effects; rain and lightning take an intensity
//            (true counts as 1)
const BIOMES = Object.freeze({
  chapter_01: CHAPTER_ONE_BIOME,
  chapter_02: CHAPTER_TWO_BIOME,
  chapter_03: CHAPTER_THREE_BIOME,
  chapter_04: CHAPTER_FOUR_BIOME,
  chapter_05: CHAPTER_FIVE_BIOME,
});

// Variants are resolved once per (chapter, theme) and reused every frame.
const resolved = new Map();

export function getBiomeVariant(phase) {
  const table = BIOMES[phase?.chapterId];
  if (!table) return null;
  const themeId = phase.battlefieldTheme?.id;
  const key = `${phase.chapterId}:${themeId}`;
  if (!resolved.has(key)) {
    const entry = table.phases[themeId] || table.phases[table.fallback];
    resolved.set(key, Object.freeze({ ...entry, plate: table.plate }));
  }
  return resolved.get(key);
}

export function hasBiome(chapterId) {
  return Boolean(BIOMES[chapterId]);
}
