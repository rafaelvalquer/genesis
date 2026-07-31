import {
  normalizeTroopStageCharacterBounds,
} from "./troopStageEffects.js";

export function supportsLoadoutWebGL() {
  if (import.meta.env.MODE === "test") return false;

  try {
    return Boolean(
      document
        .createElement("canvas")
        .getContext("webgl2", {
          failIfMajorPerformanceCaveat: true,
        }),
    );
  } catch {
    return false;
  }
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose();

    if (Array.isArray(object.material)) {
      object.material.forEach(
        (material) => material.dispose(),
      );
    } else {
      object.material?.dispose();
    }
  });
}

function screenPointToWorldOnPlane({
  THREE,
  camera,
  width,
  height,
  x,
  y,
  planeZ = 0,
}) {
  const normalizedX = x / Math.max(1, width) * 2 - 1;
  const normalizedY = -(y / Math.max(1, height)) * 2 + 1;
  const point = new THREE.Vector3(
    normalizedX,
    normalizedY,
    .5,
  ).unproject(camera);
  const direction = point
    .sub(camera.position)
    .normalize();

  const denominator = direction.z;
  if (Math.abs(denominator) < .00001) {
    return new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      planeZ,
    );
  }

  const distance = (
    planeZ - camera.position.z
  ) / denominator;

  return camera.position
    .clone()
    .add(direction.multiplyScalar(distance));
}

export async function createTroopStageScene({
  mount,
  quality,
  color,
  onFailure,
}) {
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

    const camera = new THREE.PerspectiveCamera(
      38,
      1,
      .1,
      50,
    );
    camera.position.set(0, 2.2, 6.4);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality.antialias,
      powerPreference: quality.quality === "low"
        ? "low-power"
        : "high-performance",
    });
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        quality.pixelRatio,
      ),
    );
    renderer.setClearColor(0x02060c, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const platform = new THREE.Group();
    scene.add(platform);

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#071829",
      metalness: .75,
      roughness: .28,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.72,
        1.9,
        .32,
        48,
      ),
      baseMaterial,
    );
    platform.add(base);

    const rings = [];
    for (
      let index = 0;
      index < quality.rings;
      index += 1
    ) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          1.18 + index * .28,
          .018,
          8,
          64,
        ),
        accentMaterial.clone(),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .22 + index * .06;
      platform.add(ring);
      rings.push(ring);
    }

    const interactionMaterial = accentMaterial.clone();
    interactionMaterial.opacity = 0;

    const interactionRing = new THREE.Mesh(
      new THREE.TorusGeometry(
        1.36,
        .035,
        8,
        72,
      ),
      interactionMaterial,
    );
    interactionRing.rotation.x = Math.PI / 2;
    interactionRing.position.y = .29;
    interactionRing.visible = false;
    platform.add(interactionRing);

    const emitters = new THREE.Group();
    for (let index = 0; index < 6; index += 1) {
      const emitter = new THREE.Mesh(
        new THREE.BoxGeometry(.16, .38, .16),
        baseMaterial.clone(),
      );
      const angle = index / 6 * Math.PI * 2;
      emitter.position.set(
        Math.cos(angle) * 2.15,
        .25,
        Math.sin(angle) * 2.15,
      );
      emitter.rotation.y = -angle;
      emitters.add(emitter);
    }
    platform.add(emitters);

    const grid = new THREE.GridHelper(
      8,
      22,
      color,
      "#10263a",
    );
    grid.position.y = -.63;
    grid.material.transparent = true;
    grid.material.opacity = .22;
    scene.add(grid);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .075,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(
        .82,
        1.4,
        4.7,
        32,
        1,
        true,
      ),
      beamMaterial,
    );
    scene.add(beam);

    const positions = new Float32Array(
      quality.particles * 3,
    );
    for (
      let index = 0;
      index < quality.particles;
      index += 1
    ) {
      const radius = .5 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;

      positions[index * 3] = (
        Math.cos(angle) * radius
      );
      positions[index * 3 + 1] = (
        -.3 + Math.random() * 4.4
      );
      positions[index * 3 + 2] = (
        Math.sin(angle) * radius
      );
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color,
        size: .025,
        transparent: true,
        opacity: .58,
        depthWrite: false,
      }),
    );
    scene.add(particles);

    const keyLight = new THREE.PointLight(
      color,
      13,
      11,
    );
    keyLight.position.set(0, 2.5, 2);

    const hemisphereLight = new THREE.HemisphereLight(
      "#bdeaff",
      "#07101c",
      1.7,
    );
    scene.add(keyLight, hemisphereLight);

    const runtime = {
      THREE,
      scene,
      camera,
      renderer,
      platform,
      rings,
      beam,
      particles,
      keyLight,
      interactionRing,
      accentMaterials: [
        accentMaterial,
        beam.material,
        particles.material,
        interactionMaterial,
        ...rings.map((ring) => ring.material),
      ],
      characterBounds: null,
      interactionElapsed: -1,
      disposed: false,
    };

    const applyCharacterBounds = (rawBounds) => {
      const bounds = normalizeTroopStageCharacterBounds(
        rawBounds,
      );
      runtime.characterBounds = bounds;

      const foot = screenPointToWorldOnPlane({
        THREE,
        camera,
        width: bounds.stageWidth,
        height: bounds.stageHeight,
        x: bounds.centerX,
        y: bounds.footY,
      });
      const head = screenPointToWorldOnPlane({
        THREE,
        camera,
        width: bounds.stageWidth,
        height: bounds.stageHeight,
        x: bounds.centerX,
        y: bounds.headY,
      });
      const left = screenPointToWorldOnPlane({
        THREE,
        camera,
        width: bounds.stageWidth,
        height: bounds.stageHeight,
        x: bounds.left,
        y: bounds.footY,
      });
      const right = screenPointToWorldOnPlane({
        THREE,
        camera,
        width: bounds.stageWidth,
        height: bounds.stageHeight,
        x: bounds.right,
        y: bounds.footY,
      });

      const bodyWorldWidth = Math.max(
        .7,
        left.distanceTo(right),
      );
      const platformScale = THREE.MathUtils.clamp(
        bodyWorldWidth / 2.65,
        .58,
        1.32,
      );

      /*
       * Os anéis ficam em y=.22 dentro do grupo. O deslocamento abaixo faz o
       * topo luminoso da plataforma coincidir com os pés do personagem.
       */
      platform.position.set(
        foot.x,
        foot.y - .22,
        0,
      );
      platform.scale.setScalar(platformScale);

      const beamBottom = foot.y + .04;
      const beamTop = Math.max(
        beamBottom + .8,
        head.y + .52,
      );
      const beamHeight = beamTop - beamBottom;

      beam.position.set(
        foot.x,
        (beamBottom + beamTop) / 2,
        0,
      );
      beam.scale.set(
        THREE.MathUtils.clamp(
          platformScale * .72,
          .48,
          1.05,
        ),
        Math.max(.15, beamHeight / 4.7),
        THREE.MathUtils.clamp(
          platformScale * .72,
          .48,
          1.05,
        ),
      );

      keyLight.position.set(
        head.x,
        head.y + .55,
        2,
      );
    };

    runtime.setCharacterBounds = applyCharacterBounds;

    runtime.setColor = (nextColor) => {
      runtime.accentMaterials.forEach((material) => {
        material.color?.set(nextColor);
        material.needsUpdate = true;
      });
      keyLight.color.set(nextColor);

      if (Array.isArray(grid.material)) {
        grid.material[0]?.color?.set(nextColor);
      } else {
        grid.material?.color?.set(nextColor);
      }
    };

    runtime.triggerInteraction = () => {
      runtime.interactionElapsed = 0;
      interactionRing.visible = true;
      interactionRing.scale.setScalar(.5);
      interactionMaterial.opacity = quality.reduceMotion
        ? .42
        : .95;
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();

      camera.aspect = (
        Math.max(1, rect.width)
        / Math.max(1, rect.height)
      );
      camera.updateProjectionMatrix();

      renderer.setSize(
        Math.max(1, rect.width),
        Math.max(1, rect.height),
        false,
      );

      if (runtime.characterBounds) {
        applyCharacterBounds({
          ...runtime.characterBounds,
          stageWidth: rect.width,
          stageHeight: rect.height,
        });
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let visible = (
      document.visibilityState !== "hidden"
    );
    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
    };
    document.addEventListener(
      "visibilitychange",
      onVisibility,
    );

    const timer = new THREE.Timer();
    timer.connect(document);
    let frameId = 0;

    const baseKeyLightIntensity = 13;
    const baseBeamOpacity = .075;

    const frame = (timestamp) => {
      if (runtime.disposed) return;

      frameId = requestAnimationFrame(frame);
      if (!visible) return;

      timer.update(timestamp);
      const delta = Math.min(
        .04,
        timer.getDelta(),
      );

      if (!quality.reduceMotion) {
        platform.rotation.y += delta * .12;

        rings.forEach((ring, index) => {
          ring.rotation.z += (
            delta * (index % 2 ? -.22 : .18)
          );
        });

        particles.rotation.y += delta * .08;
      }

      if (runtime.interactionElapsed >= 0) {
        runtime.interactionElapsed += delta;

        const duration = quality.reduceMotion
          ? .2
          : .72;
        const progress = Math.min(
          1,
          runtime.interactionElapsed / duration,
        );
        const eased = 1 - (
          1 - progress
        ) ** 3;
        const flash = Math.sin(progress * Math.PI);

        interactionRing.scale.setScalar(
          .5 + eased * 1.45,
        );
        interactionMaterial.opacity = (
          1 - progress
        ) * (quality.reduceMotion ? .42 : .95);
        keyLight.intensity = (
          baseKeyLightIntensity + flash * 18
        );
        beamMaterial.opacity = (
          baseBeamOpacity + flash * .13
        );

        if (progress >= 1) {
          runtime.interactionElapsed = -1;
          interactionRing.visible = false;
          interactionMaterial.opacity = 0;
          keyLight.intensity = baseKeyLightIntensity;
          beamMaterial.opacity = baseBeamOpacity;
        }
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
      document.removeEventListener(
        "visibilitychange",
        onVisibility,
      );
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };

    return runtime;
  } catch (error) {
    console.warn(
      "Loadout WebGL unavailable:",
      error,
    );

    if (scene) disposeScene(scene);

    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement?.remove();
    onFailure?.();

    return null;
  }
}
