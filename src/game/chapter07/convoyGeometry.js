import { CELL, FIELD } from "../visualGeometry.js";

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const CONVOY_RENDER_WIDTH = 224;
export const getConvoyEntryX = () => -(CONVOY_RENDER_WIDTH / 2 + 24);
export const getConvoyRouteStartX = () => FIELD.combatOffsetX + CELL.width * 0.35;
// Kept as a compatibility alias for callers that mean the strategic route start.
export const getConvoyStartX = getConvoyRouteStartX;
export const getConvoyDestinationX = () => FIELD.spawnX - CELL.width * 0.7;
export const getConvoyProgress = (x) => clamp((x - getConvoyRouteStartX()) / (getConvoyDestinationX() - getConvoyRouteStartX()), 0, 1);
export const getConvoyXForProgress = (progress) => getConvoyRouteStartX() + (getConvoyDestinationX() - getConvoyRouteStartX()) * clamp(progress, 0, 1);
export const getConvoyColumn = (convoy) => clamp(Math.floor((convoy?.x ?? getConvoyRouteStartX()) / CELL.width), 0, FIELD.cols - 1);
export const getConvoySpeed = (phase) => (getConvoyDestinationX() - getConvoyRouteStartX())
  / (Math.max(1, phase?.convoy?.targetUninterruptedTravelMs || 180000) / 1000);
