const arenaUrls = import.meta.glob(
  "./arenas/*.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

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
