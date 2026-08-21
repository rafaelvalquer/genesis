import { useEffect, useState } from "react";
import { ENEMIES } from "../content.js";
import {
  loadBattleAssets,
  releaseBattleAssets,
} from "../assets/battleAssetLoader.js";
import { isSystemEnabledForPhase } from "../phaseRules.js";

const INITIAL_LOADING_STATE = Object.freeze({
  ready: false,
  percent: 0,
  deferredPercent: 0,
  stage: "critical",
  error: null,
  deferredError: null,
});

function clampPercent(value) {
  return Math.max(
    0,
    Math.min(100, Math.round(Number(value) || 0)),
  );
}

export function applyBattleAssetProgress(
  current,
  progress = {},
) {
  const percent = clampPercent(progress.percent);

  if (progress.phase === "deferred") {
    return {
      ...current,
      deferredPercent: percent,
      deferredError: null,
    };
  }

  return {
    ...current,
    ready: false,
    percent,
    stage: "critical",
    error: null,
  };
}

export function markBattleAssetsReady(current) {
  return {
    ...current,
    ready: true,
    percent: 100,
    stage: "ready",
    error: null,
  };
}

function scheduleDeferredLoad(callback) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(
      callback,
      { timeout: 1500 },
    );

    return () => {
      window.cancelIdleCallback?.(id);
    };
  }

  const id = window.setTimeout(callback, 80);

  return () => {
    window.clearTimeout(id);
  };
}

export function useBattleAssets({
  phase,
  loadout,
  sandbox,
  assetsRef,
  onAssetsReady,
  onCleanup,
}) {
  const [loading, setLoading] = useState(
    INITIAL_LOADING_STATE,
  );

  useEffect(() => {
    let cancelled = false;
    let cancelDeferred = () => {};
    let deferredPromise = null;
    let loadedAssets = null;

    const controller = new AbortController();

    setLoading(INITIAL_LOADING_STATE);

    const reportProgress = (progress) => {
      if (cancelled) return;

      setLoading((current) => (
        applyBattleAssetProgress(
          current,
          progress,
        )
      ));
    };

    loadBattleAssets(
      phase,
      loadout,
      reportProgress,
      sandbox
        ? {
          enemyIds: Object.keys(ENEMIES),
          signal: controller.signal,
          skipDefenses: !isSystemEnabledForPhase(phase, "dematerializationPulse"),
        }
        : {
          signal: controller.signal,
          deferRareStates: true,
          skipDefenses: !isSystemEnabledForPhase(phase, "dematerializationPulse"),
        },
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

        setLoading((current) => (
          markBattleAssetsReady(current)
        ));

        if (assets.deferredStates > 0) {
          cancelDeferred = scheduleDeferredLoad(() => {
            deferredPromise = assets.loadDeferred()
              .then(() => {
                if (cancelled) return;

                setLoading((current) => ({
                  ...current,
                  ready: true,
                  stage: "ready",
                  deferredPercent: 100,
                  deferredError: null,
                }));
              })
              .catch((error) => {
                if (
                  error?.name === "AbortError"
                  || cancelled
                ) {
                  return;
                }

                console.warn(
                  "Falha ao carregar estados raros de assets.",
                  error,
                );

                setLoading((current) => ({
                  ...current,
                  ready: true,
                  stage: "ready",
                  deferredError: (
                    error?.message
                    || "Falha ao carregar estados raros."
                  ),
                }));
              });
          });
        }
      })
      .catch((error) => {
        if (
          error?.name === "AbortError"
          || cancelled
        ) {
          return;
        }

        setLoading((current) => ({
          ...current,
          ready: false,
          stage: "error",
          error: (
            error?.message
            || "Falha ao carregar recursos."
          ),
        }));
      });

    return () => {
      cancelled = true;
      cancelDeferred();
      controller.abort();

      const assets = (
        loadedAssets
        || assetsRef.current
      );

      if (assetsRef.current === assets) {
        assetsRef.current = null;
      }

      if (deferredPromise) {
        deferredPromise.finally(() => {
          releaseBattleAssets(assets);
        });
      } else {
        releaseBattleAssets(assets);
      }

      onCleanup?.();
    };
  }, [
    assetsRef,
    loadout,
    onAssetsReady,
    onCleanup,
    phase,
    sandbox,
  ]);

  return loading;
}

export default useBattleAssets;
