import { useCallback, useEffect, useState } from "react";

function fullscreenElement(documentObject = document) {
  return documentObject.fullscreenElement
    || documentObject.webkitFullscreenElement
    || null;
}

function fullscreenEnabled(documentObject = document) {
  return Boolean(
    documentObject.fullscreenEnabled
    || documentObject.webkitFullscreenEnabled,
  );
}

async function requestElementFullscreen(element) {
  const request = element?.requestFullscreen
    || element?.webkitRequestFullscreen;

  if (!request) {
    throw new Error("fullscreenUnsupported");
  }

  await request.call(element);
}

async function exitDocumentFullscreen(documentObject = document) {
  const exit = documentObject.exitFullscreen
    || documentObject.webkitExitFullscreen;

  if (!exit) {
    throw new Error("fullscreenUnsupported");
  }

  await exit.call(documentObject);
}

export function useBattleFullscreen(targetRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(() => (
    typeof document !== "undefined"
      ? fullscreenEnabled(document)
      : false
  ));

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const sync = () => {
      setIsFullscreen(
        fullscreenElement(document) === targetRef.current,
      );
      setIsSupported(fullscreenEnabled(document));
    };

    const handleError = () => {
      sync();
    };

    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("fullscreenerror", handleError);
    document.addEventListener("webkitfullscreenchange", sync);
    document.addEventListener("webkitfullscreenerror", handleError);

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("fullscreenerror", handleError);
      document.removeEventListener("webkitfullscreenchange", sync);
      document.removeEventListener("webkitfullscreenerror", handleError);
    };
  }, [targetRef]);

  const enterFullscreen = useCallback(async () => {
    const element = targetRef.current;

    if (!element || !isSupported) {
      return {
        ok: false,
        reason: "Tela cheia não é suportada neste navegador.",
      };
    }

    try {
      await requestElementFullscreen(element);
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: "Não foi possível ativar a tela cheia.",
      };
    }
  }, [isSupported, targetRef]);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || !fullscreenElement(document)) {
      return { ok: true };
    }

    try {
      await exitDocumentFullscreen(document);
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: "Não foi possível sair da tela cheia.",
      };
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document !== "undefined" && fullscreenElement(document)) {
      return exitFullscreen();
    }

    return enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    fullscreenSupported: isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}

export const battleFullscreenInternals = {
  fullscreenElement,
  fullscreenEnabled,
  requestElementFullscreen,
  exitDocumentFullscreen,
};
