import { loadGltfModel, cloneGltfScene } from "./loadGltfModel.js";
import { normalizeGenesisPlanet } from "./normalizeGenesisPlanet.js";
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

export async function createGenesisPlanetInstance({
  THREE, quality, chapter, biome, opacity = 1, presentationMode = "campaign",
}) {
  const gltf = await loadGenesisPlanet();
  const model = cloneGenesisPlanet(gltf);
  const layout = normalizeGenesisPlanet({ THREE, model, targetRadius: 1 });
  const parts = prepareGenesisPlanetModel(THREE, model, layout);
  applyGenesisPlanetQuality(parts, quality, {
    THREE, model, layout, presentationMode,
  });
  applyGenesisPlanetChapterState({ THREE, parts, chapter, biome });
  setGenesisPlanetOpacity(parts, opacity);
  return { model, parts, layout, url: GENESIS_PLANET_URL };
}

export { applyGenesisPlanetChapterState, setGenesisPlanetOpacity };
