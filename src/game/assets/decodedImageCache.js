import { createAssetAbortError } from "./assetModuleUtils.js";

const decodedImageCache = new Map();

function decodeImage(url) {
  if (import.meta.env.MODE === "test") {
    return Promise.resolve({
      src: url,
      width: 1,
      height: 1,
    });
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = async () => {
      if (typeof createImageBitmap === "function") {
        try {
          resolve(await createImageBitmap(image));
          return;
        } catch {
          // HTMLImageElement remains a safe decoding fallback.
        }
      }

      resolve(image);
    };

    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function loadDecodedImage(url, signal, retainedKeys) {
  let entry = decodedImageCache.get(url);

  if (!entry) {
    entry = {
      promise: null,
      references: 0,
      width: 0,
      height: 0,
    };

    entry.promise = decodeImage(url)
      .then((image) => {
        entry.width = image?.width || 0;
        entry.height = image?.height || 0;
        return image;
      })
      .catch((error) => {
        decodedImageCache.delete(url);
        throw error;
      });

    decodedImageCache.set(url, entry);
  }

  if (retainedKeys && !retainedKeys.has(url)) {
    retainedKeys.add(url);
    entry.references += 1;
  }

  if (!signal) return entry.promise;
  if (signal.aborted) return Promise.reject(createAssetAbortError());

  return new Promise((resolve, reject) => {
    const abort = () => reject(createAssetAbortError());
    signal.addEventListener("abort", abort, { once: true });

    entry.promise.then(
      (image) => {
        signal.removeEventListener("abort", abort);
        resolve(image);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export function getAssetCacheMetrics() {
  let decodedBytes = 0;
  let retainedImages = 0;

  for (const entry of decodedImageCache.values()) {
    decodedBytes += entry.width * entry.height * 4;
    if (entry.references > 0) retainedImages += 1;
  }

  return {
    images: decodedImageCache.size,
    retainedImages,
    approximateDecodedBytes: decodedBytes,
  };
}

export function releaseBattleAssets(assets) {
  for (const url of assets?._assetCacheKeys || []) {
    const entry = decodedImageCache.get(url);
    if (!entry) continue;

    entry.references = Math.max(0, entry.references - 1);

    if (entry.references === 0) {
      entry.promise
        .then((image) => image?.close?.())
        .catch(() => {});

      decodedImageCache.delete(url);
    }
  }

  assets?._assetCacheKeys?.clear();
}

export function clearDecodedImageCache() {
  for (const entry of decodedImageCache.values()) {
    entry.promise
      .then((image) => image?.close?.())
      .catch(() => {});
  }

  decodedImageCache.clear();
}

export function getDecodedImageCacheSize() {
  return decodedImageCache.size;
}
