export function disposeThreeObject(root) {
  root?.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture && value.userData?.instanceOwned === true) value.dispose();
      });
      material.dispose();
    });
  });
}
