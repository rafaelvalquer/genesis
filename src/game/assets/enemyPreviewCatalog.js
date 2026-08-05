import { ENEMIES } from "../content.js";

const enemyPreviewUrls = import.meta.glob([
  "./enemy/*/*/frame0.png",
], {
  eager: true,
  query: "?url",
  import: "default",
});

const enemyConceptUrls = import.meta.glob(
  "./enemy/concepts/*.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export function getEnemyPreviewUrl(enemyId) {
  const previewState = (
    ENEMIES[enemyId]?.previewState
      || "idle"
  );

  const match = Object.entries(enemyPreviewUrls)
    .find(([key]) => key.includes(
      `/enemy/${enemyId}/${previewState}/frame0.png`,
    ));

  return match?.[1] || getEnemyConceptUrl(enemyId);
}

export function getEnemyConceptUrl(enemyId) {
  const match = Object.entries(enemyConceptUrls)
    .find(([key]) => key.endsWith(
      `/concepts/${enemyId}.webp`,
    ));

  return match?.[1] || "";
}

export function getEnemyPreviewCatalogSize() {
  return Object.keys(enemyPreviewUrls).length;
}
