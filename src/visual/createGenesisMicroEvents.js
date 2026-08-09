import {
  createSeededRandom,
  createShellPoints,
  randomSurfaceNormal,
} from "./effects/genesisEffectUtils.js";

function createEnergySignals(THREE) {
  const root = new THREE.Group();
  root.name = "HiveEnergySignals";
  const random = createSeededRandom(6101);
  const material = new THREE.MeshBasicMaterial({
    color: "#67e8f9", transparent: true, opacity: .58,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  for (let index = 0; index < 3; index += 1) {
    const signal = new THREE.Mesh(new THREE.RingGeometry(.025, .035, 18), material.clone());
    const normal = randomSurfaceNormal(THREE, random);
    signal.position.copy(normal).multiplyScalar(1.055);
    signal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    signal.userData.phase = random() * Math.PI * 2;
    root.add(signal);
  }
  root.userData.update = (elapsed, reduceMotion) => root.children.forEach((signal) => {
    const pulse = reduceMotion ? .55 : (Math.sin(elapsed * 2.2 + signal.userData.phase) + 1) * .5;
    signal.scale.setScalar(.8 + pulse * .55);
    signal.material.opacity = .2 + pulse * .52;
  });
  return root;
}

function createAurora(THREE) {
  const root = new THREE.Group();
  root.name = "GlassAurora";
  const aurora = new THREE.Mesh(
    new THREE.TorusGeometry(1.13, .018, 6, 72),
    new THREE.MeshBasicMaterial({
      color: "#a78bfa", transparent: true, opacity: .3,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  aurora.rotation.set(.78, -.3, .22);
  root.add(aurora);
  root.userData.update = (elapsed, reduceMotion) => {
    aurora.rotation.z = .22 + (reduceMotion ? 0 : Math.sin(elapsed * .3) * .08);
    aurora.material.opacity = reduceMotion ? .24 : .19 + (Math.sin(elapsed * 1.1) + 1) * .07;
  };
  return root;
}

function createDustStorm(THREE, profile) {
  const root = new THREE.Group();
  root.name = "ChitinDustStorm";
  const dust = createShellPoints({
    THREE, count: Math.max(14, Math.floor(profile.particles * .22)), seed: 6301,
    minimumRadius: 1.08, radiusRange: .12, color: "#fbbf24", size: .018, opacity: .26, equatorial: true,
  });
  root.add(dust);
  root.userData.update = (elapsed, reduceMotion) => {
    root.rotation.y = reduceMotion ? 0 : elapsed * .065;
    dust.material.opacity = reduceMotion ? .2 : .16 + (Math.sin(elapsed * .7) + 1) * .07;
  };
  return root;
}

function createLightning(THREE) {
  const root = new THREE.Group();
  root.name = "StormLightning";
  const material = new THREE.LineBasicMaterial({ color: "#e0f2fe", transparent: true, opacity: 0, depthWrite: false });
  const points = [
    new THREE.Vector3(-.08, 1.09, 0), new THREE.Vector3(-.025, 1.17, .02),
    new THREE.Vector3(.02, 1.1, -.018), new THREE.Vector3(.07, 1.19, .01),
  ];
  const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
  bolt.rotation.set(.35, .78, -.12);
  root.add(bolt);
  root.userData.update = (elapsed, reduceMotion) => {
    const flash = reduceMotion ? 0 : Math.max(0, Math.sin(elapsed * 1.8 + .7)) ** 18;
    material.opacity = flash * .92;
  };
  return root;
}

function createSatellite(THREE) {
  const root = new THREE.Group();
  root.name = "OceanSurveySatellite";
  const satellite = new THREE.Mesh(
    new THREE.BoxGeometry(.032, .02, .05),
    new THREE.MeshBasicMaterial({ color: "#e0f2fe", transparent: true, opacity: .85 }),
  );
  const panels = new THREE.Mesh(
    new THREE.BoxGeometry(.11, .006, .025),
    new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: .68, blending: THREE.AdditiveBlending }),
  );
  satellite.add(panels);
  root.add(satellite);
  root.userData.update = (elapsed, reduceMotion) => {
    const angle = reduceMotion ? .65 : elapsed * .42;
    satellite.position.set(Math.cos(angle) * 1.33, Math.sin(angle * 1.4) * .17, Math.sin(angle) * 1.33);
    satellite.rotation.y = -angle;
    panels.material.opacity = reduceMotion ? .55 : .48 + (Math.sin(elapsed * 2.4) + 1) * .14;
  };
  return root;
}

export function createGenesisMicroEvents({ THREE, chapterId, profile }) {
  const creators = {
    chapter_01: () => createEnergySignals(THREE),
    chapter_02: () => createAurora(THREE),
    chapter_03: () => createDustStorm(THREE, profile),
    chapter_04: () => createLightning(THREE),
    chapter_05: () => createSatellite(THREE),
  };
  const root = creators[chapterId]?.() || new THREE.Group();
  root.userData.microEvent = true;
  return root;
}
