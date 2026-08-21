import { CELL, FIELD } from "../visualGeometry.js";

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const getConvoyStartX = () => FIELD.combatOffsetX + CELL.width * 0.35;
export const getConvoyDestinationX = () => FIELD.spawnX - CELL.width * 0.7;
export const getConvoyProgress = (x) => clamp((x - getConvoyStartX()) / (getConvoyDestinationX() - getConvoyStartX()), 0, 1);
export const getConvoyXForProgress = (progress) => getConvoyStartX() + (getConvoyDestinationX() - getConvoyStartX()) * clamp(progress, 0, 1);
export const getConvoyColumn = (convoy) => clamp(Math.floor((convoy?.x || getConvoyStartX()) / CELL.width), 0, FIELD.cols - 1);
export const getConvoySpeed = (phase) => (getConvoyDestinationX() - getConvoyStartX())
  / (Math.max(1, phase?.convoy?.targetUninterruptedTravelMs || 180000) / 1000);
