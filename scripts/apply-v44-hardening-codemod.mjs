#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function update(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`Codemod não alterou ${relativePath}`);
  fs.writeFileSync(filePath, next);
}

function replaceRequired(source, searchValue, replacement, label) {
  if (typeof searchValue === "string" && !source.includes(searchValue)) {
    throw new Error(`Trecho obrigatório não encontrado: ${label}`);
  }
  if (searchValue instanceof RegExp && !searchValue.test(source)) {
    throw new Error(`Padrão obrigatório não encontrado: ${label}`);
  }
  return source.replace(searchValue, replacement);
}

update("src/game/BattleScreen.jsx", (source) => {
  let next = source;

  next = replaceRequired(
    next,
    'import { useBattleController } from "./hooks/useBattleController.js";\n',
    'import { useBattleController } from "./hooks/useBattleController.js";\nimport { useBattleInteractions } from "./hooks/useBattleInteractions.js";\n',
    "import de useBattleController",
  );

  next = replaceRequired(
    next,
    /\n  useEffect\(\(\) => \{\n    if \(!targetingDecision && snapshot\.adaptiveAid\.status !== "targeting"\) return undefined;[\s\S]*?\n  \}, \[targetingDecision, snapshot\.adaptiveAid\.status\]\);\n/,
    "\n",
    "listener Escape de targeting legado",
  );

  next = replaceRequired(
    next,
    `  const setActionMessage = useCallback((text) => {\n    setMessage(text, { persistent: true, tone: "action" });\n  }, [setMessage]);\n`,
    `  const setActionMessage = useCallback((text) => {\n    setMessage(text, { persistent: true, tone: "action" });\n  }, [setMessage]);\n  const {\n    activateColossusSpecial,\n    handleCanvasClick,\n    handleCanvasContextMenu,\n    handleCanvasMove,\n    handleCanvasPointerLeave,\n    releaseMouseTool,\n  } = useBattleInteractions({\n    adaptiveSettingsRef,\n    consumeGraphicsEventsAtVisualTime,\n    controller,\n    freeHandMessage: FREE_HAND_ACTIVATED_MESSAGE,\n    hoveredCellRef,\n    particlesRef,\n    play,\n    removeMode,\n    repositionTroopId,\n    selectedTroop,\n    sessionRef,\n    setMessage,\n    setRemoveMode,\n    setRepositionTroopId,\n    setSelectedTroop,\n    setSnapshot,\n    setTargetingDecision,\n    snapshot,\n    targetingDecision,\n  });\n`,
    "setActionMessage",
  );

  next = replaceRequired(
    next,
    "        convoyCountdownStepRef, fortunePaused, frameDelta, lastCriticalBeepRef,\n        particlesRef,",
    "        convoyCountdownStepRef, fortunePaused, frameDelta, lastCriticalBeepRef, now,\n        particlesRef,",
    "agendamento do battleFrameProgress",
  );

  // Extrai somente pointer/move/release. O pulso de desmaterialização permanece
  // responsabilidade da BattleScreen porque é uma ação explícita do HUD/overlay.
  next = replaceRequired(
    next,
    /\n  const canvasPointFromPointer = \(event\) => getBattleFieldPoint\(event, VIEWPORT\);[\s\S]*?\n  const handleActivateDematerializationPulse =/,
    "\n  const handleActivateDematerializationPulse =",
    "handlers pointer/move/release legados",
  );

  next = replaceRequired(
    next,
    /\n  const handleCanvasContextMenu = \(event\) => \{[\s\S]*?\n  const handleStartWave = \(\) => \{/,
    "\n  const handleStartWave = () => {",
    "handlers contextmenu/click legados",
  );

  next = replaceRequired(
    next,
    /onPointerLeave=\{\(event\) => \{\n\s*hoveredCellRef\.current = null;\n\s*if \(sessionRef\.current\.pendingPositionalDecision\) sessionRef\.current\.pendingPositionalDecision\.preview = null;\n\s*setEnergyPickupPointer\(sessionRef\.current, null\);\n\s*event\.currentTarget\.style\.cursor = "default";\n\s*\}\}/,
    "onPointerLeave={handleCanvasPointerLeave}",
    "pointer leave inline",
  );

  return next;
});

update("src/game/render/entityRenderer.js", (source) => {
  let next = replaceRequired(
    source,
    'import { registerTroopVisualEffects } from "./troopEffectsRegistry.js";',
    'import { getTroopVisualEffects, registerTroopVisualEffects } from "./troopEffectsRegistry.js";',
    "import do TroopEffectsRegistry",
  );

  const oldSequence = `  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);\n  drawLumiDefenseShield(ctx, scratch, config, session.elapsed, settings);\n  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);\n  drawNaniteTargetEffect(ctx, scratch, session, settings); drawTroopCooldown(ctx, scratch, session, settings); drawLeviathanStateEffect(ctx, scratch, session, settings); drawExecutorComboIndicator(ctx, scratch, session.elapsed, settings); drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings); drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height); drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings); drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings); drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings); drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed); drawAresThermalShield(ctx, logicalEntity, settings);`;

  const newSequence = `  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);\n  const troopEffects = getTroopVisualEffects(logicalEntity.type);\n  const troopEffectContext = { ctx, entity: scratch, logicalEntity, config, session, assets, settings, now, height };\n  troopEffects.beforeSpecial?.(troopEffectContext);\n  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);\n  troopEffects.afterSpecial?.(troopEffectContext);\n  drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings); drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height); drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings); drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings); drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings); drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed);\n  troopEffects.afterHealth?.(troopEffectContext);`;

  next = replaceRequired(next, oldSequence, newSequence, "sequência visual de tropas");

  const oldRegistrations = `registerTroopVisualEffects("medicaNanites", { underlay: drawNaniteTargetEffect });\nregisterTroopVisualEffects("lumiUrsa7", { overlay: drawLumiDefenseShield });`;
  const newRegistrations = `registerTroopVisualEffects("lumiUrsa7", {\n  beforeSpecial: ({ ctx, entity, config, session, settings }) =>\n    drawLumiDefenseShield(ctx, entity, config, session.elapsed, settings),\n}, { replace: true });\nregisterTroopVisualEffects("medicaNanites", {\n  afterSpecial: ({ ctx, entity, session, settings }) => {\n    drawNaniteTargetEffect(ctx, entity, session, settings);\n    drawTroopCooldown(ctx, entity, session, settings);\n  },\n}, { replace: true });\nregisterTroopVisualEffects("cacadorLeviatas", {\n  afterSpecial: ({ ctx, entity, session, settings }) => {\n    drawTroopCooldown(ctx, entity, session, settings);\n    drawLeviathanStateEffect(ctx, entity, session, settings);\n  },\n}, { replace: true });\nregisterTroopVisualEffects("executorArco", {\n  afterSpecial: ({ ctx, entity, session, settings }) =>\n    drawExecutorComboIndicator(ctx, entity, session.elapsed, settings),\n}, { replace: true });\nregisterTroopVisualEffects("aresT", {\n  afterHealth: ({ ctx, logicalEntity, settings }) =>\n    drawAresThermalShield(ctx, logicalEntity, settings),\n}, { replace: true });`;

  return replaceRequired(next, oldRegistrations, newRegistrations, "registros antigos de efeitos de tropa");
});

update("src/game/validation/gameContentValidator.js", (source) => replaceRequired(
  source,
  `  const looksVisual = typeof value.state === "string"\n    || Object.hasOwn(value, "durationMs")\n    || Array.isArray(value.timeline)\n    || Array.isArray(value.shots)\n    || Object.hasOwn(value, "frameMuzzles")\n    || Object.hasOwn(value, "muzzle");`,
  `  const visualPath = path.split(".").some((segment) => /visuals?$/i.test(segment));\n  const looksVisual = typeof value.state === "string"\n    || Array.isArray(value.timeline)\n    || Array.isArray(value.shots)\n    || Object.hasOwn(value, "frameMuzzles")\n    || Object.hasOwn(value, "muzzle")\n    || (visualPath && Object.hasOwn(value, "durationMs"));`,
  "detecção genérica de contratos visuais",
));

update("src/game/validation/gameContentValidator.test.js", (source) => replaceRequired(
  source,
  `  it("mantém contradições de targeting e sobreposição como warnings", () => {`,
  `  it("não interpreta durationMs de regra de gameplay como duração visual", () => {\n    const troop = validTroop({\n      fracture: { durationMs: { 2: 9000, 3: 12000 }, columns: [2, 3, 4] },\n    });\n    const result = validateGameContent({ troops: { sample: troop }, assetManifest: manifest() });\n\n    expect(result.valid).toBe(true);\n    expect(result.errors.map((entry) => entry.code)).not.toContain("VISUAL_DURATION_INVALID");\n  });\n\n  it("mantém contradições de targeting e sobreposição como warnings", () => {`,
  "teste de durationMs de gameplay",
));

update("src/game/content.js", (source) => {
  let next = replaceRequired(
    source,
    `    ], shots: [{ frame: 0 }, { frame: 1 }, { frame: 2 }] },`,
    `    ], shots: [{ atMs: 0, frame: 0 }, { atMs: 80, frame: 1 }, { atMs: 160, frame: 2 }] },`,
    "timings explícitos da MANTIS",
  );

  next = replaceRequired(
    next,
    `      timeline: Array.from({ length: 8 }, (_, frame) => ({ atMs: frame * (780 / 7), frame })),`,
    `      timeline: Array.from({ length: 8 }, (_, frame) => ({ atMs: frame * (780 / 8), frame })),`,
    "timeline do Fuzileiro Voltaico",
  );

  return next;
});

await import("./apply-quality-gates.mjs");

console.log("V45: fronteiras de interação/render e contratos de conteúdo consolidados.");
