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

export function cloneGltfScene(gltf) {
  const instance = gltf.scene.clone(true);
  instance.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry = object.geometry?.clone();
    if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
    else object.material = object.material?.clone();
  });
  return instance;
}

export function clearGltfCache() {
  modelPromises.clear();
}
