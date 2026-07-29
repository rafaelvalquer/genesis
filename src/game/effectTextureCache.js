const textureCache = new Map();

function createTextureCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function clearEffectTextureCache() {
  textureCache.clear();
}

export function getRadialGlowTexture(
  key,
  inner,
  middle,
  outer,
  middleStop = 0.45,
  canvasFactory = createTextureCanvas,
) {
  const cacheKey = `radial:${key}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const canvas = canvasFactory(128, 128);
  if (!canvas) return null;
  const textureCtx = canvas.getContext("2d");
  if (!textureCtx) return null;
  const gradient = textureCtx.createRadialGradient(64, 64, 1, 64, 64, 63);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(middleStop, middle);
  gradient.addColorStop(1, outer);
  textureCtx.fillStyle = gradient;
  textureCtx.fillRect(0, 0, 128, 128);
  textureCache.set(cacheKey, canvas);
  return canvas;
}

export function drawCachedRadialGlow(
  ctx,
  key,
  x,
  y,
  radiusX,
  radiusY,
  inner,
  middle,
  outer,
  middleStop = 0.45,
) {
  const texture = getRadialGlowTexture(key, inner, middle, outer, middleStop);
  if (!texture) return false;
  ctx.drawImage(texture, x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);
  return true;
}

export function getLinearEffectTexture(
  key,
  start,
  end,
  canvasFactory = createTextureCanvas,
) {
  const cacheKey = `linear:${key}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const canvas = canvasFactory(64, 128);
  if (!canvas) return null;
  const textureCtx = canvas.getContext("2d");
  if (!textureCtx) return null;
  const gradient = textureCtx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  textureCtx.fillStyle = gradient;
  textureCtx.fillRect(0, 0, 64, 128);
  textureCache.set(cacheKey, canvas);
  return canvas;
}

export function getSceneTintTexture(
  key,
  start,
  end,
  width,
  height,
  canvasFactory = createTextureCanvas,
) {
  const cacheKey = `scene:${key}:${width}x${height}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const canvas = canvasFactory(width, height);
  if (!canvas) return null;
  const textureCtx = canvas.getContext("2d");
  if (!textureCtx) return null;
  const gradient = textureCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  textureCtx.fillStyle = gradient;
  textureCtx.fillRect(0, 0, width, height);
  textureCache.set(cacheKey, canvas);
  return canvas;
}

