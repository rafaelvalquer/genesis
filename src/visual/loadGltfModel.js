const modelPromises = new Map();

export async function loadGltfModel(url) {
  if (!modelPromises.has(url)) {
    modelPromises.set(url, import("three/addons/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .catch((error) => {
        modelPromises.delete(url);
        throw error;
      }));
  }
  return modelPromises.get(url);
}

function cloneMaterialTextures(material) {
  Object.keys(material).forEach((key) => {
    const value = material[key];
    if (!value?.isTexture) return;
    material[key] = value.clone();
    material[key].needsUpdate = true;
    material[key].userData.instanceOwned = true;
  });
}

export function cloneGltfScene(gltf, options = {}) {
  const {
    cloneGeometries = true,
    cloneMaterials = true,
    cloneTextures = true,
  } = options;
  const instance = gltf.scene.clone(true);
  instance.traverse((object) => {
    if (!object.isMesh) return;
    if (cloneGeometries) object.geometry = object.geometry?.clone();
    if (!cloneMaterials) return;
    if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
    else object.material = object.material?.clone();
    if (cloneTextures) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(cloneMaterialTextures);
    }
  });
  return instance;
}

export function clearGltfCache() {
  modelPromises.clear();
}
