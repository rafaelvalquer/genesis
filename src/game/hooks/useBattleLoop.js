import { useEffect, useMemo, useRef } from "react";

export function useLatestValueRef(value) {
  const reference = useRef(value);
  useEffect(() => {
    reference.current = value;
  }, [value]);
  return reference;
}

export function useBattleLoopControls(paused, speed) {
  const pausedRef = useLatestValueRef(paused);
  const speedRef = useLatestValueRef(speed);
  return useMemo(() => ({ pausedRef, speedRef }), [pausedRef, speedRef]);
}
