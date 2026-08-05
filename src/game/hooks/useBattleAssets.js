import { useEffect, useState } from "react";
import { ENEMIES } from "../content.js";
import {
  loadBattleAssets,
  releaseBattleAssets,
} from "../assets/battleAssetLoader.js";

function scheduleDeferredLoad(callback) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 80);
  return () => window.clearTimeout(id);
}

export function useBattleAssets({
  phase,
  loadout,
  sandbox,
  assetsRef,
  onAssetsReady,
  onCleanup,
}) {
  const [loading, setLoading] = useState({ ready: false, percent: 0 });

  useEffect(() => {
    let cancelled = false;
    let cancelDeferred = () => {};
    let deferredPromise = null;
    let loadedAssets = null;
    const controller = new AbortController();
    setLoading({ ready: false, percent: 0 });

    loadBattleAssets(
      phase,
      loadout,
      ({ percent }) => !cancelled && setLoading({ ready: false, percent }),
      sandbox
        ? { enemyIds: Object.keys(ENEMIES), signal: controller.signal }
        : { signal: controller.signal, deferRareStates: true },
    )
      .then((assets) => {
        if (cancelled) {
          releaseBattleAssets(assets);
          return;
        }
        releaseBattleAssets(assetsRef.current);
        assetsRef.current = assets;
        loadedAssets = assets;
        onAssetsReady?.(assets);
        setLoading({ ready: true, percent: 100 });

        if (assets.deferredStates > 0) {
          cancelDeferred = scheduleDeferredLoad(() => {
            deferredPromise = assets.loadDeferred().catch((error) => {
              if (error?.name !== "AbortError" && !cancelled) {
                console.warn("Falha ao carregar estados raros de assets.", error);
              }
            });
          });
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && !cancelled) {
          setLoading({
            ready: false,
            percent: 0,
            error: error?.message || "Falha ao carregar recursos.",
          });
        }
      });

    return () => {
      cancelled = true;
      cancelDeferred();
      controller.abort();
      const assets = loadedAssets || assetsRef.current;
      if (assetsRef.current === assets) assetsRef.current = null;
      if (deferredPromise) {
        deferredPromise.finally(() => releaseBattleAssets(assets));
      } else {
        releaseBattleAssets(assets);
      }
      onCleanup?.();
    };
  }, [assetsRef, loadout, onAssetsReady, onCleanup, phase, sandbox]);

  return loading;
}

export default useBattleAssets;
