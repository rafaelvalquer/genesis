export const IDLE_ROUTE_TRANSITION = Object.freeze({
  status: "idle",
  token: null,
  type: null,
  to: null,
  progress: 0,
  reduceMotion: false,
  payload: null,
  error: null,
});

export function routeTransitionReducer(state, action) {
  switch (action.type) {
    case "BEGIN":
      if (state.status !== "idle") return state;

      return {
        ...IDLE_ROUTE_TRANSITION,
        ...action.transition,
        status: "exiting",
        progress: 8,
      };

    case "STAGE":
      if (!action.token || action.token !== state.token) {
        return state;
      }

      return {
        ...state,
        status: action.status,
        progress: Math.max(
          state.progress,
          Number(action.progress) || 0,
        ),
      };

    case "ENTERING":
      if (!action.token || action.token !== state.token) {
        return state;
      }

      return {
        ...state,
        status: "entering",
        progress: 100,
      };

    case "FAIL":
      if (!action.token || action.token !== state.token) {
        return state;
      }

      return {
        ...state,
        status: "error",
        error: action.error || null,
      };

    case "RESET":
      return IDLE_ROUTE_TRANSITION;

    default:
      return state;
  }
}

export function matchesRouteTransition(state, criteria = {}) {
  if (!state || state.status === "idle") return false;

  return Object.entries(criteria).every(
    ([key, value]) => (
      value === undefined
      || state[key] === value
      || state.payload?.[key] === value
    ),
  );
}
