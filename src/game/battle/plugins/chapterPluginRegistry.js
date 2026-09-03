import { chapter07Plugin } from "./chapter07Plugin.js";

const chapterPlugins = Object.freeze({
  [chapter07Plugin.chapterId]: chapter07Plugin,
});

export function getChapterPlugin(chapterId) {
  return chapterPlugins[chapterId] ?? null;
}

export function requireChapterPlugin(chapterId) {
  const plugin = getChapterPlugin(chapterId);
  if (!plugin) {
    throw new Error(`Chapter plugin not registered: ${chapterId}`);
  }
  return plugin;
}

export function listChapterPluginIds() {
  return Object.keys(chapterPlugins);
}

export const CHAPTER_PLUGIN_REGISTRY = Object.freeze({
  get: getChapterPlugin,
  require: requireChapterPlugin,
  list: listChapterPluginIds,
});
