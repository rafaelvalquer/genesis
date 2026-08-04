import { getAnchoredSpriteRect } from "../visualGeometry.js";

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

export function drawSpriteInRect(ctx, image, rect, opacity = 1, filter = "none") {
  if (!image?.width || !image?.height) return false;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

export function getTroopVisualEntity(entity, config) {
  return config.spriteOffsetY ? { ...entity, y: entity.y + config.spriteOffsetY } : entity;
}
