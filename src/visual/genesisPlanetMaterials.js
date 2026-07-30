export const CHAPTER_BEACON_NAMES = Object.freeze({
  chapter_01: "Beacon_Colony",
  chapter_02: "Beacon_Glass",
  chapter_03: "Beacon_Chitin",
  chapter_04: "Beacon_Storm",
});

const TEXTURE_KEYS = [
  "map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap",
  "envMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap",
];

function preserveTextureSlots(source, target) {
  TEXTURE_KEYS.forEach((key) => {
    if (source?.[key]?.isTexture) target[key] = source[key];
  });
}

function materialForPart(THREE, object) {
  const name = object.name || "";
  const original = Array.isArray(object.material) ? object.material[0] : object.material;
  const vertexColors = Boolean(object.geometry.getAttribute("color"));
  let material;
  if (name.includes("MainPlanet")) {
    // The source has COLOR_0 but no authored normals or PBR material. Keeping the
    // surface unlit preserves the exact multibiome palette on every GPU.
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, toneMapped: false,
    });
  } else if (name.includes("Atmosphere")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .16,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  } else if (name.includes("Clouds")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .42, depthWrite: false,
    });
  } else {
    const crystal = name.includes("Crystal");
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      roughness: crystal ? .38 : .7,
      metalness: crystal ? .18 : .04,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
  }
  preserveTextureSlots(original, material);
  original?.dispose();
  material.userData.genesisBaseOpacity = material.opacity;
  return material;
}

export function getGenesisPlanetParts(model) {
  const parts = {
    mainPlanet: null,
    atmosphere: null,
    clouds: null,
    structures: [],
    moons: [],
    beacons: {},
    materials: [],
  };
  const beaconByName = Object.fromEntries(
    Object.entries(CHAPTER_BEACON_NAMES).map(([chapterId, name]) => [name, chapterId]),
  );
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name === "GenesisWorld_MainPlanet") parts.mainPlanet = object;
    else if (object.name === "GenesisWorld_Atmosphere") parts.atmosphere = object;
    else if (object.name === "GenesisWorld_Clouds") parts.clouds = object;
    else if (object.name.startsWith("GenesisMoon_")) parts.moons.push(object);
    else if (object.name.includes("IceSpikes") || object.name.includes("CrystalSpires") || object.name.includes("SwampPods")) {
      parts.structures.push(object);
    }
    const chapterId = beaconByName[object.name];
    if (chapterId) parts.beacons[chapterId] = object;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    parts.materials.push(...materials.filter(Boolean));
  });
  return parts;
}

export function prepareGenesisPlanetModel(THREE, model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
    object.material = materialForPart(THREE, object);
  });
  return getGenesisPlanetParts(model);
}

export function applyGenesisPlanetChapterState({ THREE, parts, chapter, biome }) {
  if (!parts) return;
  if (parts.atmosphere) {
    parts.atmosphere.material.color.set(0xffffff).lerp(new THREE.Color(biome.atmosphere), .15);
  }
  Object.entries(parts.beacons).forEach(([chapterId, beacon]) => {
    const active = chapterId === chapter.id;
    beacon.material.emissive.set(active ? chapter.palette.primary : 0x000000);
    beacon.material.emissiveIntensity = active ? 1.1 : .12;
  });
}

export function setGenesisPlanetOpacity(parts, opacity) {
  parts?.materials.forEach((material) => {
    material.transparent = opacity < 1 || material.userData.genesisBaseOpacity < 1;
    material.opacity = material.userData.genesisBaseOpacity * opacity;
  });
}

export function applyGenesisPlanetQuality(parts, quality) {
  if (!parts) return;
  const low = quality.quality === "low";
  const medium = quality.quality === "medium";
  parts.moons.forEach((moon, index) => { moon.visible = !low && (!medium || index < 3); });
  if (parts.clouds) {
    parts.clouds.visible = !low;
    parts.clouds.material.userData.genesisBaseOpacity = medium ? .28 : .42;
  }
  parts.structures.forEach((structure, index) => { structure.visible = !low || index === 0; });
}
