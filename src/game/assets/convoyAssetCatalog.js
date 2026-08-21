import { CONVOY_ANIMATION_CONFIG } from "../chapter07/convoyAnimationConfig.js";

const modules = import.meta.glob("./convoy/*/*/*.webp", { query: "?url", import: "default" });
const loadedFrames = new Map();
const key = (vehicleId, state) => `${vehicleId}:${state}`;
const entriesFor = (vehicleId, state) => Object.entries(modules)
  .filter(([file]) => file.includes(`/convoy/${vehicleId}/${state}/`)).sort(([left], [right]) => left.localeCompare(right));

export const getConvoyFrames = (vehicleId, state) => loadedFrames.get(key(vehicleId, state)) || [];
export const hasConvoyAnimation = (vehicleId, state) => Boolean(CONVOY_ANIMATION_CONFIG[state]) && entriesFor(vehicleId, state).length > 0;
export const getConvoyAnimationFrameCount = (vehicleId, state) => entriesFor(vehicleId, state).length;
export async function loadConvoyAssets(vehicleId) {
  await Promise.all(Object.keys(CONVOY_ANIMATION_CONFIG).map(async (state) => {
    const urls = await Promise.all(entriesFor(vehicleId, state).map(([, loader]) => loader()));
    loadedFrames.set(key(vehicleId, state), urls);
  }));
  return Object.fromEntries(Object.keys(CONVOY_ANIMATION_CONFIG).map((state) => [state, getConvoyFrames(vehicleId, state)]));
}
