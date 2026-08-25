/**
 * Compatibility facade.
 *
 * Runtime modules inside src/ must import the focused catalogs directly.
 * Keeping this file allows external tooling and older tests to migrate
 * without breaking immediately, but importing it pulls every asset catalog.
 */

export {
  getArenaCatalogSize,
  getArenaUrl,
} from "./assets/arenaCatalog.js";

export {
  getEnemyConceptUrl,
  getEnemyPreviewCatalogSize,
  getEnemyPreviewUrl,
} from "./assets/enemyPreviewCatalog.js";

export {
  getTroopPreviewCatalogSize,
  getTroopPreviewUrl,
} from "./assets/troopPreviewCatalog.js";

export {
  clearTroopPreviewFrameCache,
  getTroopPreviewFrameCacheSize,
  loadTroopPreviewFrameUrls,
} from "./assets/troopPreviewAnimationCatalog.js";

export {
  AssetDependencyError,
  resolveBattleTroopAssetIds,
  resolvePhaseEnemyAssetDependencies,
  resolvePhaseEnemyEffectDependencies,
  resolvePhaseTroopAssetDependencies,
} from "./assets/assetDependencyResolver.js";

export {
  FOREST_OBSTACLE_STAGES,
  getForestObstacleAssetUrl,
  resolveForestObstacleAssetDependencies,
} from "./assets/forestObstacleAssetCatalog.js";

export {
  clearDecodedImageCache,
  getAssetCacheMetrics,
  loadBattleAssets,
  releaseBattleAssets,
  resolveTroopFrame,
  runWithConcurrency,
} from "./assets/battleAssetLoader.js";
