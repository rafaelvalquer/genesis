#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());

function readText(relative) {
  const raw = fs.readFileSync(path.join(root, relative), "utf8");
  return {
    eol: raw.includes("\r\n") ? "\r\n" : "\n",
    content: raw.replace(/\r\n/g, "\n"),
  };
}

function writeText(relative, content, eol) {
  const normalized = content.replace(/\r\n/g, "\n");
  fs.writeFileSync(
    path.join(root, relative),
    eol === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized,
    "utf8",
  );
}

function getStaticImportRanges(content) {
  const ranges = [];
  const matcher = /^(?:\uFEFF)?import\b/gm;
  let match;
  while ((match = matcher.exec(content))) {
    const start = match.index;
    const semicolon = content.indexOf(";", start);
    if (semicolon < 0) continue;
    const statement = content.slice(start, semicolon + 1);
    if (!/\bfrom\s+["'][^"']+["']\s*;$/.test(statement.trim())
      && !/^import\s+["'][^"']+["']\s*;$/.test(statement.trim())) continue;
    let end = semicolon + 1;
    if (content[end] === "\r" && content[end + 1] === "\n") end += 2;
    else if (content[end] === "\n") end += 1;
    ranges.push({ start, end, statement });
    matcher.lastIndex = end;
  }
  return ranges;
}

function normalizeModuleImports(content, modulePaths, canonicalBlock) {
  const targets = new Set(modulePaths);
  const importModule = (statement) => {
    const match = statement.match(/\bfrom\s+["']([^"']+)["']/)
      || statement.match(/^import\s+["']([^"']+)["']/);
    return match?.[1] || null;
  };

  const ranges = getStaticImportRanges(content);
  const removals = ranges.filter((range) => targets.has(importModule(range.statement)));
  for (const range of removals.sort((a, b) => b.start - a.start)) {
    content = content.slice(0, range.start) + content.slice(range.end);
  }

  const remaining = getStaticImportRanges(content);
  let insertAt = remaining.length ? remaining.at(-1).end : 0;
  if (insertAt === 0 && content.charCodeAt(0) === 0xfeff) insertAt = 1;
  const before = content.slice(0, insertAt);
  const after = content.slice(insertAt);
  const prefix = before && !before.endsWith("\n") ? "\n" : "";
  const suffix = after && !after.startsWith("\n") ? "\n" : "";
  return before + prefix + canonicalBlock.trimEnd() + "\n" + suffix + after;
}

function replaceRange(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  const end = start >= 0 ? content.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function replaceRegex(content, regex, replacement, label, alreadyMarker = null) {
  if (alreadyMarker && content.includes(alreadyMarker)) return content;
  regex.lastIndex = 0;
  if (!regex.test(content)) throw new Error(`Patch incompatível: ${label}`);
  regex.lastIndex = 0;
  return content.replace(regex, replacement);
}

function replaceLiteral(content, search, replacement, label, alreadyMarker = replacement) {
  if (alreadyMarker && content.includes(alreadyMarker)) return content;
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}

function patchSnapshotPublic(content) {
  const snapshotStart = content.indexOf("export function getSnapshot");
  if (snapshotStart < 0) throw new Error("Patch incompatível: função getSnapshot");
  const waveOutroStart = content.indexOf("\n    waveOutro: session.waveOutro ? {", snapshotStart);
  const outcomeMarker = waveOutroStart >= 0 ? content.indexOf("\n    outcome:", waveOutroStart) : -1;
  if (waveOutroStart < 0 || outcomeMarker < 0) {
    throw new Error("Patch incompatível: bloco waveOutro em getSnapshot");
  }

  // O snapshot público permanece deliberadamente pequeno. A apresentação cinematográfica
  // usa sessionRef.current.waveOutro diretamente e não participa do caminho crítico de mount.
  const replacement = `
    waveOutro: session.waveOutro ? {
      status: session.waveOutro.status,
      elapsedMs: session.waveOutro.elapsedMs,
      completedWave: session.waveOutro.completedWave,
      finalWave: session.waveOutro.finalWave,
      killed: session.waveOutro.killed,
      survivors: session.waveOutro.survivors,
      integrityPercent: session.waveOutro.integrityPercent,
      energyGained: session.waveOutro.energyGained,
      decisionOptions: (session.waveOutro.decisionOptions || []).map((option) => ({
        id: option.id,
        label: option.label,
      })),
      lastKill: session.waveOutro.lastKill ? {
        row: session.waveOutro.lastKill.row,
        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,
        cinematic: session.waveOutro.lastKill.cinematic,
      } : null,
    } : null,`;

  return content.slice(0, waveOutroStart) + replacement + content.slice(outcomeMarker);
}

function patchBattleModel() {
  const file = "src/game/battleModel.js";
  const source = readText(file);
  let content = source.content;

  content = normalizeModuleImports(
    content,
    [
      "./waveOutro/waveOutroProfiles.js",
      "./waveOutro/waveOutroEffects.js",
    ],
    `import {\n  getWaveOutroPhaseEnds,\n  getWaveOutroProfile,\n  getWaveOutroProfileId,\n  getWaveOutroSlowMotionFactor,\n} from "./waveOutro/waveOutroProfiles.js";\nimport {\n  buildWaveOutroAftermathEvent,\n  buildWaveOutroImpactEvent,\n  inferWaveOutroDamageKind,\n} from "./waveOutro/waveOutroEffects.js";`,
  );

  if (!content.includes("// wave-outro-cinematic-v2 timings")) {
    content = replaceRegex(
      content,
      /export const WAVE_OUTRO_TIMINGS = Object\.freeze\(\{[\s\S]*?\n\}\);\n(?:const WAVE_OUTRO_PHASE_ENDS = Object\.freeze\(\{[\s\S]*?\n\}\);\n)?(?:const MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS = \d+;\n)?/,
      `// wave-outro-cinematic-v2 timings\n// Compatibilidade com consumidores antigos: representa o perfil standard.\nexport const WAVE_OUTRO_TIMINGS = Object.freeze({\n  finalKillSlowMotionMs: 620,\n  cleanupMs: 530,\n  waveCompletedBannerMs: 1800,\n  tacticalAdvantageIntroMs: 1100,\n  totalMs: 4050,\n});\n`,
      "timings do wave outro",
    );
  }

  if (!content.includes("function rememberEnemyKill(session, enemy, context = {})")) {
    content = replaceRegex(
      content,
      /function rememberEnemyKill\(session, enemy,[\s\S]*?\n\}\n\n(?=function clearRasgamarCoil)/,
      `function rememberEnemyKill(session, enemy, context = {}) {\n  const config = ENEMIES[enemy?.type] || {};\n  const normalizedContext = context && typeof context === "object" ? context : { sourceTroopId: context };\n  const sourceTroopId = normalizedContext.sourceTroopId || null;\n  const sourceTroop = sourceTroopId ? indexedTroopById(session, sourceTroopId)\n    || session.troops.find((troop) => troop.id === sourceTroopId) : null;\n  const sourceTroopType = normalizedContext.sourceTroopType || sourceTroop?.type || null;\n  const sourceConfig = TROOPS[sourceTroopType] || {};\n  const deathEntity = getEnemyDeathEntity(enemy, session.elapsed);\n  session.lastEnemyKillCandidate = {\n    enemy: deathEntity,\n    sourceTroopId,\n    sourceTroopType,\n    row: enemy.row,\n    impactX: Number.isFinite(normalizedContext.impactX) ? normalizedContext.impactX : enemy.x,\n    impactY: Number.isFinite(normalizedContext.impactY) ? normalizedContext.impactY : enemy.y,\n    weapon: normalizedContext.weapon || sourceConfig.attack || sourceTroopType,\n    damageKind: inferWaveOutroDamageKind(sourceTroopType, sourceConfig, normalizedContext),\n    eventType: normalizedContext.eventType || (normalizedContext.direct === false ? "projectile" : "direct"),\n    cinematic: Boolean(enemy.variant === "alpha" || config.boss || config.elite),\n    boss: Boolean(config.boss),\n    elite: Boolean(config.elite),\n    alpha: enemy.variant === "alpha",\n  };\n}\n\n`,
      "snapshot do último abate",
    );
  }

  content = content.replaceAll(
    "rememberEnemyKill(session, enemy, context.sourceTroopId || null);",
    "rememberEnemyKill(session, enemy, context);",
  );

  if (!content.includes("const fallbackSourceTroopId = fatalEvent?.sourceTroopId || null;")) {
    content = replaceRegex(
      content,
      /      const eventLastKill = fatalEnemy \? \{[\s\S]*?\n      \} : null;\n(?=      const lastKill = session\.lastEnemyKillCandidate)/,
      `      const fallbackSourceTroopId = fatalEvent?.sourceTroopId || null;\n      const fallbackSourceTroop = fallbackSourceTroopId\n        ? session.troops.find((troop) => troop.id === fallbackSourceTroopId)\n        : null;\n      const fallbackSourceType = fatalEvent?.sourceTroopType || fallbackSourceTroop?.type || null;\n      const eventLastKill = fatalEnemy ? {\n        enemy: { ...fatalEnemy },\n        sourceTroopId: fallbackSourceTroopId,\n        sourceTroopType: fallbackSourceType,\n        row: fatalEnemy.row,\n        impactX: fatalEvent?.x ?? fatalEnemy.x,\n        impactY: fatalEvent?.y ?? fatalEnemy.y,\n        weapon: fatalEvent?.weapon || TROOPS[fallbackSourceType]?.attack || fallbackSourceType,\n        damageKind: inferWaveOutroDamageKind(fallbackSourceType, TROOPS[fallbackSourceType] || {}, fatalEvent || {}),\n        eventType: fatalEvent?.type || "enemyDeath",\n        cinematic: Boolean(fatalEnemy.variant === "alpha" || fatalConfig.boss || fatalConfig.elite),\n        boss: Boolean(fatalConfig.boss),\n        elite: Boolean(fatalConfig.elite),\n        alpha: fatalEnemy.variant === "alpha",\n      } : null;\n`,
      "fallback do último abate",
    );
  }

  if (!content.includes("profileId: getWaveOutroProfileId({ finalWave, lastKill }),")) {
    content = replaceRegex(
      content,
      /(        finalWave,\n)(        killed: Math\.max\(0, session\.killed - session\.waveKillStart\),)/,
      `$1        profileId: getWaveOutroProfileId({ finalWave, lastKill }),\n        playbackRate: 1,\n        focusDispatched: false,\n        impactDispatched: false,\n        aftermathDispatched: false,\n$2`,
      "perfil no início do outro",
    );
  }

  content = patchSnapshotPublic(content);

  content = replaceRange(
    content,
    "export function getWaveOutroCinematicFactor",
    "function restoreTroopsForPlanning",
    `export function getWaveOutroCinematicFactor(session, reduceMotion = false) {\n  return getWaveOutroSlowMotionFactor(session?.waveOutro, reduceMotion);\n}\n\nexport function accelerateWaveOutro(session) {\n  const outro = session?.waveOutro;\n  if (!outro || ["idle", "completed"].includes(outro.status)) return false;\n  const profile = getWaveOutroProfile(outro);\n  if (outro.elapsedMs < profile.skipProtectionMs) return false;\n  outro.playbackRate = Math.max(2, Number(outro.playbackRate) || 1);\n  return true;\n}\n\n`,
    "cinematic factor / accelerate",
  );

  content = replaceRange(
    content,
    "export function advanceWaveOutro",
    "export function getRouteTelemetry",
    `export function advanceWaveOutro(session, realDt = 0) {\n  if (!isWaveOutroActive(session)) return [];\n  const outro = session.waveOutro;\n  const events = [];\n  const dt = Math.max(0, Number(realDt) || 0) * Math.max(1, Number(outro.playbackRate) || 1);\n  outro.elapsedMs += dt;\n  const profile = getWaveOutroProfile(outro);\n  const ends = getWaveOutroPhaseEnds(outro);\n\n  if (!outro.focusDispatched) {\n    outro.focusDispatched = true;\n    events.push({\n      type: outro.finalWave ? "missionFinalFocus" : "waveFinalFocus",\n      wave: outro.completedWave,\n      finalWave: outro.finalWave,\n      x: outro.lastKill?.impactX ?? outro.lastKill?.enemy?.x,\n      y: outro.lastKill?.impactY ?? outro.lastKill?.enemy?.y,\n      damageKind: outro.lastKill?.damageKind || "ballistic",\n      cinematic: Boolean(outro.lastKill?.cinematic),\n    });\n  }\n  if (!outro.impactDispatched && outro.elapsedMs >= profile.impactAtMs) {\n    outro.impactDispatched = true;\n    events.push(buildWaveOutroImpactEvent(outro));\n  }\n  if (!outro.aftermathDispatched && outro.elapsedMs >= profile.aftermathAtMs) {\n    outro.aftermathDispatched = true;\n    events.push(buildWaveOutroAftermathEvent(outro));\n  }\n\n  let transitioned = true;\n  while (transitioned) {\n    transitioned = false;\n    if (outro.status === "finalKill" && outro.elapsedMs >= ends.finalKill) {\n      outro.status = "cleanup";\n      events.push({ type: "waveOutroCleanup", wave: outro.completedWave, finalWave: outro.finalWave });\n      transitioned = true;\n    } else if (outro.status === "cleanup" && outro.elapsedMs >= ends.cleanup) {\n      outro.status = "waveCompleteBanner";\n      events.push({\n        type: "waveCompleteBanner",\n        wave: outro.completedWave,\n        finalWave: outro.finalWave,\n        killed: outro.killed,\n        integrity: outro.integrityPercent,\n        survivors: outro.survivors,\n        energyGained: outro.energyGained,\n      });\n      transitioned = true;\n    } else if (outro.status === "waveCompleteBanner" && outro.elapsedMs >= ends.banner) {\n      outro.status = outro.finalWave ? "victoryIntro" : "decisionIntro";\n      events.push({\n        type: outro.finalWave ? "victoryIntro" : "decisionIntro",\n        wave: outro.completedWave,\n      });\n      transitioned = true;\n    } else if (["decisionIntro", "victoryIntro"].includes(outro.status)\n      && outro.elapsedMs >= ends.decisionIntro) {\n      outro.status = "completed";\n      if (outro.finalWave) {\n        if (!adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) finish(session, "victory");\n      } else {\n        restoreTroopsForPlanning(session);\n        session.pendingDecisionLevel = outro.decisionLevel;\n        session.pendingDecision = outro.decisionOptions;\n        session.preparing = true;\n        events.push({ type: "waveDecisionReady", wave: outro.completedWave });\n      }\n      transitioned = true;\n    }\n  }\n  return events;\n}\n\n`,
    "advanceWaveOutro",
  );

  writeText(file, content, source.eol);
}

function patchGameCanvas() {
  const file = "src/game/GameCanvas.jsx";
  const source = readText(file);
  let content = source.content;
  const report = [];

  const note = (label, status) => report.push(`${status}: ${label}`);

  // Imports: always normalize all waveOutro imports into one canonical block.
  // This repairs original, partially-applied and differently-formatted imports.
  content = normalizeModuleImports(
    content,
    [
      "./waveOutro/waveOutroCamera.js",
      "./waveOutro/waveOutroAudio.js",
      "./waveOutro/waveOutroRenderer.js",
    ],
    `import { getWaveOutroCameraTransform } from "./waveOutro/waveOutroCamera.js";
import {
  getWaveOutroMusicVolume,
  playWaveOutroImpactSound,
  playWaveOutroVictoryStinger,
} from "./waveOutro/waveOutroAudio.js";
import { getWaveOutroOverlayModel } from "./waveOutro/waveOutroRenderer.js";`,
  );
  note("imports waveOutro", "normalizados");

  // Remove the legacy local camera implementation if it still exists.
  if (content.includes("export function getWaveOutroCameraTransform")) {
    const next = content.indexOf("export function WaveOutroOverlay", content.indexOf("export function getWaveOutroCameraTransform"));
    const cameraStart = content.indexOf("export function getWaveOutroCameraTransform");
    if (cameraStart >= 0 && next > cameraStart) {
      content = content.slice(0, cameraStart) + "export { getWaveOutroCameraTransform };\n\n" + content.slice(next);
      note("extração da câmera", "aplicado");
    } else {
      throw new Error("Patch incompatível: limites da câmera do wave outro");
    }
  } else if (!content.includes("export { getWaveOutroCameraTransform };")) {
    const overlayStart = content.indexOf("export function WaveOutroOverlay");
    if (overlayStart >= 0) {
      content = content.slice(0, overlayStart) + "export { getWaveOutroCameraTransform };\n\n" + content.slice(overlayStart);
      note("reexport da câmera", "aplicado");
    }
  } else note("extração da câmera", "já presente");

  // Replace the overlay implementation by structural boundaries, regardless of its current props.
  const overlayStart = content.indexOf("export function WaveOutroOverlay");
  const overlayEnd = overlayStart >= 0 ? content.indexOf("export function resolveInspectedTroopId", overlayStart) : -1;
  if (overlayStart >= 0 && overlayEnd > overlayStart) {
    const currentOverlay = content.slice(overlayStart, overlayEnd);
    if (!currentOverlay.includes("WAVE_OUTRO_RENDERABLE_STATUSES")) {
      const replacement = `const WAVE_OUTRO_RENDERABLE_STATUSES = new Set([
  "finalKill",
  "cleanup",
  "waveCompleteBanner",
  "decisionIntro",
  "victoryIntro",
]);

export function WaveOutroOverlay({ outro, phase, reduceMotion = false }) {
  // Não executa nenhuma lógica cinematográfica durante a montagem normal da batalha.
  if (!outro || !WAVE_OUTRO_RENDERABLE_STATUSES.has(outro.status)) return null;

  let model = null;
  try {
    model = getWaveOutroOverlayModel(outro, phase);
  } catch {
    // A apresentação nunca deve derrubar o componente principal da batalha.
    return null;
  }
  if (!model) return null;

  const canAccelerate = (Number(outro.elapsedMs) || 0) >= (outro.finalWave ? 1500 : 600);
  const decisionCards = outro.status === "decisionIntro" && Array.isArray(outro.decisionOptions)
    ? outro.decisionOptions
    : [];
  const overlayStyle = model.style && typeof model.style === "object" ? model.style : undefined;

  return (
    <div className={\`wave-outro \${model.className || ""} \${reduceMotion ? "reduce-motion" : ""}\`} style={overlayStyle} aria-live="polite">
      {model.showLetterbox && <div className="wave-outro-letterbox" aria-hidden="true"><i /><i /></div>}
      {model.showImpact && <div className="wave-outro-impact-fx" aria-hidden="true">
        <i className="wave-outro-impact-flash" />
        <i className="wave-outro-shockwave" />
        <i className="wave-outro-impact-core" />
      </div>}
      {outro.status === "finalKill"
        ? model.title && <small className="wave-outro-last-target">{model.title}</small>
        : model.title && <b>{model.title}</b>}
      {model.subtitle && <span>{model.subtitle}</span>}
      {model.detail && <small>{model.detail}</small>}
      {decisionCards.length > 0 && <div className="wave-outro-card-preview" aria-hidden="true">
        {decisionCards.map((option) => <div key={option.id}>{option.label || ""}</div>)}
      </div>}
      {canAccelerate && ["finalKill", "cleanup", "waveCompleteBanner"].includes(outro.status)
        && <em className="wave-outro-continue">CLIQUE PARA ACELERAR</em>}
    </div>
  );
}

`;
      content = content.slice(0, overlayStart) + replacement + content.slice(overlayEnd);
      note("WaveOutroOverlay", "aplicado");
    } else note("WaveOutroOverlay", "já presente");
  } else {
    throw new Error("Patch incompatível: função WaveOutroOverlay não localizada");
  }

  // Advance outro: normalize by statement boundaries, independent of indentation/line wrapping.
  if (!content.includes("frameDelta * (settings.reduceMotion ? 1.35 : 1)")) {
    const advanceToken = "const outroEvents = advanceWaveOutro(";
    const advanceStart = content.indexOf(advanceToken);
    const advanceEnd = advanceStart >= 0 ? content.indexOf(");", advanceStart + advanceToken.length) : -1;
    if (advanceStart < 0 || advanceEnd < 0) throw new Error("Patch incompatível: chamada advanceWaveOutro");
    const lineStart = content.lastIndexOf("\n", advanceStart) + 1;
    const indent = content.slice(lineStart, advanceStart).match(/^\s*/)?.[0] || "";
    const statement = content.slice(advanceStart, advanceEnd + 2);
    if (!statement.includes("sessionRef.current")) throw new Error("Patch incompatível: argumentos de advanceWaveOutro");
    const replacement = `const outroEvents = advanceWaveOutro(\n${indent}  sessionRef.current,\n${indent}  frameDelta * (settings.reduceMotion ? 1.35 : 1),\n${indent});`;
    content = content.slice(0, advanceStart) + replacement + content.slice(advanceEnd + 2);
    note("advanceWaveOutro", "normalizado");
  } else note("advanceWaveOutro", "já presente");

  // Event integration: structural replacement only if the cinematic handler is absent.
  if (!content.includes('const finalImpact = outroEvents.find((event) => ["waveFinalImpact", "missionFinalImpact"].includes(event.type));')) {
    const eventStart = content.indexOf("      if (outroEvents.length) {");
    const activeSessionMarker = eventStart >= 0 ? content.indexOf("      const activeSession = sessionRef.current;", eventStart) : -1;
    if (eventStart < 0 || activeSessionMarker < 0) throw new Error("Patch incompatível: eventos de wave outro no loop");
    const replacement = `      if (outroEvents.length) {\n        pushEventParticles(particlesRef.current, outroEvents, sessionRef.current.elapsed, adaptiveSettingsRef.current);\n        consumeGraphicsEvents(graphicsRef.current, outroEvents, sessionRef.current.elapsed, settings);\n        const finalImpact = outroEvents.find((event) => ["waveFinalImpact", "missionFinalImpact"].includes(event.type));\n        if (finalImpact) {\n          if (!settings.reduceMotion) {\n            graphicsRef.current.cinematicFreezeUntil = performance.now() + Math.max(0, finalImpact.freezeMs || 0);\n          }\n          playWaveOutroImpactSound(finalImpact, settings);\n        }\n        if (outroEvents.some((event) => event.type === "waveCompleteBanner")) {\n          audioRef.current.theme?.pause();\n          setBanner(sessionRef.current.waveOutro.finalWave\n            ? "PERÍMETRO ASSEGURADO"\n            : \`ONDA \${sessionRef.current.waveOutro.completedWave} CONCLUÍDA\`);\n          play("alert", 0.38);\n        }\n        if (outroEvents.some((event) => event.type === "decisionIntro")) {\n          setBanner("NOVA VANTAGEM TÁTICA");\n        }\n        if (outroEvents.some((event) => event.type === "victoryIntro")) {\n          setBanner("MISSÃO CONCLUÍDA");\n          playWaveOutroVictoryStinger(settings);\n        }\n      }\n`;
    content = content.slice(0, eventStart) + replacement + content.slice(activeSessionMarker);
    note("eventos cinematográficos", "aplicado");
  } else note("eventos cinematográficos", "já presente");

  // Audio ducking: do not require exact whitespace or previous cleanup formula.
  if (!content.includes("themeAudio.volume = getWaveOutroMusicVolume(activeSession.waveOutro, baseMusicVolume);")) {
    const themeStart = content.indexOf("      const themeAudio = audioRef.current.theme;");
    const alarmStart = themeStart >= 0 ? content.indexOf("      if (activeSession && !activeOutro", themeStart) : -1;
    if (themeStart >= 0 && alarmStart > themeStart) {
      const replacement = `      const themeAudio = audioRef.current.theme;\n      if (themeAudio && activeOutro) {\n        const baseMusicVolume = settings.masterVolume * settings.musicVolume;\n        themeAudio.volume = getWaveOutroMusicVolume(activeSession.waveOutro, baseMusicVolume);\n      }\n`;
      content = content.slice(0, themeStart) + replacement + content.slice(alarmStart);
      note("ducking de áudio", "aplicado");
    } else throw new Error("Patch incompatível: bloco de áudio do GameCanvas");
  } else note("ducking de áudio", "já presente");

  // Visual-only hit stop: tolerate formatting changes around presentScene.
  if (!content.includes("const cinematicFrozen = !settings.reduceMotion")) {
    const presentRegex = /      presentScene\(\s*ctx\s*,\s*renderLayers\s*,\s*null\s*,\s*renderScale\s*,\s*presentationCamera\s*,\s*adaptiveSettingsRef\.current\s*,\s*adaptive\s*,?\s*\);/m;
    if (presentRegex.test(content)) {
      content = content.replace(
        presentRegex,
        `      const cinematicFrozen = !settings.reduceMotion\n        && performance.now() < (graphicsRef.current.cinematicFreezeUntil || 0);\n      if (!cinematicFrozen) {\n        presentScene(\n          ctx, renderLayers, null, renderScale,\n          presentationCamera,\n          adaptiveSettingsRef.current, adaptive,\n        );\n      }`,
      );
      note("hit stop visual", "aplicado");
    } else {
      // If another renderer wrapper already replaced presentScene, don't hard-fail if cinematic freeze is referenced.
      if (!content.includes("cinematicFreezeUntil")) throw new Error("Patch incompatível: presentScene para hit stop visual");
      note("hit stop visual customizado", "preservado");
    }
  } else note("hit stop visual", "já presente");

  // Props integration: rewrite ANY self-closing WaveOutroOverlay that renders snapshot.waveOutro,
  // regardless of existing props/order/line wrapping from previous partial patches.
  const desiredOverlayTag = '<WaveOutroOverlay outro={sessionRef.current?.waveOutro} phase={phase} reduceMotion={settings.reduceMotion} />';
  if (!content.includes(desiredOverlayTag)) {
    const broadTag = /<WaveOutroOverlay\b(?=[^>]*outro=\{(?:snapshot\.waveOutro|sessionRef\.current\?\.waveOutro)\})[^>]*\/>/m;
    if (broadTag.test(content)) {
      content = content.replace(broadTag, desiredOverlayTag);
      note("props do WaveOutroOverlay", "ajustado por fallback");
    } else {
      // A non-self-closing variant is also accepted and normalized.
      const pairedTag = /<WaveOutroOverlay\b(?=[^>]*outro=\{(?:snapshot\.waveOutro|sessionRef\.current\?\.waveOutro)\})[^>]*>\s*<\/WaveOutroOverlay>/m;
      if (pairedTag.test(content)) {
        content = content.replace(pairedTag, desiredOverlayTag);
        note("props do WaveOutroOverlay", "ajustado por fallback");
      } else {
        throw new Error("Patch incompatível: uso do WaveOutroOverlay não localizado");
      }
    }
  } else note("props do WaveOutroOverlay", "já presente");

  writeText(file, content, source.eol);
  for (const line of report) console.log(`[GameCanvas] ${line}`);
}

function patchGraphicsRuntime() {
  const file = "src/game/graphicsRuntime.js";
  const source = readText(file);
  let content = source.content;

  if (!content.includes("cinematicFreezeUntil: 0,")) {
    content = replaceRegex(
      content,
      /(    camera: \{ amplitude: 0, seed: 1, startedAt: 0 \},\n)(    health: new Map\(\),)/,
      `$1    cinematicFreezeUntil: 0,\n$2`,
      "cinematicFreezeUntil",
    );
  }

  if (!content.includes("waveFinalImpact: { radius: event.lightRadius")) {
    content = replaceRegex(
      content,
      /(    pulseCharging: \{ radius: 96, life: 420 \}, pulseFired: \{ radius: 210, life: 420 \},)/,
      `$1\n    waveFinalImpact: { radius: event.lightRadius || 150, life: 460 },\n    missionFinalImpact: { radius: event.lightRadius || 240, life: 760 },`,
      "luzes de impacto final",
    );
  }

  if (!content.includes('["waveFinalImpact", "missionFinalImpact"].includes(event.type)')) {
    content = replaceRegex(
      content,
      /(    if \(\(event\.type === "enemyDeath" \|\| event\.type === "bossDeath"\) && event\.entity\) \{[\s\S]*?\n    \}\n)(?=    if \(event\.type === "enemyDisintegrated")/,
      `$1    if (["waveFinalImpact", "missionFinalImpact"].includes(event.type)) {\n      const death = [...runtime.deaths].reverse().find((entry) => (\n        entry.kind === "enemy" && (!event.enemyId || entry.entity?.id === event.enemyId)\n      ));\n      if (death) death.life = Math.max(death.life, Number(event.deathLingerMs) || death.life);\n    }\n`,
      "death linger do último inimigo",
    );
  }

  writeText(file, content, source.eol);
}

function patchStyles() {
  const file = "src/styles.css";
  const source = readText(file);
  let content = source.content;
  if (content.includes("/* wave-outro-cinematic-v2 */")) return;
  content += `\n\n/* wave-outro-cinematic-v2 */\n.wave-outro.cinematic-shell {\n  background: transparent;\n  overflow: hidden;\n}\n.wave-outro.cinematic-shell::before { display: none; }\n.profile-missionFinale.cinematic-shell::after, .profile-bossFinale.cinematic-shell::after {\n  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0;\n  background: rgba(255,255,255,.15); animation: wave-mission-global-flash .18s ease-out var(--outro-impact-delay) 1 both;\n}\n.wave-outro-impact-fx { position: absolute; inset: 0; pointer-events: none; z-index: 0; }\n.wave-outro-impact-fx > i {\n  position: absolute; left: var(--outro-impact-x); top: var(--outro-impact-y);\n  translate: -50% -50%; border-radius: 50%; opacity: 0;\n  animation-delay: var(--outro-impact-delay); animation-fill-mode: both;\n}\n.wave-outro-impact-flash {\n  width: 150px; height: 150px;\n  background: radial-gradient(circle, color-mix(in srgb, var(--outro-accent) 86%, white) 0 7%, color-mix(in srgb, var(--outro-primary) 58%, transparent) 28%, transparent 72%);\n  filter: blur(1px); animation: wave-final-flash .34s ease-out 1;\n}\n.wave-outro-shockwave {\n  width: 24px; height: 24px; border: 2px solid color-mix(in srgb, var(--outro-accent) 82%, white);\n  box-shadow: 0 0 20px color-mix(in srgb, var(--outro-primary) 72%, transparent), inset 0 0 12px color-mix(in srgb, var(--outro-primary) 55%, transparent);\n  animation: wave-final-shockwave .52s cubic-bezier(.1,.72,.2,1) 1;\n}\n.profile-missionFinale .wave-outro-shockwave, .profile-bossFinale .wave-outro-shockwave { animation-duration: .68s; }\n.profile-missionFinale .wave-outro-impact-flash, .profile-bossFinale .wave-outro-impact-flash { animation-duration: .42s; }\n.wave-outro-impact-core {\n  width: 22px; height: 22px; background: #fff; box-shadow: 0 0 22px 9px var(--outro-accent);\n  animation: wave-final-core .22s ease-out 1;\n}\n.damage-electric .wave-outro-impact-core { box-shadow: 0 0 18px 10px #93c5fd, 0 0 34px 15px #2563eb; }\n.damage-explosive .wave-outro-impact-core { box-shadow: 0 0 18px 11px #fde68a, 0 0 38px 18px #f97316; }\n.damage-ice .wave-outro-impact-core { box-shadow: 0 0 18px 10px #cffafe, 0 0 34px 16px #22d3ee; }\n.damage-energy .wave-outro-impact-core { box-shadow: 0 0 18px 10px #e9d5ff, 0 0 34px 16px #8b5cf6; }\n.damage-melee .wave-outro-impact-core { border-radius: 18% 82% 18% 82%; transform: rotate(-35deg) scaleX(1.8); }\n.wave-outro-letterbox { position: absolute; inset: 0; z-index: 3; pointer-events: none; }\n.wave-outro-letterbox i {\n  position: absolute; left: 0; right: 0; height: 7%; background: rgba(0,0,0,.94);\n  animation: wave-letterbox-in .25s ease-out both;\n}\n.wave-outro-letterbox i:first-child { top: 0; transform-origin: top; }\n.wave-outro-letterbox i:last-child { bottom: 0; transform-origin: bottom; }\n.wave-outro.victory-intro .wave-outro-letterbox i { animation: wave-letterbox-out .5s ease-in both; }\n.wave-outro-last-target {\n  position: relative; z-index: 4; margin-bottom: 11%; color: #fde68a !important;\n  font: 700 clamp(8px, 1.25cqi, 12px) "Chakra Petch", system-ui !important; letter-spacing: .22em !important;\n  text-shadow: 0 0 14px rgba(251,191,36,.86);\n}\n.wave-outro.mission-secured {\n  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--outro-primary) 9%, transparent), rgba(2,8,15,.72));\n}\n.wave-outro.mission-secured b, .wave-outro.profile-missionFinale.victory-intro b, .wave-outro.profile-bossFinale.victory-intro b {\n  color: color-mix(in srgb, var(--outro-accent) 72%, white);\n  text-shadow: 0 0 26px color-mix(in srgb, var(--outro-primary) 70%, transparent);\n}\n.wave-outro-continue {\n  position: absolute; z-index: 5; bottom: 9%; left: 50%; translate: -50% 0;\n  color: rgba(226,232,240,.62); font: 600 clamp(7px, .9cqi, 10px) "Chakra Petch", system-ui;\n  letter-spacing: .12em; font-style: normal; animation: wave-continue-pulse 1.2s ease-in-out infinite;\n}\n.reduce-motion .wave-outro-impact-fx, .reduce-motion .wave-outro-letterbox { display: none; }\n.reduce-motion.profile-missionFinale.cinematic-shell::after, .reduce-motion.profile-bossFinale.cinematic-shell::after { display: none; }\n.reduce-motion.wave-outro.cinematic-shell { background: rgba(2,8,15,.16); }\n@keyframes wave-mission-global-flash { 0%, 40% { opacity: 0; } 48% { opacity: .42; } 100% { opacity: 0; } }\n@keyframes wave-final-flash { 0%, 35% { opacity: 0; scale: .35; } 45% { opacity: .94; scale: .72; } 100% { opacity: 0; scale: 1.45; } }\n@keyframes wave-final-shockwave { 0%, 38% { opacity: 0; width: 24px; height: 24px; } 44% { opacity: .92; } 100% { opacity: 0; width: calc(var(--outro-shockwave-radius) * 2); height: calc(var(--outro-shockwave-radius) * 2); } }\n@keyframes wave-final-core { 0%, 42% { opacity: 0; scale: .45; } 48% { opacity: 1; scale: 1.25; } 100% { opacity: 0; scale: 2.2; } }\n@keyframes wave-letterbox-in { from { scale: 1 0; } to { scale: 1 1; } }\n@keyframes wave-letterbox-out { from { scale: 1 1; } to { scale: 1 0; } }\n@keyframes wave-continue-pulse { 0%, 100% { opacity: .38; } 50% { opacity: .85; } }\n`;
  writeText(file, content, source.eol);
}

try {
  patchBattleModel();
  patchGameCanvas();
  patchGraphicsRuntime();
  patchStyles();
  console.log("Patch cinematográfico de final de onda v2.0.4 aplicado. Nenhum rollback automático foi executado.");
} catch (error) {
  console.error(error?.stack || error);
  console.error("IMPORTANTE: o instalador não restaurou arquivos automaticamente.");
  process.exitCode = 1;
}
