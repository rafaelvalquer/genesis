import { loadGltfModel, cloneGltfScene } from "./loadGltfModel.js";
import { normalizeGenesisPlanet } from "./normalizeGenesisPlanet.js";
import { adaptGenesisPlanetAsset } from "./adaptGenesisPlanetAsset.js";
import {
  applyGenesisPlanetChapterState,
  applyGenesisPlanetQuality,
  prepareGenesisPlanetModel,
  setGenesisPlanetOpacity,
  updateGenesisPlanetClouds,
} from "./genesisPlanetMaterials.js";

export const GENESIS_PLANET_URL = `${import.meta.env.BASE_URL}models/command/genesis-planeta-multibiomas1.glb`;

// Mantido para compatibilidade com imports/testes existentes.
// Enquanto não houver um LOD específico, ambos apontam para o mesmo asset.
export const GENESIS_PLANET_LOW_URL = GENESIS_PLANET_URL;

export const loadGenesisPlanet = () => loadGltfModel(GENESIS_PLANET_URL);

export const cloneGenesisPlanet = (gltf) => cloneGltfScene(gltf, {
  cloneGeometries: true,
  cloneMaterials: true,
  cloneTextures: true,
});

export async function createGenesisPlanetInstance({
  THREE,
  quality,
  chapter,
  biome,
  opacity = 1,
  presentationMode = "campaign",
}) {
  const gltf = await loadGenesisPlanet();
  const model = cloneGenesisPlanet(gltf);

  const asset = adaptGenesisPlanetAsset(model);

  const layout = normalizeGenesisPlanet({
    THREE,
    model,
    targetRadius: 1,
  });

  const parts = prepareGenesisPlanetModel(THREE, model, layout);

  applyGenesisPlanetQuality(parts, quality, {
    THREE,
    model,
    layout,
    presentationMode,
  });

  applyGenesisPlanetChapterState({
    THREE,
    parts,
    chapter,
    biome,
  });

  setGenesisPlanetOpacity(parts, opacity);

  return {
    model,
    parts,
    layout,
    asset,
    url: GENESIS_PLANET_URL,
  };
}

export {
  applyGenesisPlanetChapterState,
  setGenesisPlanetOpacity,
  updateGenesisPlanetClouds,
};
