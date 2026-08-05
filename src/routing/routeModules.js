import {
  createRetryableLazyModule,
} from "./retryableLazyModule.js";

export const loadLoadoutModule = (
  createRetryableLazyModule(
    () => import("../loadout/LoadoutPage.jsx"),
  )
);

function preloadImage(source, signal) {
  if (!source || typeof Image === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const image = new Image();

    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
    };

    const finish = () => {
      cleanup();
      resolve();
    };

    const fail = () => {
      cleanup();
      resolve();
    };

    const abort = () => {
      cleanup();

      const error = new Error(
        "Preload da rota cancelado.",
      );

      error.name = "AbortError";
      reject(error);
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener(
      "abort",
      abort,
      { once: true },
    );

    image.onload = finish;
    image.onerror = fail;
    image.decoding = "async";
    image.src = source;

    if (image.complete) finish();
  });
}

export async function preloadLoadoutRoute({
  arenaUrl,
  signal,
} = {}) {
  const results = await Promise.allSettled([
    loadLoadoutModule.preload(),
    import("three"),
    preloadImage(arenaUrl, signal),
  ]);

  if (signal?.aborted) {
    const error = new Error(
      "Preload da rota cancelado.",
    );

    error.name = "AbortError";
    throw error;
  }

  return results;
}
