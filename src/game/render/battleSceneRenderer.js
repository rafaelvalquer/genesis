import { getAnchoredSpriteRect } from "../visualGeometry.js";

export const BATTLE_RENDER_STAGES = Object.freeze([
  "background",
  "environment",
  "entities",
  "projectiles",
  "vfx",
  "foreground",
]);

/**
 * Executes the battle z-order contract. Render callbacks receive one ephemeral
 * render context and must never mutate the battle session.
 */
export function renderBattleScene(renderContext, stages) {
  const timings = {};
  for (const name of BATTLE_RENDER_STAGES) {
    const draw = stages?.[name];
    if (!draw) continue;
    const startedAt = performance.now();
    draw(renderContext);
    timings[`${name}Ms`] = performance.now() - startedAt;
  }
  return timings;
}

/** Resolve phase-level visual systems once, outside the frame hot path. */
export function createBattleRenderPlan(phase = {}) {
  const chapterId = phase.chapterId;
  const environments = [];
  if (phase.environment === "forest" || chapterId === "chapter_07") environments.push("forest", "spores", "convoy");
  if (phase.environment === "thermal" || chapterId === "chapter_06") environments.push("thermal");
  if (phase.environment === "tide" || chapterId === "chapter_05") environments.push("tide");
  if (phase.environment === "wind" || chapterId === "chapter_04") environments.push("wind");
  return Object.freeze({
    environments: Object.freeze([...new Set(environments)]),
    stages: BATTLE_RENDER_STAGES,
  });
}

export function drawSprite(
  ctx,
  image,
  entity,
  targetHeight,
  opacity = 1,
  filter = "none",
  anchor = null,
  flipX = false,
) {
  if (!image?.width || !image?.height) return false;
  const rect = getAnchoredSpriteRect(entity, targetHeight, image.width / image.height, anchor);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  if (flipX) {
    ctx.translate(rect.x + rect.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -rect.width / 2, rect.y, rect.width, rect.height);
  } else {
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
  return true;
}

export function drawSpriteInRect(ctx, image, rect, opacity = 1, filter = "none", flipX = false) {
  if (!image?.width || !image?.height) return false;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  if (flipX) {
    ctx.translate(rect.x + rect.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -rect.width / 2, rect.y, rect.width, rect.height);
  } else ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

export function getTroopVisualEntity(entity, config) {
  return config.spriteOffsetY ? { ...entity, y: entity.y + config.spriteOffsetY } : entity;
}
