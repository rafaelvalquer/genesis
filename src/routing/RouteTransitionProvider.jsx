import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import RouteTransitionLayer from "./RouteTransitionLayer.jsx";
import {
  IDLE_ROUTE_TRANSITION,
  matchesRouteTransition,
  routeTransitionReducer,
} from "./routeTransitionMachine.js";
import "./route-transitions.css";

const RouteTransitionContext = createContext(null);

const EXIT_TIMEOUT_MS = 1500;
const DESTINATION_TIMEOUT_MS = 2400;

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function settleWithin(task, timeoutMs) {
  await Promise.race([
    Promise.resolve(task),
    delay(timeoutMs),
  ]);
}

export function RouteTransitionProvider({
  children,
}) {
  const navigate = useNavigate();

  const [
    transition,
    dispatch,
  ] = useReducer(
    routeTransitionReducer,
    IDLE_ROUTE_TRANSITION,
  );

  const activeRef = useRef(null);
  const revealTimerRef = useRef(null);
  const resetTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(revealTimerRef.current);
    window.clearTimeout(resetTimerRef.current);

    revealTimerRef.current = null;
    resetTimerRef.current = null;
  }, []);

  const completeTransition = useCallback(() => {
    const active = activeRef.current;

    if (!active || active.finishing) {
      return false;
    }

    active.finishing = true;
    clearTimers();

    dispatch({
      type: "ENTERING",
      token: active.token,
    });

    resetTimerRef.current = window.setTimeout(
      () => {
        dispatch({ type: "RESET" });

        active.controller.abort();
        activeRef.current = null;
      },
      active.reduceMotion
        ? 100
        : 460,
    );

    return true;
  }, [clearTimers]);

  const cancelTransition = useCallback(() => {
    const active = activeRef.current;

    clearTimers();
    active?.controller.abort();
    activeRef.current = null;

    dispatch({ type: "RESET" });
  }, [clearTimers]);

  const transitionTo = useCallback(
    async ({
      to,
      type,
      payload = {},
      reduceMotion = false,
      preload,
      exit,
    }) => {
      if (!to || activeRef.current) {
        return false;
      }

      const token = (
        `${Date.now()}:`
        + Math.random().toString(36).slice(2)
      );

      const controller = new AbortController();

      activeRef.current = {
        token,
        controller,
        reduceMotion,
        finishing: false,
      };

      dispatch({
        type: "BEGIN",
        transition: {
          token,
          type,
          to,
          payload,
          reduceMotion,
        },
      });

      const updateProgress = (
        progress,
        status = "exiting",
      ) => {
        if (controller.signal.aborted) return;

        dispatch({
          type: "STAGE",
          token,
          status,
          progress,
        });
      };

      const preloadPromise = (
        Promise.resolve()
          .then(() => preload?.({
            signal: controller.signal,
            updateProgress,
          }))
          .catch((error) => {
            if (error?.name !== "AbortError") {
              console.warn(
                "Preload da rota não foi concluído.",
                error,
              );
            }
          })
      );

      try {
        updateProgress(16);

        await settleWithin(
          exit?.({
            signal: controller.signal,
            updateProgress,
          }),
          reduceMotion
            ? 180
            : EXIT_TIMEOUT_MS,
        );

        if (controller.signal.aborted) {
          return false;
        }

        updateProgress(56, "covering");

        await delay(
          reduceMotion
            ? 30
            : 230,
        );

        if (controller.signal.aborted) {
          return false;
        }

        updateProgress(72, "navigating");
        navigate(to);
        updateProgress(84, "waiting");

        preloadPromise.then(() => {
          updateProgress(94, "waiting");
        });

        revealTimerRef.current = window.setTimeout(
          () => {
            completeTransition();
          },
          reduceMotion
            ? 520
            : DESTINATION_TIMEOUT_MS,
        );

        return true;
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error(
            "Falha na transição de rota.",
            error,
          );
        }

        try {
          navigate(to);
        } finally {
          completeTransition();
        }

        return false;
      }
    },
    [
      completeTransition,
      navigate,
    ],
  );

  useEffect(
    () => cancelTransition,
    [cancelTransition],
  );

  const value = useMemo(
    () => ({
      transition,
      isTransitioning: (
        transition.status !== "idle"
      ),
      transitionTo,
      completeTransition,
      cancelTransition,
      matchesTransition: (
        criteria,
      ) => matchesRouteTransition(
        transition,
        criteria,
      ),
    }),
    [
      cancelTransition,
      completeTransition,
      transition,
      transitionTo,
    ],
  );

  return (
    <RouteTransitionContext.Provider
      value={value}
    >
      {children}
      <RouteTransitionLayer
        transition={transition}
      />
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const context = useContext(
    RouteTransitionContext,
  );

  // Permite renderizar telas isoladamente (testes, previews e fallback WebGL)
  // sem alterar o comportamento quando o provider real está montado.
  return context || {
    transition: IDLE_ROUTE_TRANSITION,
    isTransitioning: false,
    transitionTo: async () => false,
    completeTransition: () => false,
    cancelTransition: () => false,
    matchesTransition: () => false,
  };
}
