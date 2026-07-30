import { getCampaignBiome } from "../campaign/campaignBiomes.js";
import { CAMPAIGN_PHASE_LOCATIONS, latLonToCartesian } from "../campaign/campaignSceneData.js";
import { getPhaseIndex, PHASES } from "../game/content.js";

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

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => material.dispose());
  });
}

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

function targetRotationFor(phase) {
  const location = CAMPAIGN_PHASE_LOCATIONS[phase.id];
  const point = latLonToCartesian(location.latitude, location.longitude, 1);
  return {
    x: Math.atan2(point.y, Math.hypot(point.x, point.z)),
    y: Math.atan2(-point.x, point.z),
    z: 0,
  };
}

export function supportsCommandWebGL() {
  if (import.meta.env.MODE === "test") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export async function createCommandGlobeScene({ mount, phase, chapter, quality, markerElement }) {
  if (!supportsCommandWebGL()) throw new Error("WebGL 2 indisponível");
  const THREE = await import("three");
  const biome = getCampaignBiome(chapter.id);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#030712", .042);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, .04, quality.reduceMotion ? 4.3 : 5.6);
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: quality.quality !== "low", powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setClearColor(0x02040a, 0);
  mount.appendChild(renderer.domElement);

  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  const uniforms = {
    uTime: { value: 0 }, uMotion: { value: quality.reduceMotion ? 0 : 1 },
    uDark: { value: new THREE.Color(biome.surface[0]) },
    uMid: { value: new THREE.Color(biome.surface[1]) },
    uAccent: { value: new THREE.Color(biome.accent) },
  };
  const planet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, quality.quality === "low" ? 3 : 5),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }),
  );
  planetGroup.add(planet);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.09, quality.atmosphereSegments, quality.atmosphereSegments / 2),
    new THREE.MeshBasicMaterial({
      color: biome.atmosphere, transparent: true, opacity: .15, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  planetGroup.add(atmosphere);

  const routeGroup = new THREE.Group();
  planetGroup.add(routeGroup);
  const currentIndex = getPhaseIndex(phase.id);
  const routePhases = PHASES.slice(Math.max(0, currentIndex - quality.routePoints + 1), currentIndex + 1);
  const routePoints = routePhases.map((entry) => {
    const location = CAMPAIGN_PHASE_LOCATIONS[entry.id];
    const point = latLonToCartesian(location.latitude, location.longitude, 1.035);
    return new THREE.Vector3(point.x, point.y, point.z);
  });
  for (let index = 1; index < routePoints.length; index += 1) {
    const points = [];
    for (let step = 0; step <= 12; step += 1) {
      points.push(routePoints[index - 1].clone().lerp(routePoints[index], step / 12).normalize().multiplyScalar(1.045));
    }
    routeGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: chapter.palette.primary, transparent: true, opacity: .75 }),
    ));
  }

  const markerVector = routePoints.at(-1) || new THREE.Vector3(0, 0, 1.04);
  const markerRing = new THREE.Mesh(
    new THREE.RingGeometry(.045, .075, 24),
    new THREE.MeshBasicMaterial({ color: phase.boss ? "#fb7185" : chapter.palette.primary, side: THREE.DoubleSide }),
  );
  markerRing.position.copy(markerVector);
  markerRing.lookAt(markerVector.clone().multiplyScalar(2));
  planetGroup.add(markerRing);
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(1.42, .006, 6, 80),
    new THREE.MeshBasicMaterial({ color: biome.atmosphere, transparent: true, opacity: .45 }),
  );
  orbit.rotation.x = 1.18;
  scene.add(orbit);
  const station = new THREE.Group();
  const stationCore = new THREE.Mesh(
    new THREE.BoxGeometry(.12, .035, .035),
    new THREE.MeshStandardMaterial({ color: "#d8f4ff", emissive: biome.accent, emissiveIntensity: .45 }),
  );
  station.add(stationCore);
  const stationWing = new THREE.Mesh(
    new THREE.BoxGeometry(.34, .008, .09),
    new THREE.MeshStandardMaterial({ color: "#164e63", metalness: .75, roughness: .28 }),
  );
  station.add(stationWing);
  station.position.set(1.35, .18, .22);
  scene.add(station);

  const keyLight = new THREE.DirectionalLight(biome.light, 2.5);
  keyLight.position.set(3, 2, 4);
  scene.add(keyLight);
  const fillLight = new THREE.HemisphereLight(biome.atmosphere, biome.ambient, 1.05);
  scene.add(fillLight);
  const stars = makePoints(THREE, Math.max(80, quality.orbitalParticles * 3), 5, 18, "#bde7ff", .023);
  const particles = makePoints(THREE, quality.orbitalParticles, 1.3, 1.9, biome.particle, .017);
  scene.add(stars, particles);

  const initialRotation = targetRotationFor(phase);
  planetGroup.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);
  const temp = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const runtime = {
    THREE, scene, camera, renderer, planetGroup, atmosphere, keyLight, fillLight, markerRing,
    targetRotation: initialRotation, dragging: false, velocityX: 0, velocityY: 0, disposed: false,
    killAuto: null, previewChapter: chapter.id,
  };
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
  const frame = (timestamp) => {
    if (runtime.disposed) return;
    frameId = requestAnimationFrame(frame);
    if (!visible) return;
    timer.update(timestamp);
    const delta = Math.min(.04, timer.getDelta());
    uniforms.uTime.value += delta;
    if (!runtime.dragging && !quality.reduceMotion) {
      planetGroup.rotation.x = THREE.MathUtils.clamp(planetGroup.rotation.x + runtime.velocityX, -.72, .72);
      planetGroup.rotation.y += runtime.velocityY + .00022;
      runtime.velocityX *= .9;
      runtime.velocityY *= .9;
      orbit.rotation.z += delta * .025;
      station.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta * .045);
      station.lookAt(0, 0, 0);
      particles.rotation.y += delta * .018;
    }
    temp.copy(markerVector);
    planetGroup.localToWorld(temp);
    projected.copy(temp).project(camera);
    if (markerElement) {
      const rect = mount.getBoundingClientRect();
      markerElement.style.transform = `translate3d(${(projected.x * .5 + .5) * rect.width}px, ${(-projected.y * .5 + .5) * rect.height}px, 0) translate(-50%, -50%)`;
      markerElement.style.visibility = projected.z > -1 && projected.z < 1 && temp.z > 0 ? "visible" : "hidden";
    }
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
    disposeScene(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  return runtime;
}
