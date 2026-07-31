const opaqueBoundsCache = new Map();

const DEFAULT_ALPHA_THRESHOLD = 8;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function wholeImageBounds(width, height) {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error(`Não foi possível medir o sprite ${source}`),
    );
    image.src = source;
  });
}

export function findOpaquePixelBounds(
  imageData,
  width,
  height,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
) {
  if (!imageData?.length || width <= 0 || height <= 0) {
    return wholeImageBounds(width, height);
  }

  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[rowStart + x * 4 + 3];
      if (alpha <= alphaThreshold) continue;

      if (x < minimumX) minimumX = x;
      if (x > maximumX) maximumX = x;
      if (y < minimumY) minimumY = y;
      if (y > maximumY) maximumY = y;
    }
  }

  if (maximumX < minimumX || maximumY < minimumY) {
    return wholeImageBounds(width, height);
  }

  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  };
}

export function measureTroopPreviewSource(source) {
  if (!source) {
    return Promise.resolve({
      imageWidth: 1,
      imageHeight: 1,
      bounds: wholeImageBounds(1, 1),
    });
  }

  if (!opaqueBoundsCache.has(source)) {
    opaqueBoundsCache.set(
      source,
      loadImage(source)
        .then((image) => {
          const imageWidth = Math.max(
            1,
            image.naturalWidth || image.width || 1,
          );
          const imageHeight = Math.max(
            1,
            image.naturalHeight || image.height || 1,
          );

          try {
            const canvas = document.createElement("canvas");
            canvas.width = imageWidth;
            canvas.height = imageHeight;

            const context = canvas.getContext(
              "2d",
              { willReadFrequently: true },
            );

            if (!context) {
              return {
                imageWidth,
                imageHeight,
                bounds: wholeImageBounds(imageWidth, imageHeight),
              };
            }

            context.clearRect(0, 0, imageWidth, imageHeight);
            context.drawImage(image, 0, 0);

            const pixels = context.getImageData(
              0,
              0,
              imageWidth,
              imageHeight,
            ).data;

            return {
              imageWidth,
              imageHeight,
              bounds: findOpaquePixelBounds(
                pixels,
                imageWidth,
                imageHeight,
              ),
            };
          } catch {
            /*
             * Mesmo em um ambiente com canvas indisponível ou imagem sem
             * acesso a pixels, o fallback mantém a imagem inteira visível.
             */
            return {
              imageWidth,
              imageHeight,
              bounds: wholeImageBounds(imageWidth, imageHeight),
            };
          }
        })
        .catch(() => ({
          imageWidth: 1,
          imageHeight: 1,
          bounds: wholeImageBounds(1, 1),
        })),
    );
  }

  return opaqueBoundsCache.get(source);
}

export function calculateFullBodyPreviewLayout({
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
  bounds,
  scale = .9,
  offsetX = 0,
  offsetY = 0,
  paddingX = .045,
  paddingY = .035,
}) {
  const frameWidth = Math.max(1, finiteOr(containerWidth, 1));
  const frameHeight = Math.max(1, finiteOr(containerHeight, 1));
  const sourceWidth = Math.max(1, finiteOr(imageWidth, 1));
  const sourceHeight = Math.max(1, finiteOr(imageHeight, 1));
  const opaque = bounds || wholeImageBounds(sourceWidth, sourceHeight);

  const safePaddingX = Math.min(.2, Math.max(0, finiteOr(paddingX, .045)));
  const safePaddingY = Math.min(.2, Math.max(0, finiteOr(paddingY, .035)));
  const safeWidth = frameWidth * (1 - safePaddingX * 2);
  const safeHeight = frameHeight * (1 - safePaddingY * 2);
  const safeScale = Math.min(1, Math.max(.5, finiteOr(scale, .9)));

  const pixelsPerSourcePixel = Math.min(
    safeWidth / Math.max(1, opaque.width),
    safeHeight / Math.max(1, opaque.height),
  ) * safeScale;

  const renderedWidth = sourceWidth * pixelsPerSourcePixel;
  const renderedHeight = sourceHeight * pixelsPerSourcePixel;

  const bodyCenterX = (opaque.x + opaque.width / 2)
    * pixelsPerSourcePixel;
  const bodyBottomY = (opaque.y + opaque.height)
    * pixelsPerSourcePixel;

  const targetCenterX = frameWidth / 2 + finiteOr(offsetX, 0);
  const targetBottomY = frameHeight * (1 - safePaddingY)
    + finiteOr(offsetY, 0);

  const left = targetCenterX - bodyCenterX;
  const top = targetBottomY - bodyBottomY;

  return {
    left,
    top,
    width: renderedWidth,
    height: renderedHeight,
    body: {
      left: left + opaque.x * pixelsPerSourcePixel,
      top: top + opaque.y * pixelsPerSourcePixel,
      right: left + (opaque.x + opaque.width) * pixelsPerSourcePixel,
      bottom: top + (opaque.y + opaque.height) * pixelsPerSourcePixel,
      width: opaque.width * pixelsPerSourcePixel,
      height: opaque.height * pixelsPerSourcePixel,
    },
  };
}

export function clearTroopPreviewMeasurementCache() {
  opaqueBoundsCache.clear();
}
