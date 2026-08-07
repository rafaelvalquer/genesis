#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content, "utf8");

function replaceOnce(content, search, replacement, label) {
  if (content.includes(replacement)) return content;
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}

function replaceBetween(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Patch incompatível: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function ensureImport(content, marker, addition) {
  if (content.includes(addition.trim())) return content;
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`Não foi possível inserir import antes de ${marker}`);
  return content.slice(0, index) + addition + content.slice(index);
}

function patchBattleModel() {
  let content = read("src/game/battleModel.js");

  content = ensureImport(
    content,
    'import { compactActive } from "./battleCollections.js";',
    `import {\n  getWaveOutroPhaseEnds,\n  getWaveOutroProfile,\n  getWaveOutroProfileId,\n  getWaveOutroSlowMotionFactor,\n} from "./waveOutro/waveOutroProfiles.js";\nimport {\n  buildWaveOutroAftermathEvent,\n  buildWaveOutroImpactEvent,\n  inferWaveOutroDamageKind,\n} from "./waveOutro/waveOutroEffects.js";\n`,
  );

  const oldTimingBlock = `export const WAVE_OUTRO_TIMINGS = Object.freeze({\n  finalKillSlowMotionMs: 600,\n  cleanupMs: 400,\n  waveCompletedBannerMs: 2000,\n  tacticalAdvantageIntroMs: 1100,\n  totalMs: 4100,\n});\nconst WAVE_OUTRO_PHASE_ENDS = Object.freeze({\n  finalKill: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs,\n  cleanup: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs + WAVE_OUTRO_TIMINGS.cleanupMs,\n  banner: WAVE_OUTRO_TIMINGS.totalMs - WAVE_OUTRO_TIMINGS.tacticalAdvantageIntroMs,\n  decisionIntro: WAVE_OUTRO_TIMINGS.totalMs,\n});\nconst MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS = 1000;`;
  const newTimingBlock = `// Compatibilidade com consumidores antigos: representa o perfil standard.\nexport const WAVE_OUTRO_TIMINGS = Object.freeze({\n  finalKillSlowMotionMs: 620,\n  cleanupMs: 530,\n  waveCompletedBannerMs: 1800,\n  tacticalAdvantageIntroMs: 1100,\n  totalMs: 4050,\n});`;
  content = replaceOnce(content, oldTimingBlock, newTimingBlock, "timings do wave outro");

  const oldRemember = `function rememberEnemyKill(session, enemy, sourceTroopId = null) {\n  const config = ENEMIES[enemy?.type] || {};\n  session.lastEnemyKillCandidate = {\n    enemy: getEnemyDeathEntity(enemy, session.elapsed),\n    sourceTroopId,\n    row: enemy.row,\n    cinematic: Boolean(enemy.variant === "alpha" || config.boss || config.elite),\n  };\n}`;
  const newRemember = `function rememberEnemyKill(session, enemy, context = {}) {\n  const config = ENEMIES[enemy?.type] || {};\n  const normalizedContext = context && typeof context === "object" ? context : { sourceTroopId: context };\n  const sourceTroopId = normalizedContext.sourceTroopId || null;\n  const sourceTroop = sourceTroopId ? indexedTroopById(session, sourceTroopId)\n    || session.troops.find((troop) => troop.id === sourceTroopId) : null;\n  const sourceTroopType = normalizedContext.sourceTroopType || sourceTroop?.type || null;\n  const sourceConfig = TROOPS[sourceTroopType] || {};\n  const deathEntity = getEnemyDeathEntity(enemy, session.elapsed);\n  session.lastEnemyKillCandidate = {\n    enemy: deathEntity,\n    sourceTroopId,\n    sourceTroopType,\n    row: enemy.row,\n    impactX: Number.isFinite(normalizedContext.impactX) ? normalizedContext.impactX : enemy.x,\n    impactY: Number.isFinite(normalizedContext.impactY) ? normalizedContext.impactY : enemy.y,\n    weapon: normalizedContext.weapon || sourceConfig.attack || sourceTroopType,\n    damageKind: inferWaveOutroDamageKind(sourceTroopType, sourceConfig, normalizedContext),\n    eventType: normalizedContext.eventType || (normalizedContext.direct === false ? "projectile" : "direct"),\n    cinematic: Boolean(enemy.variant === "alpha" || config.boss || config.elite),\n    boss: Boolean(config.boss),\n    elite: Boolean(config.elite),\n    alpha: enemy.variant === "alpha",\n  };\n}`;
  content = replaceOnce(content, oldRemember, newRemember, "snapshot do último abate");
  content = content.replaceAll(
    "rememberEnemyKill(session, enemy, context.sourceTroopId || null);",
    "rememberEnemyKill(session, enemy, context);",
  );

  const oldEventLastKill = `      const eventLastKill = fatalEnemy ? {\n        enemy: { ...fatalEnemy },\n        sourceTroopId: fatalEvent.sourceTroopId || null,\n        row: fatalEnemy.row,\n        cinematic: Boolean(fatalEnemy.variant === "alpha" || fatalConfig.boss || fatalConfig.elite),\n      } : null;`;
  const newEventLastKill = `      const fallbackSourceTroopId = fatalEvent?.sourceTroopId || null;\n      const fallbackSourceTroop = fallbackSourceTroopId\n        ? session.troops.find((troop) => troop.id === fallbackSourceTroopId)\n        : null;\n      const fallbackSourceType = fatalEvent?.sourceTroopType || fallbackSourceTroop?.type || null;\n      const eventLastKill = fatalEnemy ? {\n        enemy: { ...fatalEnemy },\n        sourceTroopId: fallbackSourceTroopId,\n        sourceTroopType: fallbackSourceType,\n        row: fatalEnemy.row,\n        impactX: fatalEvent?.x ?? fatalEnemy.x,\n        impactY: fatalEvent?.y ?? fatalEnemy.y,\n        weapon: fatalEvent?.weapon || TROOPS[fallbackSourceType]?.attack || fallbackSourceType,\n        damageKind: inferWaveOutroDamageKind(fallbackSourceType, TROOPS[fallbackSourceType] || {}, fatalEvent || {}),\n        eventType: fatalEvent?.type || "enemyDeath",\n        cinematic: Boolean(fatalEnemy.variant === "alpha" || fatalConfig.boss || fatalConfig.elite),\n        boss: Boolean(fatalConfig.boss),\n        elite: Boolean(fatalConfig.elite),\n        alpha: fatalEnemy.variant === "alpha",\n      } : null;`;
  content = replaceOnce(content, oldEventLastKill, newEventLastKill, "fallback do último abate");

  const oldOutroAssignment = `        finalWave,\n        killed: Math.max(0, session.killed - session.waveKillStart),`;
  const newOutroAssignment = `        finalWave,\n        profileId: getWaveOutroProfileId({ finalWave, lastKill }),\n        playbackRate: 1,\n        focusDispatched: false,\n        impactDispatched: false,\n        aftermathDispatched: false,\n        killed: Math.max(0, session.killed - session.waveKillStart),`;
  content = replaceOnce(content, oldOutroAssignment, newOutroAssignment, "perfil no início do outro");

  const oldSnapshotKill = `      lastKill: session.waveOutro.lastKill ? {\n        row: session.waveOutro.lastKill.row,\n        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,\n        cinematic: session.waveOutro.lastKill.cinematic,\n      } : null,`;
  const newSnapshotKill = `      profileId: session.waveOutro.profileId || getWaveOutroProfileId(session.waveOutro),\n      playbackRate: session.waveOutro.playbackRate || 1,\n      lastKill: session.waveOutro.lastKill ? {\n        enemy: session.waveOutro.lastKill.enemy ? {\n          id: session.waveOutro.lastKill.enemy.id,\n          type: session.waveOutro.lastKill.enemy.type,\n          x: session.waveOutro.lastKill.enemy.x,\n          y: session.waveOutro.lastKill.enemy.y,\n        } : null,\n        row: session.waveOutro.lastKill.row,\n        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,\n        sourceTroopType: session.waveOutro.lastKill.sourceTroopType,\n        impactX: session.waveOutro.lastKill.impactX,\n        impactY: session.waveOutro.lastKill.impactY,\n        weapon: session.waveOutro.lastKill.weapon,\n        damageKind: session.waveOutro.lastKill.damageKind,\n        eventType: session.waveOutro.lastKill.eventType,\n        cinematic: session.waveOutro.lastKill.cinematic,\n        boss: session.waveOutro.lastKill.boss,\n        elite: session.waveOutro.lastKill.elite,\n        alpha: session.waveOutro.lastKill.alpha,\n      } : null,`;
  content = replaceOnce(content, oldSnapshotKill, newSnapshotKill, "snapshot público do último abate");

  content = replaceBetween(
    content,
    "export function getWaveOutroCinematicFactor",
    "function restoreTroopsForPlanning",
    `export function getWaveOutroCinematicFactor(session, reduceMotion = false) {\n  return getWaveOutroSlowMotionFactor(session?.waveOutro, reduceMotion);\n}\n\nexport function accelerateWaveOutro(session) {\n  const outro = session?.waveOutro;\n  if (!outro || ["idle", "completed"].includes(outro.status)) return false;\n  const profile = getWaveOutroProfile(outro);\n  if (outro.elapsedMs < profile.skipProtectionMs) return false;\n  outro.playbackRate = Math.max(2, Number(outro.playbackRate) || 1);\n  return true;\n}\n\n`,
    "cinematic factor / accelerate",
  );

  content = replaceBetween(
    content,
    "export function advanceWaveOutro",
    "export function getRouteTelemetry",
    `export function advanceWaveOutro(session, realDt = 0) {\n  if (!isWaveOutroActive(session)) return [];\n  const outro = session.waveOutro;\n  const events = [];\n  const dt = Math.max(0, Number(realDt) || 0) * Math.max(1, Number(outro.playbackRate) || 1);\n  outro.elapsedMs += dt;\n  const profile = getWaveOutroProfile(outro);\n  const ends = getWaveOutroPhaseEnds(outro);\n\n  if (!outro.focusDispatched) {\n    outro.focusDispatched = true;\n    events.push({\n      type: outro.finalWave ? "missionFinalFocus" : "waveFinalFocus",\n      wave: outro.completedWave,\n      finalWave: outro.finalWave,\n      x: outro.lastKill?.impactX ?? outro.lastKill?.enemy?.x,\n      y: outro.lastKill?.impactY ?? outro.lastKill?.enemy?.y,\n      damageKind: outro.lastKill?.damageKind || "ballistic",\n      cinematic: Boolean(outro.lastKill?.cinematic),\n    });\n  }\n  if (!outro.impactDispatched && outro.elapsedMs >= profile.impactAtMs) {\n    outro.impactDispatched = true;\n    events.push(buildWaveOutroImpactEvent(outro));\n  }\n  if (!outro.aftermathDispatched && outro.elapsedMs >= profile.aftermathAtMs) {\n    outro.aftermathDispatched = true;\n    events.push(buildWaveOutroAftermathEvent(outro));\n  }\n\n  let transitioned = true;\n  while (transitioned) {\n    transitioned = false;\n    if (outro.status === "finalKill" && outro.elapsedMs >= ends.finalKill) {\n      outro.status = "cleanup";\n      events.push({ type: "waveOutroCleanup", wave: outro.completedWave, finalWave: outro.finalWave });\n      transitioned = true;\n    } else if (outro.status === "cleanup" && outro.elapsedMs >= ends.cleanup) {\n      outro.status = "waveCompleteBanner";\n      events.push({\n        type: "waveCompleteBanner",\n        wave: outro.completedWave,\n        finalWave: outro.finalWave,\n        killed: outro.killed,\n        integrity: outro.integrityPercent,\n        survivors: outro.survivors,\n        energyGained: outro.energyGained,\n      });\n      transitioned = true;\n    } else if (outro.status === "waveCompleteBanner" && outro.elapsedMs >= ends.banner) {\n      outro.status = outro.finalWave ? "victoryIntro" : "decisionIntro";\n      events.push({\n        type: outro.finalWave ? "victoryIntro" : "decisionIntro",\n        wave: outro.completedWave,\n      });\n      transitioned = true;\n    } else if (["decisionIntro", "victoryIntro"].includes(outro.status)\n      && outro.elapsedMs >= ends.decisionIntro) {\n      outro.status = "completed";\n      if (outro.finalWave) {\n        if (!adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) finish(session, "victory");\n      } else {\n        restoreTroopsForPlanning(session);\n        session.pendingDecisionLevel = outro.decisionLevel;\n        session.pendingDecision = outro.decisionOptions;\n        session.preparing = true;\n        events.push({ type: "waveDecisionReady", wave: outro.completedWave });\n      }\n      transitioned = true;\n    }\n  }\n  return events;\n}\n\n`,
    "advanceWaveOutro",
  );

  write("src/game/battleModel.js", content);
}

function patchGameCanvas() {
  let content = read("src/game/GameCanvas.jsx");

  content = ensureImport(
    content,
    'import { installNonPassiveContextMenuGuard } from "./hooks/battleCanvasEvents.js";',
    `import { getWaveOutroCameraTransform } from "./waveOutro/waveOutroCamera.js";\nimport {\n  getWaveOutroMusicVolume,\n  playWaveOutroImpactSound,\n  playWaveOutroVictoryStinger,\n} from "./waveOutro/waveOutroAudio.js";\nimport { getWaveOutroOverlayModel } from "./waveOutro/waveOutroRenderer.js";\n`,
  );

  content = replaceBetween(
    content,
    "export function getWaveOutroCameraTransform",
    "export function WaveOutroOverlay",
    `export { getWaveOutroCameraTransform };\n\n`,
    "extração da câmera do wave outro",
  );

  content = replaceBetween(
    content,
    "export function WaveOutroOverlay",
    "export function resolveInspectedTroopId",
    `export function WaveOutroOverlay({ outro, phase, reduceMotion = false }) {\n  const model = getWaveOutroOverlayModel(outro, phase);\n  if (!model) return null;\n  const canAccelerate = (outro?.elapsedMs || 0) >= (outro?.finalWave ? 1500 : 600);\n  const decisionCards = outro?.status === "decisionIntro" ? (outro.decisionOptions || []) : [];\n  return (\n    <div className={\`wave-outro \${model.className} \${reduceMotion ? "reduce-motion" : ""}\`} style={model.style} aria-live="polite">\n      {model.showLetterbox && <div className="wave-outro-letterbox" aria-hidden="true"><i /><i /></div>}\n      {model.showImpact && <div className="wave-outro-impact-fx" aria-hidden="true">\n        <i className="wave-outro-impact-flash" />\n        <i className="wave-outro-shockwave" />\n        <i className="wave-outro-impact-core" />\n      </div>}\n      {outro?.status === "finalKill"\n        ? model.title && <small className="wave-outro-last-target">{model.title}</small>\n        : model.title && <b>{model.title}</b>}\n      {model.subtitle && <span>{model.subtitle}</span>}\n      {model.detail && <small>{model.detail}</small>}\n      {decisionCards.length > 0 && <div className="wave-outro-card-preview" aria-hidden="true">\n        {decisionCards.map((option) => <div key={option.id}>{option.label || ""}</div>)}\n      </div>}\n      {canAccelerate && ["finalKill", "cleanup", "waveCompleteBanner"].includes(outro?.status)\n        && <em className="wave-outro-continue">CLIQUE PARA ACELERAR</em>}\n    </div>\n  );\n}\n\n`,
    "WaveOutroOverlay",
  );

  const oldOutroEventBlock = `      if (outroEvents.length) {\n        pushEventParticles(particlesRef.current, outroEvents, sessionRef.current.elapsed, adaptiveSettingsRef.current);\n        consumeGraphicsEvents(graphicsRef.current, outroEvents, sessionRef.current.elapsed, settings);\n        if (outroEvents.some((event) => event.type === "waveCompleteBanner")) {\n          audioRef.current.theme?.pause();\n          setBanner(\`ONDA \${sessionRef.current.waveOutro.completedWave} CONCLUÍDA\`);\n          play("alert", 0.38);\n        }\n        if (outroEvents.some((event) => event.type === "decisionIntro")) {\n          setBanner("NOVA VANTAGEM TÁTICA");\n        }\n        if (outroEvents.some((event) => event.type === "victoryIntro")) {\n          setBanner("MISSÃO CONCLUÍDA");\n        }\n      }`;
  const newOutroEventBlock = `      if (outroEvents.length) {\n        pushEventParticles(particlesRef.current, outroEvents, sessionRef.current.elapsed, adaptiveSettingsRef.current);\n        consumeGraphicsEvents(graphicsRef.current, outroEvents, sessionRef.current.elapsed, settings);\n        const finalImpact = outroEvents.find((event) => ["waveFinalImpact", "missionFinalImpact"].includes(event.type));\n        if (finalImpact) {\n          if (!settings.reduceMotion) {\n            graphicsRef.current.cinematicFreezeUntil = performance.now() + Math.max(0, finalImpact.freezeMs || 0);\n          }\n          playWaveOutroImpactSound(finalImpact, settings);\n        }\n        if (outroEvents.some((event) => event.type === "waveCompleteBanner")) {\n          audioRef.current.theme?.pause();\n          setBanner(sessionRef.current.waveOutro.finalWave\n            ? "PERÍMETRO ASSEGURADO"\n            : \`ONDA \${sessionRef.current.waveOutro.completedWave} CONCLUÍDA\`);\n          play("alert", 0.38);\n        }\n        if (outroEvents.some((event) => event.type === "decisionIntro")) {\n          setBanner("NOVA VANTAGEM TÁTICA");\n        }\n        if (outroEvents.some((event) => event.type === "victoryIntro")) {\n          setBanner("MISSÃO CONCLUÍDA");\n          playWaveOutroVictoryStinger(settings);\n        }\n      }`;
  content = replaceOnce(content, oldOutroEventBlock, newOutroEventBlock, "eventos cinematográficos no loop");

  content = replaceOnce(
    content,
    "      const outroEvents = advanceWaveOutro(sessionRef.current, frameDelta);",
    `      const outroEvents = advanceWaveOutro(\n        sessionRef.current,\n        frameDelta * (settings.reduceMotion ? 1.35 : 1),\n      );`,
    "duração reduzida com reduceMotion",
  );

  const oldAudioBlock = `      const themeAudio = audioRef.current.theme;\n      if (themeAudio && activeSession?.waveOutro?.status === "cleanup") {\n        const cleanupProgress = Math.min(1, Math.max(0,\n          (activeSession.waveOutro.elapsedMs - WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs)\n          / WAVE_OUTRO_TIMINGS.cleanupMs));\n        const baseMusicVolume = settings.masterVolume * settings.musicVolume;\n        themeAudio.volume = Math.max(0, Math.min(1, baseMusicVolume * (1 - cleanupProgress * 0.8)));\n      }`;
  const newAudioBlock = `      const themeAudio = audioRef.current.theme;\n      if (themeAudio && activeOutro) {\n        const baseMusicVolume = settings.masterVolume * settings.musicVolume;\n        themeAudio.volume = getWaveOutroMusicVolume(activeSession.waveOutro, baseMusicVolume);\n      }`;
  content = replaceOnce(content, oldAudioBlock, newAudioBlock, "ducking de áudio pré-impacto");

  const oldPresent = `      presentScene(\n        ctx, renderLayers, null, renderScale,\n        presentationCamera,\n        adaptiveSettingsRef.current, adaptive,\n      );`;
  const newPresent = `      const cinematicFrozen = !settings.reduceMotion\n        && performance.now() < (graphicsRef.current.cinematicFreezeUntil || 0);\n      if (!cinematicFrozen) {\n        presentScene(\n          ctx, renderLayers, null, renderScale,\n          presentationCamera,\n          adaptiveSettingsRef.current, adaptive,\n        );\n      }`;
  content = replaceOnce(content, oldPresent, newPresent, "hit stop visual");

  content = replaceOnce(
    content,
    '<WaveOutroOverlay outro={snapshot.waveOutro} />',
    '<WaveOutroOverlay outro={snapshot.waveOutro} phase={phase} reduceMotion={settings.reduceMotion} />',
    "props do WaveOutroOverlay",
  );

  write("src/game/GameCanvas.jsx", content);
}

function patchGraphicsRuntime() {
  let content = read("src/game/graphicsRuntime.js");
  content = replaceOnce(
    content,
    `    camera: { amplitude: 0, seed: 1, startedAt: 0 },\n    health: new Map(),`,
    `    camera: { amplitude: 0, seed: 1, startedAt: 0 },\n    cinematicFreezeUntil: 0,\n    health: new Map(),`,
    "cinematicFreezeUntil",
  );

  content = replaceOnce(
    content,
    `    pulseCharging: { radius: 96, life: 420 }, pulseFired: { radius: 210, life: 420 },`,
    `    pulseCharging: { radius: 96, life: 420 }, pulseFired: { radius: 210, life: 420 },\n    waveFinalImpact: { radius: event.lightRadius || 150, life: 460 },\n    missionFinalImpact: { radius: event.lightRadius || 240, life: 760 },`,
    "luzes de impacto final",
  );

  const deathBlock = `    if ((event.type === "enemyDeath" || event.type === "bossDeath") && event.entity) {\n      const life = ENEMY_DEATH_LIFE[event.entity.type]\n        || (event.type === "bossDeath" ? 900 : DEATH_LIFE.enemy);\n      runtime.deaths.push({ kind: "enemy", entity: { ...event.entity }, born: now, life });\n    }`;
  const deathPlusImpact = `${deathBlock}\n    if (["waveFinalImpact", "missionFinalImpact"].includes(event.type)) {\n      const death = [...runtime.deaths].reverse().find((entry) => (\n        entry.kind === "enemy" && (!event.enemyId || entry.entity?.id === event.enemyId)\n      ));\n      if (death) death.life = Math.max(death.life, Number(event.deathLingerMs) || death.life);\n    }`;
  content = replaceOnce(content, deathBlock, deathPlusImpact, "death linger do último inimigo");
  write("src/game/graphicsRuntime.js", content);
}

function patchStyles() {
  let content = read("src/styles.css");
  if (content.includes("/* wave-outro-cinematic-v2 */")) return;
  content += `\n\n/* wave-outro-cinematic-v2 */\n.wave-outro.cinematic-shell {\n  background: transparent;\n  overflow: hidden;\n}\n.wave-outro.cinematic-shell::before { display: none; }\n.profile-missionFinale.cinematic-shell::after, .profile-bossFinale.cinematic-shell::after {\n  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0;\n  background: rgba(255,255,255,.15); animation: wave-mission-global-flash .18s ease-out var(--outro-impact-delay) 1 both;\n}\n.wave-outro-impact-fx { position: absolute; inset: 0; pointer-events: none; z-index: 0; }\n.wave-outro-impact-fx > i {\n  position: absolute; left: var(--outro-impact-x); top: var(--outro-impact-y);\n  translate: -50% -50%; border-radius: 50%; opacity: 0;\n  animation-delay: var(--outro-impact-delay); animation-fill-mode: both;\n}\n.wave-outro-impact-flash {\n  width: 150px; height: 150px;\n  background: radial-gradient(circle, color-mix(in srgb, var(--outro-accent) 86%, white) 0 7%, color-mix(in srgb, var(--outro-primary) 58%, transparent) 28%, transparent 72%);\n  filter: blur(1px); animation: wave-final-flash .34s ease-out 1;\n}\n.wave-outro-shockwave {\n  width: 24px; height: 24px; border: 2px solid color-mix(in srgb, var(--outro-accent) 82%, white);\n  box-shadow: 0 0 20px color-mix(in srgb, var(--outro-primary) 72%, transparent), inset 0 0 12px color-mix(in srgb, var(--outro-primary) 55%, transparent);\n  animation: wave-final-shockwave .52s cubic-bezier(.1,.72,.2,1) 1;\n}\n.profile-missionFinale .wave-outro-shockwave, .profile-bossFinale .wave-outro-shockwave { animation-duration: .68s; }\n.profile-missionFinale .wave-outro-impact-flash, .profile-bossFinale .wave-outro-impact-flash { animation-duration: .42s; }\n.wave-outro-impact-core {\n  width: 22px; height: 22px; background: #fff; box-shadow: 0 0 22px 9px var(--outro-accent);\n  animation: wave-final-core .22s ease-out 1;\n}\n.damage-electric .wave-outro-impact-core { box-shadow: 0 0 18px 10px #93c5fd, 0 0 34px 15px #2563eb; }\n.damage-explosive .wave-outro-impact-core { box-shadow: 0 0 18px 11px #fde68a, 0 0 38px 18px #f97316; }\n.damage-ice .wave-outro-impact-core { box-shadow: 0 0 18px 10px #cffafe, 0 0 34px 16px #22d3ee; }\n.damage-energy .wave-outro-impact-core { box-shadow: 0 0 18px 10px #e9d5ff, 0 0 34px 16px #8b5cf6; }\n.damage-melee .wave-outro-impact-core { border-radius: 18% 82% 18% 82%; transform: rotate(-35deg) scaleX(1.8); }\n.wave-outro-letterbox { position: absolute; inset: 0; z-index: 3; pointer-events: none; }\n.wave-outro-letterbox i {\n  position: absolute; left: 0; right: 0; height: 7%; background: rgba(0,0,0,.94);\n  animation: wave-letterbox-in .25s ease-out both;\n}\n.wave-outro-letterbox i:first-child { top: 0; transform-origin: top; }\n.wave-outro-letterbox i:last-child { bottom: 0; transform-origin: bottom; }\n.wave-outro.victory-intro .wave-outro-letterbox i { animation: wave-letterbox-out .5s ease-in both; }\n.wave-outro-last-target {\n  position: relative; z-index: 4; margin-bottom: 11%; color: #fde68a !important;\n  font: 700 clamp(8px, 1.25cqi, 12px) "Chakra Petch", system-ui !important; letter-spacing: .22em !important;\n  text-shadow: 0 0 14px rgba(251,191,36,.86);\n}\n.wave-outro.mission-secured {\n  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--outro-primary) 9%, transparent), rgba(2,8,15,.72));\n}\n.wave-outro.mission-secured b, .wave-outro.profile-missionFinale.victory-intro b, .wave-outro.profile-bossFinale.victory-intro b {\n  color: color-mix(in srgb, var(--outro-accent) 72%, white);\n  text-shadow: 0 0 26px color-mix(in srgb, var(--outro-primary) 70%, transparent);\n}\n.wave-outro-continue {\n  position: absolute; z-index: 5; bottom: 9%; left: 50%; translate: -50% 0;\n  color: rgba(226,232,240,.62); font: 600 clamp(7px, .9cqi, 10px) "Chakra Petch", system-ui;\n  letter-spacing: .12em; font-style: normal; animation: wave-continue-pulse 1.2s ease-in-out infinite;\n}\n.reduce-motion .wave-outro-impact-fx, .reduce-motion .wave-outro-letterbox { display: none; }\n.reduce-motion.profile-missionFinale.cinematic-shell::after, .reduce-motion.profile-bossFinale.cinematic-shell::after { display: none; }\n.reduce-motion.wave-outro.cinematic-shell { background: rgba(2,8,15,.16); }\n@keyframes wave-mission-global-flash { 0%, 40% { opacity: 0; } 48% { opacity: .42; } 100% { opacity: 0; } }\n@keyframes wave-final-flash { 0%, 35% { opacity: 0; scale: .35; } 45% { opacity: .94; scale: .72; } 100% { opacity: 0; scale: 1.45; } }\n@keyframes wave-final-shockwave { 0%, 38% { opacity: 0; width: 24px; height: 24px; } 44% { opacity: .92; } 100% { opacity: 0; width: calc(var(--outro-shockwave-radius) * 2); height: calc(var(--outro-shockwave-radius) * 2); } }\n@keyframes wave-final-core { 0%, 42% { opacity: 0; scale: .45; } 48% { opacity: 1; scale: 1.25; } 100% { opacity: 0; scale: 2.2; } }\n@keyframes wave-letterbox-in { from { scale: 1 0; } to { scale: 1 1; } }\n@keyframes wave-letterbox-out { from { scale: 1 1; } to { scale: 1 0; } }\n@keyframes wave-continue-pulse { 0%, 100% { opacity: .38; } 50% { opacity: .85; } }\n`;
  write("src/styles.css", content);
}

patchBattleModel();
patchGameCanvas();
patchGraphicsRuntime();
patchStyles();
console.log("Patch cinematográfico de final de onda aplicado sem rollback automático.");
