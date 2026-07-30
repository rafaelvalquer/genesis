import { loadGltfModel, cloneGltfScene } from "./loadGltfModel.js";
import { normalizeModelToRadius } from "./normalizeGltfModel.js";
import {
  applyGenesisPlanetChapterState,
  applyGenesisPlanetQuality,
  prepareGenesisPlanetModel,
  setGenesisPlanetOpacity,
} from "./genesisPlanetMaterials.js";

export const GENESIS_PLANET_URL = "/models/command/genesis-planeta-multibiomas.glb";
export const GENESIS_PLANET_LOW_URL = "/models/command/genesis-planeta-multibiomas-low.glb";

export const loadGenesisPlanet = () => loadGltfModel(GENESIS_PLANET_URL);
export const cloneGenesisPlanet = (gltf) => cloneGltfScene(gltf, {
  cloneGeometries: true,
  cloneMaterials: true,
  cloneTextures: true,
});

export async function createGenesisPlanetInstance({ THREE, quality, chapter, biome, opacity = 1 }) {
  const gltf = await loadGenesisPlanet();
  const model = cloneGenesisPlanet(gltf);
  normalizeModelToRadius(THREE, model, 1, "GenesisWorld_MainPlanet");
  const parts = prepareGenesisPlanetModel(THREE, model);
  applyGenesisPlanetQuality(parts, quality);
  applyGenesisPlanetChapterState({ THREE, parts, chapter, biome });
  setGenesisPlanetOpacity(parts, opacity);
  return { model, parts, url: GENESIS_PLANET_URL };
}

export { applyGenesisPlanetChapterState, setGenesisPlanetOpacity };
