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
  uniform vec3 uLightDirection;
  uniform float uRimPower;
  uniform float uDayIntensity;
  uniform float uNightIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDirection))), uRimPower);
    float day = max(0.0, dot(normalize(vNormal), normalize(uLightDirection)));
    float litSide = mix(uNightIntensity, uDayIntensity, day);
    gl_FragColor = vec4(uColor, rim * litSide * uOpacity);
  }
`;

// Keeps the familiar material.color/opacity contract so world-theme fades and
// tween code can drive the shader without special cases.
export function createGenesisAtmosphereMaterial(THREE, {
  color = "#bdeaff", opacity = .12, lightDirection = [ .35, .72, .6 ],
  rimPower = 3, dayIntensity = 1, nightIntensity = .4,
} = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
    uLightDirection: { value: new THREE.Vector3().fromArray(lightDirection).normalize() },
    uRimPower: { value: rimPower }, uDayIntensity: { value: dayIntensity }, uNightIntensity: { value: nightIntensity },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER,
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  material.color = uniforms.uColor.value;
  material.opacity = opacity;
  material.userData.setGenesisLightDirection = (direction) => uniforms.uLightDirection.value.copy(direction).normalize();
  material.userData.setGenesisAtmosphereProfile = ({ rimPower: nextRimPower, dayIntensity: nextDay, nightIntensity: nextNight, opacity: nextOpacity } = {}) => {
    if (Number.isFinite(nextRimPower)) uniforms.uRimPower.value = nextRimPower;
    if (Number.isFinite(nextDay)) uniforms.uDayIntensity.value = nextDay;
    if (Number.isFinite(nextNight)) uniforms.uNightIntensity.value = nextNight;
    if (Number.isFinite(nextOpacity)) material.opacity = nextOpacity;
  };
  material.userData.genesisAtmosphereFresnel = true;
  material.onBeforeRender = () => { uniforms.uOpacity.value = material.opacity; };
  return material;
}

export function syncGenesisAtmosphereWithLight(atmosphere, keyLight) {
  atmosphere?.material?.userData?.setGenesisLightDirection?.(keyLight?.position);
}
