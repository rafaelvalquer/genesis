import { useEffect, useMemo, useState } from "react";
import {
  getTroopPreviewUrl,
  loadTroopPreviewFrameUrls,
} from "../game/assetCatalog.js";
import { getLoadoutTroopVisual } from "./loadoutVisualCatalog.js";

export function useTroopPreviewFrames(troop, reduceMotion) {
  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const visual = useMemo(
    () => getLoadoutTroopVisual(troop),
    [troop],
  );
  const fallbackSrc = getTroopPreviewUrl(troop?.id);

  useEffect(() => {
    const onVisibility = () => setVisible(
      document.visibilityState !== "hidden",
    );
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener(
      "visibilitychange",
      onVisibility,
    );
  }, []);

  useEffect(() => {
    let current = true;
    setFrames([]);
    setFrameIndex(0);

    if (!troop || reduceMotion) {
      return () => {
        current = false;
      };
    }

    loadTroopPreviewFrameUrls(
      troop.id,
      visual.previewState,
    )
      .then((urls) => {
        if (current) setFrames(urls);
      })
      .catch(() => {
        if (current) setFrames([]);
      });

    return () => {
      current = false;
    };
  }, [
    troop?.id,
    visual.previewState,
    reduceMotion,
  ]);

  useEffect(() => {
    if (
      reduceMotion
      || !visible
      || frames.length < 2
    ) {
      return undefined;
    }

    const timeline = troop?.idleVisual?.timeline;
    const duration = troop?.idleVisual?.durationMs
      || Math.max(720, frames.length * 120);
    const startedAt = performance.now();
    let timer;

    const tick = () => {
      const elapsed = (
        performance.now() - startedAt
      ) % duration;
      let next = Math.floor(
        elapsed / duration * frames.length,
      );

      if (timeline?.length) {
        next = timeline.reduce(
          (frame, entry) => (
            elapsed >= entry.atMs ? entry.frame : frame
          ),
          timeline[0].frame,
        );
      }

      setFrameIndex(
        Math.min(frames.length - 1, next),
      );
      timer = window.setTimeout(tick, 45);
    };

    tick();

    return () => window.clearTimeout(timer);
  }, [
    frames,
    reduceMotion,
    visible,
    troop?.idleVisual,
  ]);

  return {
    src: frames[frameIndex]
      || frames[0]
      || fallbackSrc,
    /*
     * O primeiro frame é a referência estável do enquadramento. A troca de
     * frames não recalcula a escala e evita que o personagem pulse ou salte.
     */
    fitSrc: frames[0] || fallbackSrc,
    animated: frames.length > 1 && !reduceMotion,
    visual,
  };
}
