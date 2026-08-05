import { TROOPS } from "../content.js";
import { modulesFor } from "./assetModuleUtils.js";

const troopPreviewFrameModules = import.meta.glob([
  "./troop/**/*.png",
  "!./troop/muralhaReforcada/idle/**/*.png",
], {
  query: "?url",
  import: "default",
});

const troopPreviewFrameCache = new Map();

export function loadTroopPreviewFrameUrls(
  troopId,
  state = "idle",
) {
  const troop = TROOPS[troopId];
  const spriteKey = troop?.spriteKey || troopId;

  const preferredState = (
    state === "idle"
      && spriteKey === "muralhaReforcada"
  )
    ? "defense"
    : state;

  const cacheKey = `${spriteKey}:${preferredState}`;

  if (!troopPreviewFrameCache.has(cacheKey)) {
    const loaders = modulesFor(
      troopPreviewFrameModules,
      spriteKey,
      preferredState,
    ).map(([, load]) => load());

    troopPreviewFrameCache.set(
      cacheKey,
      Promise.all(loaders)
        .then((urls) => urls.filter(Boolean)),
    );
  }

  return troopPreviewFrameCache.get(cacheKey);
}

export function clearTroopPreviewFrameCache() {
  troopPreviewFrameCache.clear();
}

export function getTroopPreviewFrameCacheSize() {
  return troopPreviewFrameCache.size;
}
