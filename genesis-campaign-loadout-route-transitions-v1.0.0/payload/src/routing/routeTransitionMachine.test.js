import {
  describe,
  expect,
  it,
} from "vitest";
import {
  IDLE_ROUTE_TRANSITION,
  matchesRouteTransition,
  routeTransitionReducer,
} from "./routeTransitionMachine.js";

describe("máquina de transição de rota", () => {
  it("inicia, avança e conclui sem regredir o progresso", () => {
    const started = routeTransitionReducer(
      IDLE_ROUTE_TRANSITION,
      {
        type: "BEGIN",
        transition: {
          token: "transition-1",
          type: "campaign-to-loadout",
          to: "/jogar/fase_01",
          payload: {
            phaseId: "fase_01",
          },
        },
      },
    );

    const waiting = routeTransitionReducer(
      started,
      {
        type: "STAGE",
        token: "transition-1",
        status: "waiting",
        progress: 84,
      },
    );

    const staleProgress = routeTransitionReducer(
      waiting,
      {
        type: "STAGE",
        token: "transition-1",
        status: "waiting",
        progress: 40,
      },
    );

    const entering = routeTransitionReducer(
      staleProgress,
      {
        type: "ENTERING",
        token: "transition-1",
      },
    );

    expect(started.status).toBe("exiting");
    expect(waiting.progress).toBe(84);
    expect(staleProgress.progress).toBe(84);
    expect(entering).toMatchObject({
      status: "entering",
      progress: 100,
    });
  });

  it("ignora ações pertencentes a outra transição", () => {
    const started = routeTransitionReducer(
      IDLE_ROUTE_TRANSITION,
      {
        type: "BEGIN",
        transition: {
          token: "current",
          type: "campaign-to-loadout",
        },
      },
    );

    const result = routeTransitionReducer(
      started,
      {
        type: "STAGE",
        token: "stale",
        status: "waiting",
        progress: 90,
      },
    );

    expect(result).toBe(started);
  });

  it("identifica a rota pelo tipo e pelo payload", () => {
    const state = {
      ...IDLE_ROUTE_TRANSITION,
      status: "waiting",
      type: "campaign-to-loadout",
      payload: {
        phaseId: "fase_12",
      },
    };

    expect(matchesRouteTransition(
      state,
      {
        type: "campaign-to-loadout",
        phaseId: "fase_12",
      },
    )).toBe(true);

    expect(matchesRouteTransition(
      state,
      {
        phaseId: "fase_13",
      },
    )).toBe(false);
  });
});
