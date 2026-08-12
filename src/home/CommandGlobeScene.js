import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { createChapterPhaseVectors, getTargetRotationForPhase } from "../visual/campaignPlanetCoordinates.js";
import { createChapterRoutes } from "../visual/campaignPlanetRoutes.js";
import { getCampaignPhaseState } from "../visual/campaignPhaseState.js";
import { disposeThreeObject } from "../visual/disposeThreeObject.js";
import { declutterProjectedMarkers } from "../visual/declutterProjectedMarkers.js";
import { configureGenesisRenderer } from "../visual/configureGenesisRenderer.js";
import {
  createGenesisPlanetLights,
  updateGenesisLightTransition,
} from "../visual/createGenesisPlanetLights.js";
import {
  createGenesisChapterEffects,
  updateGenesisChapterEffects,
} from "../visual/createGenesisChapterEffects.js";
import { applyGenesisWorldTheme } from "../visual/applyGenesisWorldTheme.js";
import { createRocketOrbit, updateRocketOrbit } from "../visual/createRocketOrbit.js";
import {
  createGenesisPlanetDebug,
  isGenesisPlanetDebugEnabled,
} from "../visual/createGenesisPlanetDebug.js";
import { fitGenesisPlanetCamera } from "../visual/fitGenesisPlanetCamera.js";
import {
  createGenesisPlanetInstance,
  setGenesisPlanetOpacity,
} from "../visual/genesisPlanetAsset.js";
import { applyGenesisPlanetOrientation } from "../visual/genesisPlanetOrientation.js";
import { createGenesisAtmosphereMaterial } from "../visual/createGenesisAtmosphereMaterial.js";

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

export function createStarLayers(THREE, quality) {
  const layers = [
    { count: Math.max(44, quality.orbitalParticles), radius: 5, spread: 7, size: .016, opacity: .34, speed: .003 },
    { count: Math.max(64, quality.orbitalParticles * 2), radius: 9, spread: 11, size: .022, opacity: .52, speed: -.006 },
    { count: Math.max(80, quality.orbitalParticles * 3), radius: 14, spread: 16, size: .03, opacity: .72, speed: .01 },
  ];
  return layers.map((layer) => {
    const stars = makePoints(THREE, layer.count, layer.radius, layer.spread, "#bde7ff", layer.size);
    stars.material.opacity = layer.opacity;
    stars.userData.parallaxSpeed = layer.speed;
    return stars;
  });
}

export function createMarkerMesh(THREE, phase, state, chapter) {
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
  ring.renderOrder = 5;
  if (state.current) {
    const surfaceGlow = new THREE.Mesh(
      new THREE.CircleGeometry(.13, 28),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: .22, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    surfaceGlow.position.z = -.006;
    surfaceGlow.renderOrder = 4;
    group.add(surfaceGlow);
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(.09, .098, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .55, depthWrite: false }),
    );
    group.add(outer);
    outer.renderOrder = 5;
    group.userData.surfaceGlow = surfaceGlow;
    group.userData.pulseRing = outer;
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
  scene.fog = new THREE.FogExp2(biome.world.fogColor, biome.world.fogDensityCommand);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, .04, 1);
  fitGenesisPlanetCamera({
    camera, radius: 1, padding: quality.reduceMotion ? 1.45 : 1.7,
  });
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: quality.quality !== "low", powerPreference: "high-performance",
  });
  configureGenesisRenderer(THREE, renderer, quality);
  renderer.setClearColor(0x02040a, 0);
  mount.appendChild(renderer.domElement);

  const planetReferenceFrame = new THREE.Group();
  const modelOrientationRoot = applyGenesisPlanetOrientation(new THREE.Group());
  const planetModelRoot = new THREE.Group();
  const mapOverlayRoot = new THREE.Group();
  modelOrientationRoot.add(planetModelRoot, mapOverlayRoot);
  planetReferenceFrame.add(modelOrientationRoot);
  scene.add(planetReferenceFrame);
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
  planetModelRoot.add(proceduralPlanet);
  const proceduralAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.09, quality.atmosphereSegments, quality.atmosphereSegments / 2),
    createGenesisAtmosphereMaterial(THREE, { color: biome.atmosphere, opacity: biome.world.atmosphereOpacityCommand }),
  );
  planetModelRoot.add(proceduralAtmosphere);

  const lights = createGenesisPlanetLights(THREE, scene, biome, renderer);
  const starLayers = createStarLayers(THREE, quality);
  const particles = makePoints(THREE, quality.orbitalParticles, 1.3, 1.9, biome.particle, biome.world.particleSize);
  particles.material.opacity = biome.world.particleOpacity;
  scene.add(...starLayers, particles);

  const chapterEffects = createGenesisChapterEffects({
    THREE,
    parent: planetModelRoot,
    quality,
    chapterId: chapter.id,
  });

  const runtime = {
    THREE, scene, camera, renderer, mount,
    planetAnchor: planetReferenceFrame, planetGroup: planetReferenceFrame,
    planetReferenceFrame, modelOrientationRoot, planetModelRoot, mapOverlayRoot,
    atmosphere: proceduralAtmosphere, ...lights, uniforms,
    particles, starLayers, chapterEffects,
    atmosphereBaseOpacity: biome.world.atmosphereOpacityCommand,
    markerVectors: new Map(), markerElements, phaseMarkerGroup: null, currentMarker: null, routeGroup: null,
    selectedPhaseId: selectedPhase.id, currentChapter: chapter, currentPhases: phases,
    dragging: false, velocityX: 0, velocityY: 0, disposed: false, killAuto: null,
    targetRotation: getTargetRotationForPhase(selectedPhase.id),
    glbPlanet: null, planetParts: null, planetLayout: null, glbFade: 0, rocket: null,
  };
  planetReferenceFrame.rotation.set(runtime.targetRotation.x, runtime.targetRotation.y, runtime.targetRotation.z);

  runtime.setChapter = (nextChapter, nextPhases, nextCampaign, nextSelected) => {
    if (runtime.routeGroup) {
      mapOverlayRoot.remove(runtime.routeGroup);
      disposeThreeObject(runtime.routeGroup);
    }
    if (runtime.phaseMarkerGroup) {
      mapOverlayRoot.remove(runtime.phaseMarkerGroup);
      disposeThreeObject(runtime.phaseMarkerGroup);
    }
    runtime.currentChapter = nextChapter;
    runtime.currentPhases = nextPhases;
    runtime.selectedPhaseId = nextSelected.id;
    runtime.markerVectors = createChapterPhaseVectors(THREE, nextChapter);
    runtime.routeGroup = createChapterRoutes(THREE, nextChapter, nextPhases, nextCampaign, runtime.markerVectors);
    mapOverlayRoot.add(runtime.routeGroup);
    runtime.phaseMarkerGroup = new THREE.Group();
    runtime.currentMarker = null;
    nextPhases.forEach((phase) => {
      const state = getCampaignPhaseState(phase, nextCampaign);
      const marker = createMarkerMesh(THREE, phase, state, nextChapter);
      marker.position.copy(runtime.markerVectors.get(phase.id));
      marker.lookAt(marker.position.clone().multiplyScalar(2));
      runtime.phaseMarkerGroup.add(marker);
      if (state.current) runtime.currentMarker = marker;
    });
    mapOverlayRoot.add(runtime.phaseMarkerGroup);

    const nextBiome = getCampaignBiome(nextChapter.id);
    applyGenesisWorldTheme({
      THREE,
      runtime,
      chapter: nextChapter,
      biome: nextBiome,
      mode: "command",
      immediate: !runtime.initialized,
    });

    runtime.focusPhase(nextSelected.id, !runtime.initialized);
    runtime.initialized = true;
  };

  runtime.focusPhase = (phaseId, immediate = false) => {
    runtime.selectedPhaseId = phaseId;
    runtime.targetRotation = getTargetRotationForPhase(phaseId);
    if (immediate || quality.reduceMotion) {
      planetReferenceFrame.rotation.set(runtime.targetRotation.x, runtime.targetRotation.y, runtime.targetRotation.z);
    }
  };
  runtime.setChapter(chapter, phases, campaign, selectedPhase);

  createGenesisPlanetInstance({
    THREE, quality, chapter: runtime.currentChapter,
    biome: getCampaignBiome(runtime.currentChapter.id), opacity: 0,
    presentationMode: "command",
  }).then(({ model, parts, layout }) => {
    if (runtime.disposed) return disposeThreeObject(model);
    runtime.glbPlanet = model;
    runtime.planetParts = parts;
    runtime.planetLayout = layout;
    runtime.glbFade = 0;
    planetModelRoot.add(model);
    applyGenesisWorldTheme({
      THREE,
      runtime,
      chapter: runtime.currentChapter,
      biome: getCampaignBiome(runtime.currentChapter.id),
      mode: "command",
      immediate: true,
    });
    mount.dataset.planetLayoutCorrected = String(layout.corrected);
    mount.dataset.planetSourceRadius = layout.sourceRadius.toFixed(4);
    mount.dataset.planetScale = layout.scale.toFixed(4);
    if (isGenesisPlanetDebugEnabled()) {
      runtime.planetDebug = createGenesisPlanetDebug({
        THREE, parent: planetModelRoot, model, parts, layout,
      });
    }
    mount.dataset.planetAsset = "ready";
  }).catch((error) => {
    mount.dataset.planetAsset = "failed";
    console.warn("Planeta GLB indisponível; mantendo fallback procedural.", error);
  });

  createRocketOrbit({
    THREE, parent: modelOrientationRoot, quality,
    biome: getCampaignBiome(runtime.currentChapter.id),
  }).then((rocket) => {
    if (runtime.disposed) return disposeThreeObject(rocket.orbitRoot);
    runtime.rocket = rocket;
    rocket.engineGlow?.material?.color?.set(runtime.currentBiome.atmosphere);
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
  const planetCenter = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  let elapsed = 0;

  const frame = (timestamp) => {
    if (runtime.disposed) return;
    frameId = requestAnimationFrame(frame);
    if (!visible) return;
    timer.update(timestamp);
    const delta = Math.min(.04, timer.getDelta());
    elapsed += delta;
    uniforms.uTime.value += delta;
    updateGenesisLightTransition(runtime, delta, renderer);
    updateGenesisChapterEffects(chapterEffects, delta, elapsed, quality.reduceMotion);

    if (runtime.glbPlanet && runtime.glbFade < 1) {
      runtime.glbFade = Math.min(1, runtime.glbFade + delta * 1.8);
      mount.dataset.planetFade = runtime.glbFade.toFixed(2);
      const hasAuthoredAtmosphere = Boolean(runtime.planetParts?.atmosphere);
      proceduralMaterial.opacity = 1 - runtime.glbFade;
      proceduralAtmosphere.material.opacity = hasAuthoredAtmosphere
        ? runtime.atmosphereBaseOpacity * (1 - runtime.glbFade)
        : runtime.atmosphereBaseOpacity;
      setGenesisPlanetOpacity(runtime.planetParts, runtime.glbFade);
      if (runtime.glbFade === 1) {
        proceduralPlanet.visible = false;
        proceduralAtmosphere.visible = !hasAuthoredAtmosphere;
      }
    }
    if (!runtime.dragging && !quality.reduceMotion) {
      planetReferenceFrame.rotation.x = THREE.MathUtils.clamp(planetReferenceFrame.rotation.x + runtime.velocityX, -.8, .8);
      planetReferenceFrame.rotation.y += runtime.velocityY + .00018;
      runtime.velocityX *= .9;
      runtime.velocityY *= .9;
      particles.rotation.y += delta * .018;
    }
    if (!quality.reduceMotion) {
      starLayers.forEach((stars, index) => {
        stars.rotation.y += delta * stars.userData.parallaxSpeed;
        stars.rotation.x += runtime.velocityX * (.18 + index * .05);
        stars.rotation.y += runtime.velocityY * (.12 + index * .04);
      });
    }
    if (runtime.currentMarker) {
      const pulse = quality.reduceMotion ? .5 : (Math.sin(elapsed * 3.2) + 1) * .5;
      const scale = 1 + pulse * .13;
      runtime.currentMarker.scale.setScalar(scale);
      const { pulseRing, surfaceGlow } = runtime.currentMarker.userData;
      if (pulseRing?.material) pulseRing.material.opacity = .42 + pulse * .32;
      if (surfaceGlow?.material) surfaceGlow.material.opacity = .14 + pulse * .18;
    }
    if (!quality.reduceMotion && runtime.planetParts?.clouds?.visible) {
      runtime.planetParts.clouds.rotation.y += delta * Math.PI * 2 / 120;
    }
    updateRocketOrbit(THREE, runtime.rocket, elapsed, quality.reduceMotion);
    const projectedMarkers = [];
    const rect = mount.getBoundingClientRect();
    runtime.markerVectors.forEach((vector, phaseId) => {
      const element = markerElements.get(phaseId);
      if (!element) return;
      temp.copy(vector);
      mapOverlayRoot.localToWorld(temp);
      projected.copy(temp).project(camera);
      const x = (projected.x * .5 + .5) * rect.width;
      const y = (-projected.y * .5 + .5) * rect.height;
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      const inFrustum = projected.z > -1 && projected.z < 1;
      planetReferenceFrame.getWorldPosition(planetCenter);
      camera.getWorldPosition(cameraPosition);
      surfaceNormal.copy(temp).sub(planetCenter).normalize();
      cameraDirection.copy(cameraPosition).sub(temp).normalize();
      const frontFacing = surfaceNormal.dot(cameraDirection) > .05;
      const markerVisible = inFrustum && frontFacing;
      element.dataset.projectable = markerVisible ? "true" : "false";
      if (markerVisible) {
        projectedMarkers.push({
          id: phaseId,
          x,
          y,
          priority: Number(element.dataset.markerPriority || 10),
          current: element.dataset.markerCurrent === "true",
          selected: element.dataset.markerSelected === "true",
        });
      }
    });
    const visibleMarkerIds = declutterProjectedMarkers(projectedMarkers, { minimumDistance: 32 });
    markerElements.forEach((element, phaseId) => {
      const markerVisible = element.dataset.projectable === "true" && visibleMarkerIds.has(phaseId);
      element.style.visibility = markerVisible ? "visible" : "hidden";
      element.style.opacity = "";
      element.style.pointerEvents = markerVisible ? "" : "none";
    });
    renderer.render(scene, camera);
  };
  frame();

  runtime.dispose = () => {
    runtime.disposed = true;
    runtime.chapterEffects?.dispose?.();
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
