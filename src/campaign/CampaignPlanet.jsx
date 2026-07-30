import { useCallback, useEffect, useRef, useState } from "react";
import { getCampaignBiome } from "./campaignBiomes.js";
import { CAMPAIGN_PHASE_LOCATIONS, latLonToCartesian } from "./campaignSceneData.js";
import CampaignLoading from "./CampaignLoading.jsx";
import PhaseMarker from "./PhaseMarker.jsx";
import { consumeOrbitalTransition } from "../home/orbitalTransition.js";

export function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

const vertexShader = `
  uniform float uTime;
  uniform float uMotion;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    float ridge = sin(position.x * 11.0 + uTime * .08 * uMotion)
      * sin(position.y * 13.0) * sin(position.z * 9.0);
    float displacement = ridge * .018;
    vec3 displaced = position + normal * displacement;
    vHeight = ridge * .5 + .5;
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform vec3 uDark;
  uniform vec3 uMid;
  uniform vec3 uBright;
  uniform vec3 uAccent;
  uniform float uBiome;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.4);
    float bands = sin((vWorld.y + vWorld.x * .25) * (10.0 + uBiome * 2.0)) * .5 + .5;
    vec3 base = mix(uDark, uMid, smoothstep(.12, .8, vHeight));
    base = mix(base, uBright, smoothstep(.66, 1.0, bands) * .18);
    base += uAccent * rim * .22;
    gl_FragColor = vec4(base, 1.0);
  }
`;

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
  });
}

export default function CampaignPlanet({
  chapter, phases, campaign, selectedPhase, quality, registerMarker, projectMarkers,
  onSelectPhase, onRuntimeReady, onWebGLFailure,
}) {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const updateChapterData = useCallback((runtime, nextChapter) => {
    const { THREE, planetGroup, routeGroup, detailMesh, markerVectors } = runtime;
    markerVectors.clear();
    while (routeGroup.children.length) {
      const child = routeGroup.children.pop();
      child.geometry?.dispose();
      child.material?.dispose();
    }
    const points = nextChapter.phaseIds.map((phaseId) => {
      const location = CAMPAIGN_PHASE_LOCATIONS[phaseId];
      const point = latLonToCartesian(location.latitude, location.longitude, 1.02 + location.elevation);
      const vector = new THREE.Vector3(point.x, point.y, point.z);
      markerVectors.set(phaseId, vector);
      return vector;
    });
    for (let index = 1; index < points.length; index += 1) {
      const curvePoints = [];
      for (let step = 0; step <= 16; step += 1) {
        curvePoints.push(points[index - 1].clone().lerp(points[index], step / 16).normalize().multiplyScalar(1.045));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const phaseIndex = campaign.unlockedPhaseIndex;
      const destinationIndex = nextChapter.phaseIds.indexOf(nextChapter.phaseIds[index]);
      const globalIndex = nextChapter.number * 8 - 8 + destinationIndex;
      const reached = globalIndex <= phaseIndex;
      const material = new THREE.LineBasicMaterial({
        color: reached ? nextChapter.palette.primary : "#334155",
        transparent: true,
        opacity: reached ? .86 : .28,
      });
      routeGroup.add(new THREE.Line(geometry, material));
    }

    const biome = getCampaignBiome(nextChapter.id);
    detailMesh.material.color.set(biome.accent);
    const dummy = runtime.dummy;
    const detailCount = quality.detailCount;
    for (let index = 0; index < detailMesh.count; index += 1) {
      const seed = index * 12.9898 + nextChapter.number * 7.31;
      const y = 1 - (index / Math.max(1, detailCount - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = seed * 2.39996;
      const normal = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.position.copy(normal).multiplyScalar(1.015);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const scale = .018 + (index % 7) * .004;
      dummy.scale.set(scale, scale * (biome.key === "glass" ? 4.5 : 2.7), scale);
      dummy.updateMatrix();
      detailMesh.setMatrixAt(index, dummy.matrix);
    }
    detailMesh.count = detailCount;
    detailMesh.instanceMatrix.needsUpdate = true;
    planetGroup.rotation.set(biome.rotation.x, biome.rotation.y, biome.rotation.z);
  }, [campaign.unlockedPhaseIndex, quality.detailCount]);

  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let resizeObserver;
    let cleanup = () => {};

    async function initialize() {
      if (!supportsWebGL2()) {
        setLoading(false);
        onWebGLFailure();
        return;
      }
      try {
        const THREE = await import("three");
        if (cancelled || !mountRef.current) return;
        const mount = mountRef.current;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2("#050817", .055);
        const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
        camera.position.set(0, .05, quality.reduceMotion ? 4.45 : 6.8);
        const renderer = new THREE.WebGLRenderer({ antialias: quality.quality !== "low", alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x02040a, 0);
        mount.appendChild(renderer.domElement);

        const planetGroup = new THREE.Group();
        scene.add(planetGroup);
        const biome = getCampaignBiome(chapter.id);
        const uniforms = {
          uTime: { value: 0 },
          uMotion: { value: quality.reduceMotion ? 0 : 1 },
          uDark: { value: new THREE.Color(biome.surface[0]) },
          uMid: { value: new THREE.Color(biome.surface[1]) },
          uBright: { value: new THREE.Color(biome.surface[2]) },
          uAccent: { value: new THREE.Color(biome.accent) },
          uBiome: { value: chapter.number },
        };
        const planetMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
        const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(1, quality.segments), planetMaterial);
        planetGroup.add(planet);

        const atmosphereMaterial = new THREE.MeshBasicMaterial({
          color: biome.atmosphere, transparent: true, opacity: .14,
          side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.09, 48, 32), atmosphereMaterial);
        planetGroup.add(atmosphere);

        const routeGroup = new THREE.Group();
        planetGroup.add(routeGroup);
        const detailGeometry = new THREE.ConeGeometry(1, 1, biome.key === "glass" ? 4 : 6);
        const detailMaterial = new THREE.MeshStandardMaterial({ color: biome.accent, roughness: .72, metalness: .18 });
        const detailMesh = new THREE.InstancedMesh(detailGeometry, detailMaterial, quality.detailCount);
        planetGroup.add(detailMesh);

        const keyLight = new THREE.DirectionalLight(biome.light, 2.4);
        keyLight.position.set(3, 2, 4);
        scene.add(keyLight);
        const fillLight = new THREE.HemisphereLight(biome.atmosphere, biome.ambient, 1.1);
        scene.add(fillLight);

        const makePoints = (count, radiusMin, radiusRange, color, size) => {
          const positions = new Float32Array(count * 3);
          for (let index = 0; index < count; index += 1) {
            const radius = radiusMin + Math.random() * radiusRange;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[index * 3 + 1] = radius * Math.cos(phi);
            positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          const material = new THREE.PointsMaterial({ color, size, transparent: true, opacity: .7, depthWrite: false });
          return new THREE.Points(geometry, material);
        };
        const stars = makePoints(quality.stars, 5, 20, "#bde7ff", .025);
        scene.add(stars);
        const particles = makePoints(quality.particles, 1.35, 1.65, biome.particle, .018);
        scene.add(particles);

        const runtime = {
          THREE, scene, camera, renderer, planetGroup, planet, atmosphere, routeGroup, detailMesh,
          keyLight, fillLight, stars, particles, uniforms, markerVectors: new Map(),
          tempVector: new THREE.Vector3(), cameraNormal: new THREE.Vector3(), dummy: new THREE.Object3D(),
          width: 1, height: 1, velocityX: 0, velocityY: 0, dragging: false, disposed: false,
          killAuto: null,
        };
        runtimeRef.current = runtime;
        updateChapterData(runtime, chapter);
        const orbitalTransition = consumeOrbitalTransition(chapter.id, selectedPhase?.id);
        if (orbitalTransition) {
          planetGroup.rotation.set(
            orbitalTransition.planetRotation.x,
            orbitalTransition.planetRotation.y,
            orbitalTransition.planetRotation.z,
          );
          camera.position.z = THREE.MathUtils.clamp(orbitalTransition.cameraDistance, 3.25, 6.1);
          runtime.orbitalTransition = orbitalTransition;
        }

        const resize = () => {
          const rect = mount.getBoundingClientRect();
          runtime.width = Math.max(1, rect.width);
          runtime.height = Math.max(1, rect.height);
          camera.aspect = runtime.width / runtime.height;
          camera.updateProjectionMatrix();
          renderer.setSize(runtime.width, runtime.height, false);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();
        renderer.compile(scene, camera);

        let visible = document.visibilityState !== "hidden";
        const onVisibility = () => { visible = document.visibilityState !== "hidden"; };
        document.addEventListener("visibilitychange", onVisibility);
        const timer = new THREE.Timer();
        timer.connect(document);
        const frame = (timestamp) => {
          if (runtime.disposed) return;
          frameId = requestAnimationFrame(frame);
          if (!visible) return;
          timer.update(timestamp);
          const delta = Math.min(.04, timer.getDelta());
          uniforms.uTime.value += delta;
          if (!runtime.dragging && !quality.reduceMotion) {
            planetGroup.rotation.y += runtime.velocityY;
            planetGroup.rotation.x = THREE.MathUtils.clamp(planetGroup.rotation.x + runtime.velocityX, -.75, .75);
            runtime.velocityX *= .92;
            runtime.velocityY *= .92;
            if (Math.abs(runtime.velocityY) < .00008) planetGroup.rotation.y += .00035;
          }
          particles.rotation.y += quality.reduceMotion ? 0 : delta * .025;
          projectMarkers(runtime);
          renderer.render(scene, camera);
        };
        frame();
        setLoading(false);
        onRuntimeReady(runtime);
        cleanup = () => {
          runtime.disposed = true;
          cancelAnimationFrame(frameId);
          timer.dispose();
          document.removeEventListener("visibilitychange", onVisibility);
          resizeObserver?.disconnect();
          runtime.killAuto?.();
          disposeObject(scene);
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          runtimeRef.current = null;
        };
      } catch (error) {
        console.warn("Campaign WebGL unavailable:", error);
        setLoading(false);
        onWebGLFailure();
      }
    }
    initialize();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (runtimeRef.current) updateChapterData(runtimeRef.current, chapter);
  }, [chapter, updateChapterData]);

  const pointerState = useRef({ x: 0, y: 0 });
  const onPointerDown = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.killAuto?.();
    runtime.dragging = true;
    runtime.velocityX = 0;
    runtime.velocityY = 0;
    pointerState.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime?.dragging) return;
    const dx = event.clientX - pointerState.current.x;
    const dy = event.clientY - pointerState.current.y;
    runtime.velocityY = dx * .0045;
    runtime.velocityX = dy * .0035;
    runtime.planetGroup.rotation.y += runtime.velocityY;
    runtime.planetGroup.rotation.x = runtime.THREE.MathUtils.clamp(runtime.planetGroup.rotation.x + runtime.velocityX, -.75, .75);
    pointerState.current = { x: event.clientX, y: event.clientY };
  };
  const stopDrag = () => { if (runtimeRef.current) runtimeRef.current.dragging = false; };
  const onWheel = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    event.preventDefault();
    runtime.killAuto?.();
    runtime.camera.position.z = runtime.THREE.MathUtils.clamp(runtime.camera.position.z + event.deltaY * .002, 3.25, 6.1);
  };
  const onKeyDown = (event) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const step = event.shiftKey ? .2 : .1;
    if (event.key === "ArrowLeft") runtime.planetGroup.rotation.y -= step;
    else if (event.key === "ArrowRight") runtime.planetGroup.rotation.y += step;
    else if (event.key === "ArrowUp") runtime.planetGroup.rotation.x = Math.max(-.75, runtime.planetGroup.rotation.x - step);
    else if (event.key === "ArrowDown") runtime.planetGroup.rotation.x = Math.min(.75, runtime.planetGroup.rotation.x + step);
    else if (event.key === "+" || event.key === "=") runtime.camera.position.z = Math.max(3.25, runtime.camera.position.z - .2);
    else if (event.key === "-") runtime.camera.position.z = Math.min(6.1, runtime.camera.position.z + .2);
    else return;
    event.preventDefault();
  };

  return <div
    className="campaign-planet-stage"
    role="application"
    aria-label="Planeta da campanha. Arraste ou use as setas para girar; use a roda, mais e menos para aproximar."
    tabIndex={0}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={stopDrag}
    onPointerCancel={stopDrag}
    onWheel={onWheel}
    onKeyDown={onKeyDown}
  >
    <div ref={mountRef} className="campaign-canvas-mount" aria-hidden="true" />
    {loading && <CampaignLoading />}
    <div className="campaign-marker-layer">
      {phases.map((phase) => {
        const index = Number(phase.id.slice(-2)) - 1;
        const stats = campaign.phaseStats[phase.id] || {};
        return <PhaseMarker
          key={phase.id}
          phase={phase}
          index={index}
          locked={index > campaign.unlockedPhaseIndex}
          selected={selectedPhase?.id === phase.id}
          completed={Number(stats.victories || 0) > 0}
          stars={Number(stats.bestStars || 0)}
          current={campaign.currentPhaseId === phase.id}
          registerMarker={registerMarker}
          onSelect={onSelectPhase}
          reduceMotion={quality.reduceMotion}
        />;
      })}
    </div>
    <div className={`campaign-environment environment-${getCampaignBiome(chapter.id).key}`} aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </div>
  </div>;
}
