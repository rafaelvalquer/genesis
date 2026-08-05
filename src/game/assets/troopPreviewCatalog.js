import { TROOPS } from "../content.js";

const troopPreviewUrls = import.meta.glob([
  "./troop/*/idle/frame0.png",
  "!./troop/muralhaReforcada/idle/frame0.png",
  "./troop/*/defense/frame0.png",
], {
  eager: true,
  query: "?url",
  import: "default",
});

export function getTroopPreviewUrl(troopId) {
  const spriteKey = TROOPS[troopId]?.spriteKey || troopId;
  const preferredState = (
    spriteKey === "muralhaReforcada"
      ? "defense"
      : "idle"
  );

  const match = Object.entries(troopPreviewUrls)
    .find(([key]) => key.includes(
      `/${spriteKey}/${preferredState}/frame0.png`,
    ));

  return match?.[1] || null;
}

export function getTroopPreviewCatalogSize() {
  return Object.keys(troopPreviewUrls).length;
}
