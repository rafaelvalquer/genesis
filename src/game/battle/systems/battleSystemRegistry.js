import { CHAPTER_PLUGIN_REGISTRY } from "../plugins/chapterPluginRegistry.js";

/**
 * Incremental battle runtime registry.
 *
 * Chapter plugins are the first subsystem moved behind this boundary. Core,
 * projectile, spawn, environment and telemetry systems can migrate here in
 * later changes without forcing another engine rewrite.
 */
export const BATTLE_SYSTEM_REGISTRY = Object.freeze({
  chapterPlugins: CHAPTER_PLUGIN_REGISTRY,
});

export function getBattleSystemRegistry() {
  return BATTLE_SYSTEM_REGISTRY;
}
