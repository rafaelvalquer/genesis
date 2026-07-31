export const LOADOUT_TROOP_VISUALS = {
  /*
   * scale/offset antigos continuam disponíveis para retratos e compatibilidade.
   * stageScale/stageOffset são usados exclusivamente no palco de corpo inteiro.
   */
  operadorJano: {
    scale: 1.02,
    offsetY: 4,
    stageScale: .9,
    hologram: 1.05,
  },
  artilheiraMorteiro: {
    scale: 1.28,
    offsetY: 16,
    stageScale: .82,
    portraitClass: "wide-sprite",
    hologram: 1.15,
  },
  droneSentinela: {
    scale: .8,
    offsetY: -3,
    stageScale: .72,
    stageOffsetY: -4,
    previewState: "idle",
    hologram: .92,
  },
  executorArco: {
    scale: .85,
    offsetY: 4,
    stageScale: .84,
    previewState: "idle",
    hologram: .9,
  },
  muralhaReforcada: {
    scale: 1.18,
    offsetY: 22,
    stageScale: .78,
    stageOffsetY: -2,
    previewState: "defense",
    hologram: .8,
  },
  bombardeiro: {
    scale: 1.12,
    offsetY: -10,
    stageScale: .84,
  },
  cacadorLeviatas: {
    scale: 1.13,
    offsetY: 4,
    stageScale: .82,
  },
  colossoImpacto: {
    scale: 1.2,
    offsetY: 12,
    stageScale: .8,
  },
  demolidora: {
    stageScale: .86,
    stageOffsetX: 8,
  },
  medicaNanites: {
    stageScale: .88,
  },
  lumiUrsa7: {
    stageScale: .8,
  },
  interceptadorIcaro: {
    stageScale: .84,
  },
  reator: {
    stageScale: .76,
  },
};

const DEFAULT_VISUAL = Object.freeze({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  previewState: "idle",
  portraitClass: "",
  hologram: 1,
  stageScale: .9,
  stageOffsetX: 0,
  stageOffsetY: 0,
  stagePaddingX: .045,
  stagePaddingY: .035,
});

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function getLoadoutTroopVisual(troop) {
  return {
    ...DEFAULT_VISUAL,
    ...(LOADOUT_TROOP_VISUALS[troop?.spriteKey]
      || LOADOUT_TROOP_VISUALS[troop?.id]),
    flipX: Boolean(troop?.flipX),
  };
}

export function getLoadoutStageVisual(troop) {
  const visual = getLoadoutTroopVisual(troop);

  return {
    /*
     * O palco nunca amplia acima do encaixe calculado. Isso garante que o
     * corpo medido permaneça dentro da área segura.
     */
    scale: Math.min(
      1,
      Math.max(.55, finiteOr(visual.stageScale, DEFAULT_VISUAL.stageScale)),
    ),
    offsetX: finiteOr(visual.stageOffsetX, 0),
    offsetY: finiteOr(visual.stageOffsetY, 0),
    paddingX: Math.min(
      .18,
      Math.max(0, finiteOr(visual.stagePaddingX, DEFAULT_VISUAL.stagePaddingX)),
    ),
    paddingY: Math.min(
      .18,
      Math.max(0, finiteOr(visual.stagePaddingY, DEFAULT_VISUAL.stagePaddingY)),
    ),
    flipX: visual.flipX,
  };
}
