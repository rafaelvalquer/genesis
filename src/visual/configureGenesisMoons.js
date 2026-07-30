import {
  GENESIS_MOON_PRIORITY,
  getGenesisPresentation,
} from "./genesisPlanetPresentation.js";

function rememberTransform(moon) {
  if (!moon.userData.genesisOriginalPosition) {
    moon.userData.genesisOriginalPosition = moon.position.clone();
    moon.userData.genesisOriginalScale = moon.scale.clone();
  }
}

export function configureGenesisMoons(parts, quality, presentationMode = "campaign") {
  if (!parts?.moons) return;
  const presentation = getGenesisPresentation(quality, presentationMode);
  const priority = new Map(GENESIS_MOON_PRIORITY.map((name, index) => [name, index]));
  const ordered = [...parts.moons].sort((left, right) => (
    (priority.get(left.name) ?? 99) - (priority.get(right.name) ?? 99)
  ));
  ordered.forEach((moon, index) => {
    rememberTransform(moon);
    moon.position.copy(moon.userData.genesisOriginalPosition)
      .multiplyScalar(presentation.moons.distanceMultiplier);
    moon.scale.copy(moon.userData.genesisOriginalScale)
      .multiplyScalar(presentation.moons.sizeMultiplier);
    moon.visible = index < presentation.moons.maxVisible;
  });
  parts.moons = ordered;
}
