const infestation = [.2, .35, .45, .58, .68, .78, .9, 1];
const roots = [.25, .4, .5, .65, .76, .84, .94, 1];
const nests = [.1, .16, .25, .38, .52, .68, .82, .9];
const spores = [.18, .25, .34, .46, .58, .68, .8, .9];
const veins = [.15, .22, .32, .46, .58, .72, .86, 1];

export const FERRIVORE_PHASE_PROFILES = Object.freeze(Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const id = `fase_${49 + index}`;
    return [id, Object.freeze({ infestation: infestation[index], roots: roots[index], nests: nests[index], spores: spores[index], veins: veins[index], colonyHeart: index === 7 })];
  }),
));

export function getFerrivorePhaseProfile(phase) {
  return FERRIVORE_PHASE_PROFILES[phase?.id] || FERRIVORE_PHASE_PROFILES.fase_49;
}
