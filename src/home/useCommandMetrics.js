import { useMemo } from "react";
import { getCommandMetrics } from "./commandMetrics.js";

export function useCommandMetrics(campaign) {
  return useMemo(() => getCommandMetrics(campaign), [campaign]);
}
