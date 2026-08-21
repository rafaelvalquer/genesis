import { CHAPTERS } from "../game/content.js";

export const CAMPAIGN_CHAPTER_ROUTES = Object.freeze({
  chapter_01: Object.freeze([
    [18, -28], [28, -17], [22, -4], [33, 10],
    [20, 22], [9, 34], [-5, 45], [-18, 54],
  ]),
  chapter_02: Object.freeze([
    [12, 118], [24, 130], [15, 143], [2, 151],
    [-10, 140], [-18, 126], [-9, 112], [4, 102],
  ]),
  chapter_03: Object.freeze([
    [-8, -150], [-20, -139], [-29, -124], [-21, -109],
    [-34, -96], [-23, -82], [-9, -72], [4, -63],
  ]),
  chapter_04: Object.freeze([
    [48, 44], [57, 58], [49, 73], [61, 87],
    [45, 98], [35, 88], [28, 72], [38, 57],
  ]),
  chapter_05: Object.freeze([
    [55, -142], [66, -128], [72, -109], [63, -91],
    [50, -76], [38, -88], [42, -112], [52, -132],
  ]),
  chapter_06: Object.freeze([
    [-46, 18], [-54, 34], [-47, 51], [-59, 65],
    [-45, 78], [-34, 67], [-37, 47], [-43, 30],
  ]),
  chapter_07: Object.freeze([
    [-28, 101], [-34, 113], [-42, 125], [-49, 139],
    [-56, 154], [-49, 166], [-39, 158], [-31, 144],
  ]),
});

function getRoutePoint(chapter, index) {
  const route = CAMPAIGN_CHAPTER_ROUTES[chapter.id];

  if (!route?.length) {
    throw new Error(
      `Rota planetária ausente para ${chapter.id}.`,
    );
  }

  return route[index % route.length];
}

export const CAMPAIGN_PHASE_LOCATIONS = Object.fromEntries(
  CHAPTERS.flatMap((chapter) =>
    chapter.phaseIds.map((phaseId, index) => {
      const [latitude, longitude] = getRoutePoint(
        chapter,
        index,
      );
      const finalPhase = index === chapter.phaseIds.length - 1;
      const eclipse = chapter.id === "chapter_05";

      return [phaseId, {
        latitude,
        longitude,
        elevation: finalPhase
          ? eclipse ? .09 : .075
          : eclipse ? .045 : .035,
        cameraDistance: finalPhase
          ? eclipse ? 3.62 : 3.72
          : eclipse ? 3.88 : 3.95,
      }];
    }),
  ),
);

export function latLonToCartesian(
  latitude,
  longitude,
  radius = 1,
) {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;

  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
