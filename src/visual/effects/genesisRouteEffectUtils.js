import { CHAPTERS } from "../../game/content.js";
import {
  CAMPAIGN_PHASE_LOCATIONS,
  latLonToCartesian,
} from "../../campaign/campaignSceneData.js";
import { createSeededRandom } from "./genesisEffectUtils.js";

function chapterForId(chapterId) {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) || null;
}

function phaseNormal(THREE, phaseId) {
  const location = CAMPAIGN_PHASE_LOCATIONS[phaseId];
  if (!location) return null;
  const point = latLonToCartesian(
    location.latitude,
    location.longitude,
    1,
  );
  return new THREE.Vector3(point.x, point.y, point.z).normalize();
}

function makeFrame(THREE, normal, tangent) {
  const safeTangent = tangent.clone()
    .addScaledVector(normal, -tangent.dot(normal))
    .normalize();
  const lateral = new THREE.Vector3()
    .crossVectors(normal, safeTangent)
    .normalize();
  safeTangent.crossVectors(lateral, normal).normalize();
  return { normal, tangent: safeTangent, lateral };
}

export function getChapterPhaseFrames(THREE, chapterId) {
  const chapter = chapterForId(chapterId);
  if (!chapter) return [];
  const normals = chapter.phaseIds
    .map((phaseId) => ({ phaseId, normal: phaseNormal(THREE, phaseId) }))
    .filter((entry) => entry.normal);

  return normals.map((entry, index) => {
    const previous = normals[Math.max(0, index - 1)]?.normal || entry.normal;
    const next = normals[Math.min(normals.length - 1, index + 1)]?.normal || entry.normal;
    const tangent = next.clone().sub(previous);
    return {
      phaseId: entry.phaseId,
      ...makeFrame(THREE, entry.normal.clone(), tangent),
    };
  });
}

export function getChapterRouteFrames(
  THREE,
  chapterId,
  samplesPerSegment = 5,
) {
  const phases = getChapterPhaseFrames(THREE, chapterId);
  if (phases.length < 2) return phases;
  const frames = [];

  for (let segment = 0; segment < phases.length - 1; segment += 1) {
    const start = phases[segment].normal;
    const end = phases[segment + 1].normal;
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const normal = start.clone().lerp(end, t).normalize();
      const tangent = end.clone().sub(start);
      frames.push({
        segment,
        progress: (segment + t) / (phases.length - 1),
        ...makeFrame(THREE, normal, tangent),
      });
    }
  }

  const last = phases.at(-1);
  frames.push({
    segment: phases.length - 2,
    progress: 1,
    ...makeFrame(THREE, last.normal.clone(), last.tangent.clone()),
  });
  return frames;
}

export function createRoutePlacements({
  THREE,
  chapterId,
  count,
  seed,
  minimumSideOffset = .04,
  maximumSideOffset = .1,
  alongJitter = .025,
}) {
  const random = createSeededRandom(seed);
  const frames = getChapterRouteFrames(THREE, chapterId, 8);
  if (!frames.length) return [];

  return Array.from({ length: count }, (_, index) => {
    const evenProgress = (index + .5) / Math.max(1, count);
    const jitter = (random() - .5) * .85 / Math.max(1, count);
    const progress = Math.max(0, Math.min(1, evenProgress + jitter));
    const frameIndex = Math.min(
      frames.length - 1,
      Math.floor(progress * frames.length),
    );
    const source = frames[frameIndex];
    const side = index % 2 === 0 ? -1 : 1;
    const sideOffset = side * (
      minimumSideOffset
      + random() * (maximumSideOffset - minimumSideOffset)
    );
    const alongOffset = (random() - .5) * alongJitter;
    const normal = source.normal.clone()
      .addScaledVector(source.lateral, sideOffset)
      .addScaledVector(source.tangent, alongOffset)
      .normalize();
    const tangent = source.tangent.clone()
      .addScaledVector(normal, -source.tangent.dot(normal))
      .normalize();
    return {
      ...makeFrame(THREE, normal, tangent),
      random,
      index,
      progress,
    };
  });
}

export function createRouteInstances({
  THREE,
  chapterId,
  geometry,
  material,
  count,
  seed,
  radius = 1.02,
  minimumSideOffset = .04,
  maximumSideOffset = .1,
  alongJitter = .025,
  scaleAt = (random) => {
    const value = .7 + random() * .7;
    return [value, value, value];
  },
  rotationJitter = Math.PI * 2,
}) {
  const placements = createRoutePlacements({
    THREE,
    chapterId,
    count,
    seed,
    minimumSideOffset,
    maximumSideOffset,
    alongJitter,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  const basis = new THREE.Matrix4();

  placements.forEach((placement, index) => {
    dummy.position.copy(placement.normal).multiplyScalar(radius);
    basis.makeBasis(
      placement.lateral,
      placement.normal,
      placement.tangent,
    );
    dummy.quaternion.setFromRotationMatrix(basis);
    dummy.rotateY((placement.random() - .5) * rotationJitter);
    const scale = scaleAt(placement.random, index, placement);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createRoutePoints({
  THREE,
  chapterId,
  count,
  seed,
  radius = 1.045,
  heightRange = .035,
  minimumSideOffset = .025,
  maximumSideOffset = .11,
  color,
  size,
  opacity = .5,
  additive = true,
}) {
  const placements = createRoutePlacements({
    THREE,
    chapterId,
    count,
    seed,
    minimumSideOffset,
    maximumSideOffset,
    alongJitter: .05,
  });
  const positions = new Float32Array(placements.length * 3);
  placements.forEach((placement, index) => {
    const point = placement.normal.clone().multiplyScalar(
      radius + placement.random() * heightRange,
    );
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return new THREE.Points(geometry, material);
}

export function createRouteWindSegments({
  THREE,
  chapterId,
  count,
  seed,
  radius = 1.065,
  length = .11,
  color = "#dbeafe",
  opacity = .46,
}) {
  const placements = createRoutePlacements({
    THREE,
    chapterId,
    count,
    seed,
    minimumSideOffset: .035,
    maximumSideOffset: .12,
    alongJitter: .04,
  });
  const positions = new Float32Array(placements.length * 6);
  placements.forEach((placement, index) => {
    const start = placement.normal.clone().multiplyScalar(radius);
    const end = placement.normal.clone()
      .addScaledVector(placement.tangent, length * (.7 + placement.random() * .6))
      .normalize()
      .multiplyScalar(radius + .006);
    positions[index * 6] = start.x;
    positions[index * 6 + 1] = start.y;
    positions[index * 6 + 2] = start.z;
    positions[index * 6 + 3] = end.x;
    positions[index * 6 + 4] = end.y;
    positions[index * 6 + 5] = end.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.windMaterial = material;
  return lines;
}

export function createRouteRibbon({
  THREE,
  chapterId,
  radius = 1.027,
  width = .055,
  sideOffset = 0,
  material,
}) {
  const frames = getChapterRouteFrames(THREE, chapterId, 9);
  const positions = [];
  const indices = [];

  frames.forEach((frame, index) => {
    const center = frame.normal.clone()
      .addScaledVector(frame.lateral, sideOffset)
      .normalize();
    const left = center.clone()
      .addScaledVector(frame.lateral, -width * .5)
      .normalize()
      .multiplyScalar(radius);
    const right = center.clone()
      .addScaledVector(frame.lateral, width * .5)
      .normalize()
      .multiplyScalar(radius);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    if (index < frames.length - 1) {
      const current = index * 2;
      indices.push(
        current, current + 1, current + 2,
        current + 1, current + 3, current + 2,
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
