const VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDirection))), 3.0);
    float litSide = .48 + .52 * max(0.0, dot(normalize(vNormal), normalize(vec3(.35, .72, .6))));
    gl_FragColor = vec4(uColor, rim * litSide * uOpacity);
  }
`;

// Keeps the familiar material.color/opacity contract so world-theme fades and
// tween code can drive the shader without special cases.
export function createGenesisAtmosphereMaterial(THREE, { color = "#bdeaff", opacity = .12 } = {}) {
  const uniforms = { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER,
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  material.color = uniforms.uColor.value;
  material.opacity = opacity;
  material.userData.genesisAtmosphereFresnel = true;
  material.onBeforeRender = () => { uniforms.uOpacity.value = material.opacity; };
  return material;
}
