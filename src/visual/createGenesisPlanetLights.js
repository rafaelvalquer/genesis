export function createGenesisPlanetLights(THREE, scene, biome) {
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(3, 2, 4);
  const fillLight = new THREE.HemisphereLight(0xffffff, biome.ambient, 2.15);
  const rimLight = new THREE.DirectionalLight(biome.atmosphere, .85);
  rimLight.position.set(-3, .5, -2);
  scene.add(keyLight, fillLight, rimLight);
  return { keyLight, fillLight, rimLight };
}

export function applyGenesisLightState(lights, biome) {
  lights.keyLight.color.set(0xffffff);
  lights.fillLight.color.set(0xffffff);
  lights.fillLight.groundColor.set(biome.ambient);
  lights.rimLight.color.set(biome.atmosphere);
}
