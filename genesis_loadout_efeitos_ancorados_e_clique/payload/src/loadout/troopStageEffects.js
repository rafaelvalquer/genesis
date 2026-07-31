function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeTroopStageCharacterBounds(bounds) {
  const stageWidth = Math.max(1, finiteOr(bounds?.stageWidth, 1));
  const stageHeight = Math.max(1, finiteOr(bounds?.stageHeight, 1));

  const left = clamp(
    finiteOr(bounds?.left, stageWidth * .25),
    0,
    stageWidth,
  );
  const top = clamp(
    finiteOr(bounds?.top, stageHeight * .12),
    0,
    stageHeight,
  );
  const right = clamp(
    finiteOr(bounds?.right, stageWidth * .75),
    left,
    stageWidth,
  );
  const bottom = clamp(
    finiteOr(bounds?.bottom, stageHeight * .78),
    top,
    stageHeight,
  );

  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return {
    stageWidth,
    stageHeight,
    left,
    top,
    right,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    headY: top,
    footY: bottom,
  };
}

export function translatePreviewLayoutToStage({
  layout,
  frameRect,
  stageRect,
}) {
  const body = layout?.body;
  if (!body || !frameRect || !stageRect) return null;

  return normalizeTroopStageCharacterBounds({
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    left: frameRect.left - stageRect.left + body.left,
    top: frameRect.top - stageRect.top + body.top,
    right: frameRect.left - stageRect.left + body.right,
    bottom: frameRect.top - stageRect.top + body.bottom,
  });
}

export function getTroopStageEffectStyle(bounds) {
  const normalized = normalizeTroopStageCharacterBounds(bounds);
  const floorWidth = clamp(normalized.width * 1.18, 118, 370);
  const floorHeight = clamp(floorWidth * .23, 26, 78);
  const lightWidth = clamp(normalized.width * .82, 82, 290);
  const lightTop = clamp(
    normalized.headY - normalized.height * .18,
    0,
    normalized.stageHeight,
  );
  const lightHeight = clamp(
    normalized.footY - lightTop + floorHeight * .16,
    100,
    normalized.stageHeight,
  );
  const clickSize = clamp(
    Math.max(normalized.width, normalized.height * .42),
    120,
    360,
  );

  return {
    "--character-center-x": `${normalized.centerX}px`,
    "--character-center-y": `${normalized.centerY}px`,
    "--character-head-y": `${normalized.headY}px`,
    "--character-foot-y": `${normalized.footY}px`,
    "--character-body-width": `${normalized.width}px`,
    "--character-body-height": `${normalized.height}px`,
    "--character-floor-width": `${floorWidth}px`,
    "--character-floor-height": `${floorHeight}px`,
    "--character-light-top": `${lightTop}px`,
    "--character-light-width": `${lightWidth}px`,
    "--character-light-height": `${lightHeight}px`,
    "--character-click-size": `${clickSize}px`,
  };
}
