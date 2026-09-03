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

update("src/game/BattleScreen.jsx", (source) => {
  let next = source;

  next = next.replace(
    'import { useBattleController } from "./hooks/useBattleController.js";\n',
    'import { useBattleController } from "./hooks/useBattleController.js";\nimport { useBattleInteractions } from "./hooks/useBattleInteractions.js";\n',
  );

  next = next.replace(
    /\n  useEffect\(\(\) => \{\n    if \(!targetingDecision && snapshot\.adaptiveAid\.status !== "targeting"\) return undefined;[\s\S]*?\n  \}, \[targetingDecision, snapshot\.adaptiveAid\.status\]\);\n/,
    "\n",
  );

  next = next.replace(
    `  const setActionMessage = useCallback((text) => {\n    setMessage(text, { persistent: true, tone: "action" });\n  }, [setMessage]);\n`,
    `  const setActionMessage = useCallback((text) => {\n    setMessage(text, { persistent: true, tone: "action" });\n  }, [setMessage]);\n  const {\n    activateColossusSpecial,\n    handleCanvasClick,\n    handleCanvasContextMenu,\n    handleCanvasMove,\n    handleCanvasPointerLeave,\n    releaseMouseTool,\n  } = useBattleInteractions({\n    adaptiveSettingsRef,\n    consumeGraphicsEventsAtVisualTime,\n    controller,\n    freeHandMessage: FREE_HAND_ACTIVATED_MESSAGE,\n    hoveredCellRef,\n    particlesRef,\n    play,\n    removeMode,\n    repositionTroopId,\n    selectedTroop,\n    sessionRef,\n    setMessage,\n    setRemoveMode,\n    setRepositionTroopId,\n    setSelectedTroop,\n    setSnapshot,\n    setTargetingDecision,\n    snapshot,\n    targetingDecision,\n  });\n`,
  );

  next = next.replace(
    "        convoyCountdownStepRef, fortunePaused, frameDelta, lastCriticalBeepRef,\n        particlesRef,",
    "        convoyCountdownStepRef, fortunePaused, frameDelta, lastCriticalBeepRef, now,\n        particlesRef,",
  );

  next = next.replace(
    /\n  const canvasPointFromPointer = \(event\) => getBattleFieldPoint\(event, VIEWPORT\);[\s\S]*?\n  const handleStartWave = \(\) => \{/,
    "\n  const handleStartWave = () => {",
  );

  next = next.replace(
    /onPointerLeave=\{\(event\) => \{\n\s*hoveredCellRef\.current = null;\n\s*if \(sessionRef\.current\.pendingPositionalDecision\) sessionRef\.current\.pendingPositionalDecision\.preview = null;\n\s*setEnergyPickupPointer\(sessionRef\.current, null\);\n\s*event\.currentTarget\.style\.cursor = "default";\n\s*\}\}/,
    "onPointerLeave={handleCanvasPointerLeave}",
  );

  return next;
});

update("src/game/render/entityRenderer.js", (source) => {
  let next = source.replace(
    'import { registerTroopVisualEffects } from "./troopEffectsRegistry.js";',
    'import { getTroopVisualEffects, registerTroopVisualEffects } from "./troopEffectsRegistry.js";',
  );

  const oldSequence = `  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);\n  drawLumiDefenseShield(ctx, scratch, config, session.elapsed, settings);\n  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);\n  drawNaniteTargetEffect(ctx, scratch, session, settings); drawTroopCooldown(ctx, scratch, session, settings); drawLeviathanStateEffect(ctx, scratch, session, settings); drawExecutorComboIndicator(ctx, scratch, session.elapsed, settings); drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings); drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height); drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings); drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings); drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings); drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed); drawAresThermalShield(ctx, logicalEntity, settings);`;

  const newSequence = `  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);\n  const troopEffects = getTroopVisualEffects(logicalEntity.type);\n  const troopEffectContext = { ctx, entity: scratch, logicalEntity, config, session, assets, settings, now, height };\n  troopEffects.beforeSpecial?.(troopEffectContext);\n  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);\n  troopEffects.afterSpecial?.(troopEffectContext);\n  drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings); drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height); drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings); drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings); drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings); drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed);\n  troopEffects.afterHealth?.(troopEffectContext);`;

  if (!next.includes(oldSequence)) throw new Error("Sequência visual de tropas esperada não foi encontrada.");
  next = next.replace(oldSequence, newSequence);

  const oldRegistrations = `registerTroopVisualEffects("medicaNanites", { underlay: drawNaniteTargetEffect });\nregisterTroopVisualEffects("lumiUrsa7", { overlay: drawLumiDefenseShield });`;
  const newRegistrations = `registerTroopVisualEffects("lumiUrsa7", {\n  beforeSpecial: ({ ctx, entity, config, session, settings }) =>\n    drawLumiDefenseShield(ctx, entity, config, session.elapsed, settings),\n}, { replace: true });\nregisterTroopVisualEffects("medicaNanites", {\n  afterSpecial: ({ ctx, entity, session, settings }) => {\n    drawNaniteTargetEffect(ctx, entity, session, settings);\n    drawTroopCooldown(ctx, entity, session, settings);\n  },\n}, { replace: true });\nregisterTroopVisualEffects("cacadorLeviatas", {\n  afterSpecial: ({ ctx, entity, session, settings }) => {\n    drawTroopCooldown(ctx, entity, session, settings);\n    drawLeviathanStateEffect(ctx, entity, session, settings);\n  },\n}, { replace: true });\nregisterTroopVisualEffects("executorArco", {\n  afterSpecial: ({ ctx, entity, session, settings }) =>\n    drawExecutorComboIndicator(ctx, entity, session.elapsed, settings),\n}, { replace: true });\nregisterTroopVisualEffects("aresT", {\n  afterHealth: ({ ctx, logicalEntity, settings }) =>\n    drawAresThermalShield(ctx, logicalEntity, settings),\n}, { replace: true });`;
  if (!next.includes(oldRegistrations)) throw new Error("Registros antigos de efeitos de tropa não foram encontrados.");
  return next.replace(oldRegistrations, newRegistrations);
});

console.log("V44 hardening codemod aplicado.");
