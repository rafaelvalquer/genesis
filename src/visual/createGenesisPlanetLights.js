function fallbackLighting(biome = {}) {
  return {
    keyColor: biome.light || "#ffffff",
    keyIntensity: 2,
    keyPosition: [3.5, 2.4, 4.5],
    fillColor: biome.atmosphere || "#bdeaff",
    fillGroundColor: biome.ambient || "#07101c",
    fillIntensity: .82,
    rimColor: biome.atmosphere || "#bdeaff",
    rimIntensity: .65,
    rimPosition: [-3, .8, -3.5],
    ambientColor: "#ffffff",
    ambientIntensity: .08,
    terminatorStrength: .78,
    exposure: 1.05,
    transitionSpeed: 5,
  };
}

export function getGenesisLightingState(biome = {}) {
  return {
    ...fallbackLighting(biome),
    ...(biome.lighting || {}),
  };
}

function withTerminatorContrast(lighting) {
  const strength = Math.max(0, Math.min(1, lighting.terminatorStrength ?? .78));
  return {
    ...lighting,
    keyIntensity: lighting.keyIntensity * (1 + strength * .12),
    fillIntensity: lighting.fillIntensity * (1 - strength * .62),
    ambientIntensity: lighting.ambientIntensity * (1 - strength * .5),
    rimIntensity: lighting.rimIntensity * (1 + strength * .15),
  };
}

function applyLightValues(
  lights,
  lighting,
  renderer = lights.renderer,
) {
  lights.keyLight.color.set(lighting.keyColor);
  lights.keyLight.intensity = lighting.keyIntensity;
  lights.keyLight.position.fromArray(lighting.keyPosition);

  lights.fillLight.color.set(lighting.fillColor);
  lights.fillLight.groundColor.set(
    lighting.fillGroundColor,
  );
  lights.fillLight.intensity = lighting.fillIntensity;

  lights.rimLight.color.set(lighting.rimColor);
  lights.rimLight.intensity = lighting.rimIntensity;
  lights.rimLight.position.fromArray(lighting.rimPosition);

  lights.ambientLight.color.set(lighting.ambientColor);
  lights.ambientLight.intensity =
    lighting.ambientIntensity;

  if (renderer) {
    renderer.toneMappingExposure = lighting.exposure;
  }
}

export function createGenesisPlanetLights(
  THREE,
  scene,
  biome,
  renderer = null,
) {
  const lighting = withTerminatorContrast(getGenesisLightingState(biome));

  const keyLight = new THREE.DirectionalLight(
    lighting.keyColor,
    lighting.keyIntensity,
  );
  keyLight.position.fromArray(lighting.keyPosition);

  const fillLight = new THREE.HemisphereLight(
    lighting.fillColor,
    lighting.fillGroundColor,
    lighting.fillIntensity,
  );

  const rimLight = new THREE.DirectionalLight(
    lighting.rimColor,
    lighting.rimIntensity,
  );
  rimLight.position.fromArray(lighting.rimPosition);

  const ambientLight = new THREE.AmbientLight(
    lighting.ambientColor,
    lighting.ambientIntensity,
  );

  scene.add(
    keyLight,
    fillLight,
    rimLight,
    ambientLight,
  );

  if (renderer) renderer.toneMappingExposure = lighting.exposure;

  return {
    keyLight,
    fillLight,
    rimLight,
    ambientLight,
    renderer,
    _genesisLightTransition: null,
  };
}

export function applyGenesisLightState(
  lights,
  biome,
  {
    immediate = false,
    renderer = lights.renderer,
  } = {},
) {
  const lighting = withTerminatorContrast(getGenesisLightingState(biome));

  lights.renderer = renderer || lights.renderer;

  if (immediate) {
    applyLightValues(lights, lighting, lights.renderer);
    lights._genesisLightTransition = null;
    return lighting;
  }

  const makeTargetColor = (value) => (
    lights.keyLight.color.clone().set(value)
  );
  lights.keyLight.position.fromArray(lighting.keyPosition);
  lights.rimLight.position.fromArray(lighting.rimPosition);

  lights._genesisLightTransition = {
    keyColor: makeTargetColor(lighting.keyColor),
    keyIntensity: lighting.keyIntensity,
    fillColor: makeTargetColor(lighting.fillColor),
    fillGroundColor: makeTargetColor(
      lighting.fillGroundColor,
    ),
    fillIntensity: lighting.fillIntensity,
    rimColor: makeTargetColor(lighting.rimColor),
    rimIntensity: lighting.rimIntensity,
    ambientColor: makeTargetColor(lighting.ambientColor),
    ambientIntensity: lighting.ambientIntensity,
    exposure: lighting.exposure,
    speed: lighting.transitionSpeed,
  };

  return lighting;
}

function colorDistanceSquared(left, right) {
  const red = left.r - right.r;
  const green = left.g - right.g;
  const blue = left.b - right.b;
  return red * red + green * green + blue * blue;
}

export function updateGenesisLightTransition(
  lights,
  delta,
  renderer = lights.renderer,
) {
  const target = lights?._genesisLightTransition;
  if (!target) return false;

  const blend = 1 - Math.exp(
    -Math.max(0, delta) * target.speed,
  );

  lights.keyLight.color.lerp(target.keyColor, blend);
  lights.keyLight.intensity += (
    target.keyIntensity
    - lights.keyLight.intensity
  ) * blend;

  lights.fillLight.color.lerp(target.fillColor, blend);
  lights.fillLight.groundColor.lerp(
    target.fillGroundColor,
    blend,
  );
  lights.fillLight.intensity += (
    target.fillIntensity
    - lights.fillLight.intensity
  ) * blend;

  lights.rimLight.color.lerp(target.rimColor, blend);
  lights.rimLight.intensity += (
    target.rimIntensity
    - lights.rimLight.intensity
  ) * blend;

  lights.ambientLight.color.lerp(
    target.ambientColor,
    blend,
  );
  lights.ambientLight.intensity += (
    target.ambientIntensity
    - lights.ambientLight.intensity
  ) * blend;

  if (renderer) {
    renderer.toneMappingExposure += (
      target.exposure
      - renderer.toneMappingExposure
    ) * blend;
  }

  const complete = (
    colorDistanceSquared(
      lights.keyLight.color,
      target.keyColor,
    ) < .000004
    && Math.abs(
      lights.keyLight.intensity - target.keyIntensity,
    ) < .002
    && colorDistanceSquared(
      lights.fillLight.color,
      target.fillColor,
    ) < .000004
    && colorDistanceSquared(
      lights.rimLight.color,
      target.rimColor,
    ) < .000004
    && Math.abs(
      lights.ambientLight.intensity
      - target.ambientIntensity,
    ) < .002
    && (
      !renderer
      || Math.abs(
        renderer.toneMappingExposure
        - target.exposure,
      ) < .002
    )
  );

  if (complete) {
    lights.keyLight.color.copy(target.keyColor);
    lights.keyLight.intensity = target.keyIntensity;
    lights.fillLight.color.copy(target.fillColor);
    lights.fillLight.groundColor.copy(
      target.fillGroundColor,
    );
    lights.fillLight.intensity = target.fillIntensity;
    lights.rimLight.color.copy(target.rimColor);
    lights.rimLight.intensity = target.rimIntensity;
    lights.ambientLight.color.copy(
      target.ambientColor,
    );
    lights.ambientLight.intensity =
      target.ambientIntensity;

    if (renderer) {
      renderer.toneMappingExposure = target.exposure;
    }

    lights._genesisLightTransition = null;
  }

  return true;
}
