const arenaUrls = import.meta.glob(
  "./arenas/*.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

// Center plates of the ground kit: two blue metal variants plus a cracked
// stone accent. Edge/corner pieces are mixed-style and are not used yet.
const groundTileUrls = import.meta.glob(
  [
    "./tiles/groundCentro1.png",
    "./tiles/groundCentro2.png",
    "./tiles/groundCentro__.png",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

// Fixed order: [metal A, metal B, stone accent]; the renderer relies on it.
const GROUND_TILE_ORDER = [
  "./tiles/groundCentro1.png",
  "./tiles/groundCentro2.png",
  "./tiles/groundCentro__.png",
];

export function getGroundTileUrls() {
  return GROUND_TILE_ORDER.map((key) => groundTileUrls[key]).filter(Boolean);
}

export function getArenaUrl(arenaId) {
  const match = Object.entries(arenaUrls)
    .find(([key]) => key.endsWith(
      `/${arenaId}.webp`,
    ));

  return match?.[1] || null;
}

export function getArenaCatalogSize() {
  return Object.keys(arenaUrls).length;
}
