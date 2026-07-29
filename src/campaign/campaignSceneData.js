import { CHAPTERS } from "../game/content.js";

const CHAPTER_ROUTES = {
  chapter_01: [
    [18, -28], [28, -17], [22, -4], [33, 10], [20, 22], [9, 34], [-5, 45], [-18, 54],
  ],
  chapter_02: [
    [12, 118], [24, 130], [15, 143], [2, 151], [-10, 140], [-18, 126], [-9, 112], [4, 102],
  ],
  chapter_03: [
    [-8, -150], [-20, -139], [-29, -124], [-21, -109], [-34, -96], [-23, -82], [-9, -72], [4, -63],
  ],
  chapter_04: [
    [48, 44], [57, 58], [49, 73], [61, 87], [45, 98], [35, 88], [28, 72], [38, 57],
  ],
};

export const CAMPAIGN_PHASE_LOCATIONS = Object.fromEntries(
  CHAPTERS.flatMap((chapter) =>
    chapter.phaseIds.map((phaseId, index) => {
      const [latitude, longitude] = CHAPTER_ROUTES[chapter.id][index];
      return [phaseId, {
        latitude,
        longitude,
        elevation: index === chapter.phaseIds.length - 1 ? 0.075 : 0.035,
        cameraDistance: index === chapter.phaseIds.length - 1 ? 3.72 : 3.95,
      }];
    }),
  ),
);

export function latLonToCartesian(latitude, longitude, radius = 1) {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
