export const LOADOUT_TROOP_VISUALS = {
  operadorJano: { scale: 1.02, offsetY: 4, hologram: 1.05 },
  artilheiraMorteiro: { scale: 1.28, offsetY: 16, portraitClass: "wide-sprite", hologram: 1.15 },
  droneSentinela: { scale: 0.8, offsetY: -3, previewState: "idle", hologram: 0.92 },
  executorArco: { scale: 0.85, offsetY: 4, previewState: "idle", hologram: 0.9 },
  muralhaReforcada: { scale: 1.18, offsetY: 22, previewState: "defense", hologram: .8 },
  bombardeiro: { scale: 1.12, offsetY: -10 },
  cacadorLeviatas: { scale: 1.13, offsetY: 4 },
  colossoImpacto: { scale: 1.2, offsetY: 12 },
};

const DEFAULT_VISUAL = Object.freeze({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  previewState: "idle",
  portraitClass: "",
  hologram: 1,
});

export function getLoadoutTroopVisual(troop) {
  return {
    ...DEFAULT_VISUAL,
    ...(LOADOUT_TROOP_VISUALS[troop?.spriteKey] || LOADOUT_TROOP_VISUALS[troop?.id]),
    flipX: Boolean(troop?.flipX),
  };
}
