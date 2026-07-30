const DEFAULT_CLOUD_SHELL_SCALE = 1.015;

function getObjectMaterials(object) {
  if (!object?.isMesh) return [];
  return (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean);
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function hasMaterialName(object, materialNames) {
  const accepted = new Set(materialNames.map(normalizeName));
  return getObjectMaterials(object).some((material) => accepted.has(normalizeName(material.name)));
}

function findMesh(model, {
  acceptedNames = [],
  materialNames = [],
} = {}) {
  const acceptedObjectNames = new Set(acceptedNames.map(normalizeName));
  let result = null;

  model.traverse((object) => {
    if (result || !object.isMesh) return;

    const matchesName = acceptedObjectNames.has(normalizeName(object.name));
    const matchesMaterial = hasMaterialName(object, materialNames);

    if (matchesName || matchesMaterial) result = object;
  });

  return result;
}

function assignContractName(object, contractName) {
  if (!object) return null;

  object.userData.genesisSourceName ??= object.name;
  object.name = contractName;

  return object;
}

function expandCloudShell(clouds, scale = DEFAULT_CLOUD_SHELL_SCALE) {
  if (!clouds || clouds.userData.genesisCloudShellExpanded) return;

  clouds.userData.genesisOriginalScale = clouds.scale.toArray();
  clouds.scale.multiplyScalar(scale);
  clouds.userData.genesisCloudShellExpanded = true;
  clouds.userData.genesisCloudShellScale = scale;
}

/**
 * Converte a hierarquia/nomenclatura do novo GLB para o contrato interno usado
 * pelas telas Comando Orbital e Campanha.
 *
 * O asset genesis-planeta-multibiomas1.glb exporta:
 * - Object_4 com material "Planet"
 * - Object_6 com material "Clouds"
 *
 * O runtime Genesis espera:
 * - GenesisWorld_MainPlanet
 * - GenesisWorld_Clouds
 */
export function adaptGenesisPlanetAsset(model, {
  cloudShellScale = DEFAULT_CLOUD_SHELL_SCALE,
} = {}) {
  if (!model) throw new Error("Modelo GLB do planeta não informado");

  const mainPlanet = findMesh(model, {
    acceptedNames: [
      "GenesisWorld_MainPlanet",
      "Object_4",
    ],
    materialNames: [
      "Planet",
    ],
  });

  if (!mainPlanet) {
    throw new Error(
      'O GLB não contém uma malha reconhecida como planeta principal. '
      + 'Esperado: material "Planet" ou node "GenesisWorld_MainPlanet".',
    );
  }

  const clouds = findMesh(model, {
    acceptedNames: [
      "GenesisWorld_Clouds",
      "Object_6",
    ],
    materialNames: [
      "Clouds",
    ],
  });

  assignContractName(mainPlanet, "GenesisWorld_MainPlanet");
  assignContractName(clouds, "GenesisWorld_Clouds");

  // O novo GLB usa uma esfera de nuvens com o mesmo raio da superfície.
  // A pequena expansão evita z-fighting sem alterar a origem do asset.
  expandCloudShell(clouds, cloudShellScale);

  mainPlanet.userData.genesisAuthoredPlanet = true;
  if (clouds) clouds.userData.genesisAuthoredClouds = true;

  const atmosphere = model.getObjectByName("GenesisWorld_Atmosphere");

  return {
    mainPlanet,
    clouds,
    atmosphere,
    hasAuthoredAtmosphere: Boolean(atmosphere),
    sourceNames: {
      mainPlanet: mainPlanet.userData.genesisSourceName || mainPlanet.name,
      clouds: clouds?.userData.genesisSourceName || clouds?.name || null,
    },
  };
}

export { DEFAULT_CLOUD_SHELL_SCALE };
