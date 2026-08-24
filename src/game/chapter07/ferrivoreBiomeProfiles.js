const infestation = [.2, .35, .45, .58, .68, .78, .9, 1];
const roots = [.25, .4, .5, .65, .76, .84, .94, 1];
const nests = [.1, .16, .25, .38, .52, .68, .82, .9];
const spores = [.18, .25, .34, .46, .58, .68, .8, .9];
const veins = [.15, .22, .32, .46, .58, .72, .86, 1];
const canopyDensity = [.4, .5, .58, .65, .72, .78, .88, 1];
const vegetationDensity = [.4, .5, .58, .65, .72, .78, .88, 1];
const fogDensity = [.18, .24, .32, .42, .52, .66, .8, 1];
const ruinDensity = [.5, .46, .4, .34, .28, .22, .16, .1];
const wetness = [.25, .35, .45, .56, .66, .76, .86, .94];
const giantTreeDensity = [.45, .55, .62, .7, .78, .86, .94, 1];

export const FERRIVORE_PHASE_PROFILES = Object.freeze(Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const id = `fase_${49 + index}`;
    return [id, Object.freeze({ infestation: infestation[index], roots: roots[index], nests: nests[index], spores: spores[index], veins: veins[index], canopyDensity: canopyDensity[index], vegetationDensity: vegetationDensity[index], fogDensity: fogDensity[index], ruinDensity: ruinDensity[index], wetness: wetness[index], giantTreeDensity: giantTreeDensity[index], colonyHeart: index === 7 })];
  }),
));

export function getFerrivorePhaseProfile(phase) {
  return FERRIVORE_PHASE_PROFILES[phase?.id] || FERRIVORE_PHASE_PROFILES.fase_49;
}
