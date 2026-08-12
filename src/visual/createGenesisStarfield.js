function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const VERTEX_SHADER = `
  attribute vec3 color;
  attribute float twinkle;
  attribute float phase;
  uniform float uTime;
  uniform float uSize;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float pulse = 1.0 + twinkle * sin(uTime * (.45 + phase * .18) + phase * 6.283);
    gl_PointSize = max(1.0, uSize * 260.0 * pulse / max(1.0, -viewPosition.z));
    vColor = color;
    vAlpha = .72 + twinkle * .28 * pulse;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float edge = smoothstep(.5, .08, length(gl_PointCoord - .5));
    gl_FragColor = vec4(vColor, edge * vAlpha * uOpacity);
  }
`;

export function createGenesisStarField(THREE, { count, minRadius, spread, size, opacity, seed = 1337 }) {
  const random = createRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const twinkle = new Float32Array(count);
  const phase = new Float32Array(count);
  const cool = new THREE.Color("#bde7ff");
  const blue = new THREE.Color("#dcecff");
  const warm = new THREE.Color("#fff1c4");
  for (let index = 0; index < count; index += 1) {
    const radius = minRadius + random() * spread;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = random() < .025 ? warm : random() < .06 ? blue : cool;
    colors.set([color.r, color.g, color.b], index * 3);
    twinkle[index] = random() < .085 ? .55 + random() * .45 : 0;
    phase[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("twinkle", new THREE.BufferAttribute(twinkle, 1));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const uniforms = { uTime: { value: 0 }, uSize: { value: size }, uOpacity: { value: opacity } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, transparent: true, depthWrite: false });
  material.opacity = opacity;
  material.onBeforeRender = () => { uniforms.uOpacity.value = material.opacity; };
  const stars = new THREE.Points(geometry, material);
  stars.userData.genesisStarfield = true;
  return stars;
}

export function updateGenesisStarField(stars, elapsed) {
  if (stars?.material?.uniforms?.uTime) stars.material.uniforms.uTime.value = elapsed;
}
