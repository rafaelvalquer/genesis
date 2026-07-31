export function supportsLoadoutWebGL() {
  if (import.meta.env.MODE === "test") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    }));
  } catch {
    return false;
  }
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
  });
}

export async function createTroopStageScene({ mount, quality, color, onFailure }) {
  if (!supportsLoadoutWebGL()) {
    onFailure?.();
    return null;
  }
  let renderer;
  let scene;
  try {
    const THREE = await import("three");
    if (!mount?.isConnected) return null;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#030812", .06);
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 50);
    camera.position.set(0, 2.2, 6.4);
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality.antialias,
      powerPreference: quality.quality === "low" ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    renderer.setClearColor(0x02060c, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const platform = new THREE.Group();
    platform.position.y = -.8;
    scene.add(platform);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: "#071829", metalness: .75, roughness: .28 });
    const accentMaterial = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .78, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.9, .32, 48), baseMaterial);
    platform.add(base);
    const rings = [];
    for (let index = 0; index < quality.rings; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 + index * .28, .018, 8, 64),
        accentMaterial.clone(),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .22 + index * .06;
      platform.add(ring);
      rings.push(ring);
    }
    const grid = new THREE.GridHelper(8, 22, color, "#10263a");
    grid.position.y = -.63;
    grid.material.transparent = true;
    grid.material.opacity = .22;
    scene.add(grid);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(.82, 1.4, 4.7, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: .075, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    beam.position.y = 1.35;
    scene.add(beam);
    const emitters = new THREE.Group();
    for (let index = 0; index < 6; index += 1) {
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(.16, .38, .16), baseMaterial.clone());
      const angle = index / 6 * Math.PI * 2;
      emitter.position.set(Math.cos(angle) * 2.15, -.45, Math.sin(angle) * 2.15);
      emitter.rotation.y = -angle;
      emitters.add(emitter);
    }
    scene.add(emitters);

    const positions = new Float32Array(quality.particles * 3);
    for (let index = 0; index < quality.particles; index += 1) {
      const radius = .5 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = -.3 + Math.random() * 4.4;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      color, size: .025, transparent: true, opacity: .58, depthWrite: false,
    }));
    scene.add(particles);
    const keyLight = new THREE.PointLight(color, 13, 11);
    keyLight.position.set(0, 2.5, 2);
    scene.add(keyLight, new THREE.HemisphereLight("#bdeaff", "#07101c", 1.7));

    const runtime = {
      THREE, scene, camera, renderer, platform, rings, beam, particles, keyLight,
      accentMaterials: [accentMaterial, beam.material, particles.material, ...rings.map((ring) => ring.material)],
      disposed: false,
    };
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let visible = document.visibilityState !== "hidden";
    const onVisibility = () => { visible = document.visibilityState !== "hidden"; };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = new THREE.Timer();
    timer.connect(document);
    let frameId = 0;
    const frame = (timestamp) => {
      if (runtime.disposed) return;
      frameId = requestAnimationFrame(frame);
      if (!visible) return;
      timer.update(timestamp);
      const delta = Math.min(.04, timer.getDelta());
      if (!quality.reduceMotion) {
        platform.rotation.y += delta * .12;
        rings.forEach((ring, index) => { ring.rotation.z += delta * (index % 2 ? -.22 : .18); });
        particles.rotation.y += delta * .08;
      }
      renderer.render(scene, camera);
    };
    frame();
    runtime.dispose = () => {
      if (runtime.disposed) return;
      runtime.disposed = true;
      cancelAnimationFrame(frameId);
      timer.dispose();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    return runtime;
  } catch (error) {
    console.warn("Loadout WebGL unavailable:", error);
    if (scene) disposeScene(scene);
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement?.remove();
    onFailure?.();
    return null;
  }
}
