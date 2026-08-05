const audioUrls = import.meta.glob(
  "./sfx/*.{ogg,wav}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export function copyBattleAudioUrls(
  destination = {},
) {
  for (const [key, url] of Object.entries(audioUrls)) {
    destination[key.split("/").at(-1)] = url;
  }

  return destination;
}

export function getBattleAudioCatalogSize() {
  return Object.keys(audioUrls).length;
}
