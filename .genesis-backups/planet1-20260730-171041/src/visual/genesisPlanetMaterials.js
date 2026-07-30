import { compressGenesisRelief } from "./compressGenesisRelief.js";
import { configureGenesisMoons } from "./configureGenesisMoons.js";
import { getGenesisPresentation } from "./genesisPlanetPresentation.js";
import { smoothGenesisGeometry } from "./smoothGenesisGeometry.js";

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
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: .82,
      metalness: .02,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
      dithering: true,
    });
  } else if (name.includes("Atmosphere")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .12,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  } else if (name.includes("Clouds")) {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors, transparent: true, opacity: .25, depthWrite: false,
    });
  } else {
    const properties = name.includes("IceSpikes")
      ? { roughness: .65, metalness: .04 }
      : name.includes("CrystalSpires")
        ? { roughness: .34, metalness: .14 }
        : name.includes("SwampPods")
          ? { roughness: .88, metalness: 0 }
          : { roughness: .72, metalness: .04 };
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      ...properties,
      emissive: 0x000000,
      emissiveIntensity: 0,
      flatShading: false,
    });
  }
  preserveTextureSlots(original, material);
  original?.dispose();
  material.userData.genesisBaseOpacity = material.opacity;
  return material;
}

export function getGenesisPlanetParts(model, layout = {}) {
  const surfaceRoot = layout.surfaceRoot || model.getObjectByName("GenesisPlanetSurfaceRoot");
  const moonRoot = layout.moonRoot || model.getObjectByName("GenesisMoonsRoot");
  const beaconRoot = layout.beaconRoot || model.getObjectByName("GenesisBeaconsRoot");
  const ringedMoonRoot = layout.ringedMoonRoot || model.getObjectByName("GenesisMoon_RingedRoot");
  const parts = {
    mainPlanet: null,
    surfaceRoot,
    atmosphere: null,
    clouds: null,
    structures: [],
    moons: [],
    moonRoot,
    beacons: {},
    beaconRoot,
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
    else if (object.name.includes("IceSpikes") || object.name.includes("CrystalSpires") || object.name.includes("SwampPods")) {
      parts.structures.push(object);
    }
    const chapterId = beaconByName[object.name];
    if (chapterId) parts.beacons[chapterId] = object;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    parts.materials.push(...materials.filter(Boolean));
  });
  if (moonRoot) {
    parts.moons = moonRoot.children.filter((object) => (
      object !== ringedMoonRoot
      ? object.name.startsWith("GenesisMoon_")
      : true
    ));
  } else {
    const flatMoons = [
      "GenesisMoon_Rocky", "GenesisMoon_Lava", "GenesisMoon_Blue", "GenesisMoon_Red",
    ].map((name) => model.getObjectByName(name)).filter(Boolean);
    if (ringedMoonRoot) flatMoons.push(ringedMoonRoot);
    else {
      const ringed = model.getObjectByName("GenesisMoon_Ringed");
      if (ringed) flatMoons.push(ringed);
    }
    parts.moons = flatMoons;
  }
  parts.materials = [...new Set(parts.materials)];
  return parts;
}

function setObjectRenderOrder(object, renderOrder) {
  object?.traverse((child) => {
    if (child.isMesh) child.renderOrder = renderOrder;
  });
}

export function prepareGenesisPlanetModel(THREE, model, layout) {
  const smoothPartNames = new Set([
    "GenesisWorld_MainPlanet",
    "GenesisWorld_IceSpikes",
    "GenesisWorld_CrystalSpires",
    "GenesisWorld_SwampPods",
    "GenesisMoon_Rocky",
    "GenesisMoon_Lava",
    "GenesisMoon_Blue",
    "GenesisMoon_Red",
    "GenesisMoon_Ringed",
  ]);
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (smoothPartNames.has(object.name)) smoothGenesisGeometry(object.geometry);
    else if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
    object.material = materialForPart(THREE, object);
  });
  const parts = getGenesisPlanetParts(model, layout);
  setObjectRenderOrder(parts.mainPlanet, 0);
  parts.structures.forEach((structure) => setObjectRenderOrder(structure, 1));
  parts.moons.forEach((moon) => setObjectRenderOrder(moon, 1));
  setObjectRenderOrder(parts.clouds, 2);
  setObjectRenderOrder(parts.atmosphere, 3);
  Object.values(parts.beacons).forEach((beacon) => setObjectRenderOrder(beacon, 1));
  return parts;
}

export function applyGenesisPlanetChapterState({ THREE, parts, chapter, biome }) {
  if (!parts) return;
  if (parts.atmosphere) {
    parts.atmosphere.material.color.set(0xffffff).lerp(new THREE.Color(biome.atmosphere), .1);
  }
  Object.entries(parts.beacons).forEach(([chapterId, beacon]) => {
    const active = chapterId === chapter.id;
    beacon.material.emissive.set(active ? chapter.palette.primary : 0x000000);
    beacon.material.emissiveIntensity = active ? .85 : .08;
  });
}

export function setGenesisPlanetOpacity(parts, opacity) {
  parts?.materials.forEach((material) => {
    material.transparent = opacity < 1 || material.userData.genesisBaseOpacity < 1;
    material.opacity = material.userData.genesisBaseOpacity * opacity;
  });
}

export function applyGenesisPlanetQuality(
  parts,
  quality,
  { THREE, model, layout, presentationMode = "campaign" } = {},
) {
  if (!parts) return;
  const low = quality.quality === "low";
  const presentation = getGenesisPresentation(quality, presentationMode);
  configureGenesisMoons(parts, quality, presentationMode);
  if (THREE && model && layout) {
    parts.structures.forEach((structure) => {
      compressGenesisRelief({
        THREE,
        mesh: structure,
        planetRoot: model,
        baseRadius: layout.sourceRadius,
        factor: presentation.relief[structure.name],
      });
    });
  }
  if (parts.clouds) {
    parts.clouds.visible = presentation.cloudsOpacity > 0;
    parts.clouds.material.userData.genesisBaseOpacity = presentation.cloudsOpacity;
  }
  if (parts.atmosphere) {
    parts.atmosphere.visible = true;
    parts.atmosphere.material.userData.genesisBaseOpacity = presentation.atmosphereOpacity;
  }
  if (parts.beaconRoot) parts.beaconRoot.visible = !low;
  parts.structures.forEach((structure, index) => { structure.visible = !low || index === 0; });
}
