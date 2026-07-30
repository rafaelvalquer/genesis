export function createGenesisPlanetLights(THREE, scene, biome) {
  const keyLight = new THREE.DirectionalLight(biome.light, 2);
  keyLight.position.set(3.5, 2.4, 4.5);
  const fillLight = new THREE.HemisphereLight(biome.atmosphere, biome.ambient, .82);
  const rimLight = new THREE.DirectionalLight(biome.atmosphere, .65);
  rimLight.position.set(-3, .8, -3.5);
  const ambientLight = new THREE.AmbientLight(0xffffff, .08);
  scene.add(keyLight, fillLight, rimLight, ambientLight);
  return { keyLight, fillLight, rimLight, ambientLight };
}

export function applyGenesisLightState(lights, biome) {
  lights.keyLight.color.set(biome.light);
  lights.fillLight.color.set(biome.atmosphere);
  lights.fillLight.groundColor.set(biome.ambient);
  lights.rimLight.color.set(biome.atmosphere);
}
