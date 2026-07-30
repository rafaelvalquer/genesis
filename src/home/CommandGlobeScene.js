import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { createChapterPhaseVectors, getTargetRotationForPhase } from "../visual/campaignPlanetCoordinates.js";
import { createChapterRoutes } from "../visual/campaignPlanetRoutes.js";
import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";
import { disposeThreeObject } from "../visual/disposeThreeObject.js";
import { cloneGltfScene, loadGltfModel } from "../visual/loadGltfModel.js";
import { centerAndScaleModel, normalizeModelToRadius } from "../visual/normalizeGltfModel.js";

const PLANET_URL = "/models/command/genesis-planeta-multibiomas.glb";
const ROCKET_URL = "/models/command/low-poly-rocket-ship.glb";
const MODEL_ORIENTATION = { x: 0, y: 0, z: 0 };
const ROCKET_MODEL_ROTATION = { x: -Math.PI / 2, y: 0, z: Math.PI / 2 };

const vertexShader = `
  uniform float uTime;
  uniform float uMotion;
  varying float vRidge;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    float ridge = sin(position.x * 11.0 + uTime * .08 * uMotion) * sin(position.y * 13.0) * sin(position.z * 9.0);
    vec3 displaced = position + normal * ridge * .016;
    vRidge = ridge * .5 + .5;
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform vec3 uDark;
  uniform vec3 uMid;
  uniform vec3 uAccent;
  varying float vRidge;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.3);
    vec3 base = mix(uDark, uMid, smoothstep(.12, .86, vRidge));
    gl_FragColor = vec4(base + uAccent * rim * .24, 1.0);
  }
`;

function makePoints(THREE, count, minRadius, spread, color, size) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = minRadius + Math.random() * spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color, size, transparent: true, opacity: .72, depthWrite: false,
  }));
}

function replaceMaterial(THREE, object, biome) {
  const name = object.name || "";
  if (!object.isMesh) return;
  object.material?.dispose();
  if (name.includes("Atmosphere")) {
    object.material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: .12, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
  } else if (name.includes("Clouds")) {
    object.material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: .38, depthWrite: false,
    });
  } else if (name.startsWith("Beacon_")) {
    object.material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: .42, metalness: .12,
      emissive: new THREE.Color(biome.accent), emissiveIntensity: .65,
    });
  } else {
    object.material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: name.includes("Crystal") ? .45 : .82,
      metalness: name.includes("Crystal") ? .18 : .06,
      emissive: new THREE.Color(name.includes("Spikes") || name.includes("Pods") ? biome.accent : biome.surface[1]),
      emissiveIntensity: name.includes("Spikes") || name.includes("Pods") ? .24 : .48,
    });
  }
  object.material.userData.commandTargetOpacity = object.material.opacity;
}

function preparePlanetMaterials(model, opacity) {
  const materials = [];
  model.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    entries.forEach((material) => {
      material.userData.commandTargetOpacity ??= material.opacity;
      material.transparent = true;
      material.opacity = material.userData.commandTargetOpacity * opacity;
      materials.push(material);
    });
  });
  return materials;
}

function createMarkerMesh(THREE, phase, state, chapter) {
  const color = state.boss && state.accessible ? "#fb7185"
    : state.current ? chapter.palette.accent
      : state.completed ? chapter.palette.primary
        : state.accessible ? "#d7f5ff" : "#334755";
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(state.current ? .045 : .025, state.current ? .078 : .045, 20),
    new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide, transparent: true, opacity: state.locked ? .32 : .92,
      depthWrite: false,
    }),
  );
  group.add(ring);
  if (state.current) {
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(.09, .098, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .55, depthWrite: false }),
    );
    group.add(outer);
  }
  group.userData.phaseId = phase.id;
  group.userData.state = state.key;
  return group;
}

export function supportsCommandWebGL() {
  if (import.meta.env.MODE === "test") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export async function createCommandGlobeScene({
  mount, chapter, phases, campaign, selectedPhase, quality, markerElements,
}) {
  if (!supportsCommandWebGL()) throw new Error("WebGL 2 indisponível");
  const THREE = await import("three");
  const biome = getCampaignBiome(chapter.id);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#030712", .042);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, .04, quality.reduceMotion ? 4.25 : 5.45);
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: quality.quality !== "low", powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setClearColor(0x02040a, 0);
  mount.appendChild(renderer.domElement);

  const planetAnchor = new THREE.Group();
  scene.add(planetAnchor);
  const uniforms = {
    uTime: { value: 0 }, uMotion: { value: quality.reduceMotion ? 0 : 1 },
    uDark: { value: new THREE.Color(biome.surface[0]) },
    uMid: { value: new THREE.Color(biome.surface[1]) },
    uAccent: { value: new THREE.Color(biome.accent) },
  };
  const proceduralMaterial = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true,
  });
  const proceduralPlanet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, quality.quality === "low" ? 3 : 5),
    proceduralMaterial,
  );
  planetAnchor.add(proceduralPlanet);
  const proceduralAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.09, quality.atmosphereSegments, quality.atmosphereSegments / 2),
    new THREE.MeshBasicMaterial({
      color: biome.atmosphere, transparent: true, opacity: .15, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  planetAnchor.add(proceduralAtmosphere);

  const keyLight = new THREE.DirectionalLight(biome.light, 2.5);
  keyLight.position.set(3, 2, 4);
  scene.add(keyLight);
  const fillLight = new THREE.HemisphereLight(biome.atmosphere, biome.ambient, 1.55);
  scene.add(fillLight);
  const stars = makePoints(THREE, Math.max(80, quality.orbitalParticles * 3), 5, 18, "#bde7ff", .023);
  const particles = makePoints(THREE, quality.orbitalParticles, 1.3, 1.9, biome.particle, .017);
  scene.add(stars, particles);

  const runtime = {
    THREE, scene, camera, renderer, planetAnchor, planetGroup: planetAnchor,
    atmosphere: proceduralAtmosphere, keyLight, fillLight, uniforms,
    markerVectors: new Map(), markerElements, phaseMarkerGroup: null, routeGroup: null,
    selectedPhaseId: selectedPhase.id, currentChapter: chapter, currentPhases: phases,
    dragging: false, velocityX: 0, velocityY: 0, disposed: false, killAuto: null,
    targetRotation: getTargetRotationForPhase(selectedPhase.id),
    glbPlanet: null, glbMaterials: [], glbFade: 0,
    rocketOrbitGroup: null, rocketPivot: null, engineGlow: null,
  };
  planetAnchor.rotation.set(runtime.targetRotation.x, runtime.targetRotation.y, runtime.targetRotation.z);

  runtime.setChapter = (nextChapter, nextPhases, nextCampaign, nextSelected) => {
    if (runtime.routeGroup) {
      planetAnchor.remove(runtime.routeGroup);
      disposeThreeObject(runtime.routeGroup);
    }
    if (runtime.phaseMarkerGroup) {
      planetAnchor.remove(runtime.phaseMarkerGroup);
      disposeThreeObject(runtime.phaseMarkerGroup);
    }
    runtime.currentChapter = nextChapter;
    runtime.currentPhases = nextPhases;
    runtime.selectedPhaseId = nextSelected.id;
    runtime.markerVectors = createChapterPhaseVectors(THREE, nextChapter);
    runtime.routeGroup = createChapterRoutes(THREE, nextChapter, nextPhases, nextCampaign, runtime.markerVectors);
    planetAnchor.add(runtime.routeGroup);
    runtime.phaseMarkerGroup = new THREE.Group();
    nextPhases.forEach((phase) => {
      const state = getCampaignPhaseState(phase, nextCampaign);
      const marker = createMarkerMesh(THREE, phase, state, nextChapter);
      marker.position.copy(runtime.markerVectors.get(phase.id));
      marker.lookAt(marker.position.clone().multiplyScalar(2));
      runtime.phaseMarkerGroup.add(marker);
    });
    planetAnchor.add(runtime.phaseMarkerGroup);
    const nextBiome = getCampaignBiome(nextChapter.id);
    uniforms.uDark.value.set(nextBiome.surface[0]);
    uniforms.uMid.value.set(nextBiome.surface[1]);
    uniforms.uAccent.value.set(nextBiome.accent);
    proceduralAtmosphere.material.color.set(nextBiome.atmosphere);
    particles.material.color.set(nextBiome.particle);
    keyLight.color.set(nextBiome.light);
    fillLight.color.set(nextBiome.atmosphere);
    if (runtime.glbPlanet) {
      runtime.glbPlanet.traverse((object) => replaceMaterial(THREE, object, nextBiome));
      runtime.glbMaterials = preparePlanetMaterials(runtime.glbPlanet, runtime.glbFade);
    }
    runtime.focusPhase(nextSelected.id, !runtime.initialized);
    runtime.initialized = true;
  };

  runtime.focusPhase = (phaseId, immediate = false) => {
    runtime.selectedPhaseId = phaseId;
    runtime.targetRotation = getTargetRotationForPhase(phaseId);
    if (immediate || quality.reduceMotion) {
      planetAnchor.rotation.set(runtime.targetRotation.x, runtime.targetRotation.y, runtime.targetRotation.z);
    }
  };
  runtime.setChapter(chapter, phases, campaign, selectedPhase);

  if (quality.quality !== "low") {
    loadGltfModel(PLANET_URL).then((gltf) => {
      const model = cloneGltfScene(gltf);
      if (runtime.disposed) return disposeThreeObject(model);
      normalizeModelToRadius(THREE, model, 1, "GenesisWorld_MainPlanet");
      model.rotation.set(MODEL_ORIENTATION.x, MODEL_ORIENTATION.y, MODEL_ORIENTATION.z);
      model.traverse((object) => replaceMaterial(THREE, object, getCampaignBiome(runtime.currentChapter.id)));
      runtime.glbPlanet = model;
      runtime.glbFade = 0;
      runtime.glbMaterials = preparePlanetMaterials(model, 0);
      planetAnchor.add(model);
    }).catch((error) => console.warn("Planeta GLB indisponível; mantendo fallback procedural.", error));
  }

  loadGltfModel(ROCKET_URL).then((gltf) => {
    const model = cloneGltfScene(gltf);
    if (runtime.disposed) return disposeThreeObject(model);
    centerAndScaleModel(THREE, model, .24);
    model.rotation.set(ROCKET_MODEL_ROTATION.x, ROCKET_MODEL_ROTATION.y, ROCKET_MODEL_ROTATION.z);
    const orbitGroup = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.add(model);
    const glow = new THREE.Mesh(
      new THREE.ConeGeometry(.025, .12, 8),
      new THREE.MeshBasicMaterial({
        color: getCampaignBiome(runtime.currentChapter.id).atmosphere,
        transparent: true, opacity: quality.quality === "low" ? .38 : .68,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.z = .16;
    pivot.add(glow);
    orbitGroup.add(pivot);
    scene.add(orbitGroup);
    runtime.rocketOrbitGroup = orbitGroup;
    runtime.rocketPivot = pivot;
    runtime.engineGlow = glow;
  }).catch((error) => console.warn("Foguete GLB indisponível; elemento orbital omitido.", error));

  let frameId = 0;
  let visible = document.visibilityState !== "hidden";
  const onVisibility = () => { visible = document.visibilityState !== "hidden"; };
  document.addEventListener("visibilitychange", onVisibility);
  const timer = new THREE.Timer();
  timer.connect(document);
  const resize = () => {
    const rect = mount.getBoundingClientRect();
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  resize();
  const temp = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const nextRocketPosition = new THREE.Vector3();
  let elapsed = 0;

  const frame = (timestamp) => {
    if (runtime.disposed) return;
    frameId = requestAnimationFrame(frame);
    if (!visible) return;
    timer.update(timestamp);
    const delta = Math.min(.04, timer.getDelta());
    elapsed += delta;
    uniforms.uTime.value += delta;
    if (runtime.glbPlanet && runtime.glbFade < 1) {
      runtime.glbFade = Math.min(1, runtime.glbFade + delta * 1.8);
      proceduralMaterial.opacity = 1 - runtime.glbFade;
      proceduralAtmosphere.material.opacity = .15 * (1 - runtime.glbFade);
      runtime.glbMaterials.forEach((material) => {
        material.opacity = material.userData.commandTargetOpacity * runtime.glbFade;
      });
    }
    if (!runtime.dragging && !quality.reduceMotion) {
      planetAnchor.rotation.x = THREE.MathUtils.clamp(planetAnchor.rotation.x + runtime.velocityX, -.8, .8);
      planetAnchor.rotation.y += runtime.velocityY + .00018;
      runtime.velocityX *= .9;
      runtime.velocityY *= .9;
      particles.rotation.y += delta * .018;
    }
    if (runtime.rocketPivot) {
      const angle = quality.reduceMotion ? .65 : elapsed * Math.PI * 2 / 24;
      runtime.rocketPivot.position.set(Math.cos(angle) * 1.55, Math.sin(angle * .65) * .25, Math.sin(angle) * 1.25);
      const nextAngle = angle + .025;
      nextRocketPosition.set(Math.cos(nextAngle) * 1.55, Math.sin(nextAngle * .65) * .25, Math.sin(nextAngle) * 1.25);
      runtime.rocketPivot.lookAt(nextRocketPosition);
      if (runtime.engineGlow && !quality.reduceMotion && quality.quality !== "low") {
        runtime.engineGlow.scale.y = .85 + Math.sin(elapsed * 8) * .14;
      }
    }
    runtime.markerVectors.forEach((vector, phaseId) => {
      const element = markerElements.get(phaseId);
      if (!element) return;
      temp.copy(vector);
      planetAnchor.localToWorld(temp);
      projected.copy(temp).project(camera);
      const rect = mount.getBoundingClientRect();
      element.style.transform = `translate3d(${(projected.x * .5 + .5) * rect.width}px, ${(-projected.y * .5 + .5) * rect.height}px, 0) translate(-50%, -50%)`;
      const inFrustum = projected.z > -1 && projected.z < 1;
      const frontFacing = temp.z > -.08;
      element.style.visibility = inFrustum ? "visible" : "hidden";
      element.style.opacity = frontFacing ? "" : ".25";
      element.style.pointerEvents = frontFacing ? "" : "none";
    });
    renderer.render(scene, camera);
  };
  frame();

  runtime.dispose = () => {
    runtime.disposed = true;
    cancelAnimationFrame(frameId);
    timer.dispose();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    runtime.killAuto?.();
    disposeThreeObject(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  return runtime;
}
