export const GENESIS_MOON_PRIORITY = Object.freeze([
  "GenesisMoon_RingedRoot",
  "GenesisMoon_BlueRoot",
  "GenesisMoon_LavaRoot",
  "GenesisMoon_RockyRoot",
  "GenesisMoon_RedRoot",
]);

export const GENESIS_PLANET_PRESENTATION = Object.freeze({
  high: Object.freeze({
    relief: Object.freeze({
      GenesisWorld_CrystalSpires: .52,
      GenesisWorld_SwampPods: .58,
    }),
    moons: Object.freeze({ maxVisible: 3, sizeMultiplier: .68, distanceMultiplier: 1.12 }),
    cloudsOpacity: .25,
    atmosphereOpacity: .12,
  }),
  medium: Object.freeze({
    relief: Object.freeze({
      GenesisWorld_CrystalSpires: .48,
      GenesisWorld_SwampPods: .54,
    }),
    moons: Object.freeze({ maxVisible: 2, sizeMultiplier: .62, distanceMultiplier: 1.16 }),
    cloudsOpacity: .18,
    atmosphereOpacity: .1,
  }),
  low: Object.freeze({
    relief: Object.freeze({
      GenesisWorld_CrystalSpires: .46,
      GenesisWorld_SwampPods: .5,
    }),
    moons: Object.freeze({ maxVisible: 1, sizeMultiplier: .55, distanceMultiplier: 1.2 }),
    cloudsOpacity: 0,
    atmosphereOpacity: .08,
  }),
});

export function getGenesisPresentation(quality = {}, presentationMode = "campaign") {
  const profile = GENESIS_PLANET_PRESENTATION[quality.quality] || GENESIS_PLANET_PRESENTATION.high;
  const modeMoonLimit = presentationMode === "command" ? 2 : profile.moons.maxVisible;
  return {
    ...profile,
    moons: {
      ...profile.moons,
      maxVisible: Math.min(profile.moons.maxVisible, modeMoonLimit),
    },
  };
}
