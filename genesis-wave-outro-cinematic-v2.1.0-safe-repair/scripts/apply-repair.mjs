#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] || process.cwd());

function readText(relative) {
  const raw = fs.readFileSync(path.join(root, relative), "utf8");
  return { eol: raw.includes("\r\n") ? "\r\n" : "\n", content: raw.replace(/\r\n/g, "\n") };
}
function writeText(relative, content, eol) {
  const normalized = content.replace(/\r\n/g, "\n");
  fs.writeFileSync(path.join(root, relative), eol === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized, "utf8");
}
function staticImports(content) {
  const ranges=[]; const re=/^(?:\uFEFF)?import\b/gm; let m;
  while ((m=re.exec(content))) {
    const start=m.index; const semi=content.indexOf(";", start); if (semi<0) continue;
    const statement=content.slice(start,semi+1);
    if (!/\bfrom\s+["'][^"']+["']\s*;$/.test(statement.trim()) && !/^import\s+["'][^"']+["']\s*;$/.test(statement.trim())) continue;
    let end=semi+1; if (content[end]==="\n") end++; ranges.push({start,end,statement}); re.lastIndex=end;
  }
  return ranges;
}
function moduleOf(statement) {
  return (statement.match(/\bfrom\s+["']([^"']+)["']/)||statement.match(/^import\s+["']([^"']+)["']/))?.[1]||null;
}
function removeImports(content, predicate) {
  const ranges=staticImports(content).filter(r=>predicate(moduleOf(r.statement),r.statement)).sort((a,b)=>b.start-a.start);
  for (const r of ranges) content=content.slice(0,r.start)+content.slice(r.end);
  return content;
}
function replaceBetween(content,startMarker,endMarker,replacement,label) {
  const s=content.indexOf(startMarker); const e=s>=0?content.indexOf(endMarker,s+startMarker.length):-1;
  if (s<0||e<0) throw new Error(`Reparo incompatível: ${label}`);
  return content.slice(0,s)+replacement+content.slice(e);
}
function replaceRegex(content,re,replacement,label,optional=false) {
  re.lastIndex=0; if(!re.test(content)){ if(optional) return content; throw new Error(`Reparo incompatível: ${label}`); }
  re.lastIndex=0; return content.replace(re,replacement);
}
function stripOldCss(content) {
  const marker="/* wave-outro-cinematic-v2 */";
  const s=content.indexOf(marker); if(s<0) return content;
  const endRe=/@keyframes wave-continue-pulse\s*\{[\s\S]*?\n\}/g;
  endRe.lastIndex=s; const m=endRe.exec(content);
  if(!m) return content.slice(0,s).trimEnd()+"\n";
  return (content.slice(0,s)+content.slice(m.index+m[0].length)).trimEnd()+"\n";
}

const ORIGINAL_OUTRO_TIMINGS = `export const WAVE_OUTRO_TIMINGS = Object.freeze({
  finalKillSlowMotionMs: 600,
  cleanupMs: 400,
  waveCompletedBannerMs: 2000,
  tacticalAdvantageIntroMs: 1100,
  totalMs: 4100,
});
const WAVE_OUTRO_PHASE_ENDS = Object.freeze({
  finalKill: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs,
  cleanup: WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs + WAVE_OUTRO_TIMINGS.cleanupMs,
  banner: WAVE_OUTRO_TIMINGS.totalMs - WAVE_OUTRO_TIMINGS.tacticalAdvantageIntroMs,
  decisionIntro: WAVE_OUTRO_TIMINGS.totalMs,
});
const MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS = 1000;
`;

const ORIGINAL_REMEMBER_KILL = `function rememberEnemyKill(session, enemy, sourceTroopId = null) {
  const config = ENEMIES[enemy?.type] || {};
  session.lastEnemyKillCandidate = {
    enemy: getEnemyDeathEntity(enemy, session.elapsed),
    sourceTroopId,
    row: enemy.row,
    cinematic: Boolean(enemy.variant === "alpha" || config.boss || config.elite),
  };
}

`;

const ORIGINAL_CINEMATIC_AND_ACCELERATE = `export function getWaveOutroCinematicFactor(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro) return 1;
  if (outro.status === "finalKill") return 0.3;
  if (outro.status === "cleanup") {
    const cleanupElapsed = Math.max(0, outro.elapsedMs - WAVE_OUTRO_PHASE_ENDS.finalKill);
    return 0.3 + 0.7 * Math.min(1, cleanupElapsed / WAVE_OUTRO_TIMINGS.cleanupMs);
  }
  return 1;
}

export function accelerateWaveOutro(session) {
  const outro = session?.waveOutro;
  const earliestSkipAt = WAVE_OUTRO_PHASE_ENDS.cleanup + MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS;
  if (outro?.status !== "waveCompleteBanner" || outro.elapsedMs < earliestSkipAt) return false;
  outro.elapsedMs = Math.max(outro.elapsedMs, WAVE_OUTRO_PHASE_ENDS.banner);
  return true;
}

`;

const ORIGINAL_ADVANCE = `export function advanceWaveOutro(session, realDt = 0) {
  if (!isWaveOutroActive(session)) return [];
  const outro = session.waveOutro;
  const events = [];
  outro.elapsedMs += Math.max(0, Number(realDt) || 0);
  let transitioned = true;
  while (transitioned) {
    transitioned = false;
    if (outro.status === "finalKill" && outro.elapsedMs >= WAVE_OUTRO_PHASE_ENDS.finalKill) {
      outro.status = "cleanup";
      events.push({ type: "waveOutroCleanup", wave: outro.completedWave });
      transitioned = true;
    } else if (outro.status === "cleanup" && outro.elapsedMs >= WAVE_OUTRO_PHASE_ENDS.cleanup) {
      outro.status = "waveCompleteBanner";
      events.push({
        type: "waveCompleteBanner",
        wave: outro.completedWave,
        killed: outro.killed,
        integrity: outro.integrityPercent,
        survivors: outro.survivors,
        energyGained: outro.energyGained,
      });
      transitioned = true;
    } else if (outro.status === "waveCompleteBanner" && outro.elapsedMs >= WAVE_OUTRO_PHASE_ENDS.banner) {
      outro.status = outro.finalWave ? "victoryIntro" : "decisionIntro";
      events.push({
        type: outro.finalWave ? "victoryIntro" : "decisionIntro",
        wave: outro.completedWave,
      });
      transitioned = true;
    } else if (["decisionIntro", "victoryIntro"].includes(outro.status)
      && outro.elapsedMs >= WAVE_OUTRO_PHASE_ENDS.decisionIntro) {
      outro.status = "completed";
      if (outro.finalWave) {
        if (!adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) finish(session, "victory");
      } else {
        restoreTroopsForPlanning(session);
        session.pendingDecisionLevel = outro.decisionLevel;
        session.pendingDecision = outro.decisionOptions;
        session.preparing = true;
        events.push({ type: "waveDecisionReady", wave: outro.completedWave });
      }
      transitioned = true;
    }
  }
  return events;
}

`;

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_GAMECANVAS_BLOCK = fs.readFileSync(path.join(packageRoot, "payload", "safe-gamecanvas-block.txt"), "utf8");


function repairBattleModel() {
  const file="src/game/battleModel.js"; const source=readText(file); let c=source.content;
  c=removeImports(c,(mod)=>mod?.startsWith("./waveOutro/"));
  const timingMarker=c.indexOf("// wave-outro-cinematic-v2 timings");
  if(timingMarker>=0){
    const timingEnds=[
      c.indexOf("const ENERGY_PICKUP_LIFETIME_MS",timingMarker),
      c.indexOf("const DEFAULT_SANDBOX_SETTINGS",timingMarker),
      c.indexOf("function indexedTroopById",timingMarker),
      c.indexOf("function rememberEnemyKill",timingMarker),
    ].filter((value)=>value>timingMarker);
    if(!timingEnds.length) throw new Error("Reparo incompatível: limite dos timings anteriores");
    const timingEnd=Math.min(...timingEnds);
    c=c.slice(0,timingMarker)+ORIGINAL_OUTRO_TIMINGS+c.slice(timingEnd);
  } else {
    c=replaceRegex(c,/export const WAVE_OUTRO_TIMINGS = Object\.freeze\(\{[\s\S]*?\}\);\n(?:const WAVE_OUTRO_PHASE_ENDS = Object\.freeze\(\{[\s\S]*?\}\);\n)?(?:const MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS = \d+;\n)?/,ORIGINAL_OUTRO_TIMINGS,"timings do final de onda");
  }
  c=replaceBetween(c,"function rememberEnemyKill","function clearRasgamarCoil",ORIGINAL_REMEMBER_KILL,"rememberEnemyKill");
  c=c.replaceAll("rememberEnemyKill(session, enemy, context);","rememberEnemyKill(session, enemy, context.sourceTroopId || null);");
  const fallbackStart=c.indexOf("      const fallbackSourceTroopId = fatalEvent?.sourceTroopId || null;");
  const lastKillStart=fallbackStart>=0?c.indexOf("      const lastKill = session.lastEnemyKillCandidate",fallbackStart):-1;
  if(fallbackStart>=0 && lastKillStart>fallbackStart){
    c=c.slice(0,fallbackStart)+`      const eventLastKill = fatalEnemy ? {
        enemy: { ...fatalEnemy },
        sourceTroopId: fatalEvent.sourceTroopId || null,
        row: fatalEnemy.row,
        cinematic: Boolean(fatalEnemy.variant === "alpha" || fatalConfig.boss || fatalConfig.elite),
      } : null;
`+c.slice(lastKillStart);
  }
  c=c.replace(/        profileId: getWaveOutroProfileId\([^\n]*\),\n        playbackRate: 1,\n        focusDispatched: false,\n        impactDispatched: false,\n        aftermathDispatched: false,\n/g,"");
  c=replaceBetween(c,"export function getWaveOutroCinematicFactor","function restoreTroopsForPlanning",ORIGINAL_CINEMATIC_AND_ACCELERATE,"cinematic factor / accelerate");
  c=replaceBetween(c,"export function advanceWaveOutro","export function getRouteTelemetry",ORIGINAL_ADVANCE,"advanceWaveOutro");
  // Snapshot público original e defensivo.
  const snap=c.indexOf("export function getSnapshot");
  const ws=snap>=0?c.indexOf("\n    waveOutro: session.waveOutro ? {",snap):-1;
  const out=ws>=0?c.indexOf("\n    outcome:",ws):-1;
  if(ws<0||out<0) throw new Error("Reparo incompatível: snapshot waveOutro");
  const snapshot=`
    waveOutro: session.waveOutro ? {
      status: session.waveOutro.status,
      elapsedMs: session.waveOutro.elapsedMs,
      completedWave: session.waveOutro.completedWave,
      finalWave: session.waveOutro.finalWave,
      killed: session.waveOutro.killed,
      survivors: session.waveOutro.survivors,
      integrityPercent: session.waveOutro.integrityPercent,
      energyGained: session.waveOutro.energyGained,
      decisionOptions: Array.isArray(session.waveOutro.decisionOptions)
        ? session.waveOutro.decisionOptions.map((option) => ({ id: option.id, label: option.label }))
        : [],
      lastKill: session.waveOutro.lastKill ? {
        row: session.waveOutro.lastKill.row,
        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,
        cinematic: session.waveOutro.lastKill.cinematic,
      } : null,
    } : null,`;
  c=c.slice(0,ws)+snapshot+c.slice(out);
  writeText(file,c,source.eol);
}

function repairGameCanvas() {
  const file="src/game/GameCanvas.jsx"; const source=readText(file); let c=source.content;
  c=removeImports(c,(mod)=>mod?.startsWith("./waveOutro/"));
  const startCandidates=[c.indexOf("export function getWaveOutroCameraTransform"),c.indexOf("export { getWaveOutroCameraTransform };")].filter(i=>i>=0);
  const s=startCandidates.length?Math.min(...startCandidates):-1;
  const e=s>=0?c.indexOf("export function resolveInspectedTroopId",s):-1;
  if(s<0||e<0) throw new Error("Reparo incompatível: bloco câmera/overlay");
  c=c.slice(0,s)+SAFE_GAMECANVAS_BLOCK+c.slice(e);
  // Normalize advance + handlers to stable flow, with only local safe audio ducking.
  const adv=c.indexOf("      const outroEvents = advanceWaveOutro(");
  const active=adv>=0?c.indexOf("      const activeSession = sessionRef.current;",adv):-1;
  if(adv>=0&&active>adv){
    const replacement=fs.readFileSync(path.join(packageRoot, "payload", "safe-outro-loop-block.txt"), "utf8");
    c=c.slice(0,adv)+replacement+c.slice(active);
  } else if(!c.includes("const outroEvents = advanceWaveOutro(sessionRef.current, frameDelta);")) {
    throw new Error("Reparo incompatível: chamada advanceWaveOutro no GameCanvas");
  }
  // Normalize audio block.
  const theme=c.indexOf("      const themeAudio = audioRef.current.theme;");
  const alarm=theme>=0?c.indexOf("      if (activeSession && !activeOutro",theme):-1;
  if(theme<0||alarm<0) throw new Error("Reparo incompatível: bloco de áudio");
  c=c.slice(0,theme)+`      const themeAudio = audioRef.current.theme;
      if (themeAudio && activeOutro) {
        const baseMusicVolume = settings.masterVolume * settings.musicVolume;
        themeAudio.volume = getSafeWaveOutroMusicVolume(activeSession.waveOutro, baseMusicVolume);
      }
`+c.slice(alarm);
  // Remove visual freeze wrapper from any v2.0.x variant.
  const freezeStart=c.indexOf("      const cinematicFrozen = !settings.reduceMotion");
  if(freezeStart>=0){
    const stablePresent=`      presentScene(
        ctx, renderLayers, null, renderScale,
        presentationCamera,
        adaptiveSettingsRef.current, adaptive,
      );
`;
    const inlineEnd=c.indexOf(" }",c.indexOf("if (!cinematicFrozen)",freezeStart));
    const inlineSlice=inlineEnd>freezeStart?c.slice(freezeStart,inlineEnd+2):"";
    if(inlineSlice.includes("presentScene(") && inlineSlice.includes("if (!cinematicFrozen)")){
      c=c.slice(0,freezeStart)+stablePresent+c.slice(inlineEnd+2);
    } else {
      const presentStart=c.indexOf("        presentScene(",freezeStart);
      const presentEnd=presentStart>=0?c.indexOf("        );",presentStart):-1;
      const wrapperEnd=presentEnd>=0?c.indexOf("      }",presentEnd):-1;
      if(presentStart<0||presentEnd<0||wrapperEnd<0) throw new Error("Reparo incompatível: wrapper cinematicFrozen");
      c=c.slice(0,freezeStart)+stablePresent+c.slice(wrapperEnd+7);
    }
  }
  // Normalize overlay invocation regardless of previous props.
  const desired='<WaveOutroOverlay outro={sessionRef.current?.waveOutro} phase={phase} reduceMotion={settings.reduceMotion} session={sessionRef.current} />';
  const tag=/<WaveOutroOverlay\b[^>]*\/>/m;
  if(tag.test(c)) c=c.replace(tag,desired); else throw new Error("Reparo incompatível: uso de WaveOutroOverlay");
  writeText(file,c,source.eol);
}

function repairGraphicsRuntime() {
  const file="src/game/graphicsRuntime.js"; const source=readText(file); let c=source.content;
  c=c.replace(/\s*cinematicFreezeUntil: 0,\n?/g,"\n");
  c=c.replace(/\n\s*waveFinalImpact: \{ radius: event\.lightRadius \|\| 150, life: 460 \},\n\s*missionFinalImpact: \{ radius: event\.lightRadius \|\| 240, life: 760 \},/g,"");
  c=c.replace(/\n    if \(\["waveFinalImpact", "missionFinalImpact"\]\.includes\(event\.type\)\) \{[\s\S]*?\n    \}/g,"");
  writeText(file,c,source.eol);
}

const SAFE_CSS=`

/* wave-outro-cinematic-safe-v2.1 */
.wave-outro.safe-cinematic { overflow: hidden; }
.wave-outro.safe-cinematic.final-kill, .wave-outro.safe-cinematic.cleanup { background: transparent; }
.safe-wave-impact { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.safe-wave-impact i { position: absolute; left: var(--safe-outro-x); top: var(--safe-outro-y); translate: -50% -50%; border-radius: 50%; opacity: 0; animation-delay: var(--safe-outro-delay); animation-fill-mode: both; }
.safe-wave-flash { width: 140px; height: 140px; background: radial-gradient(circle, #fff 0 4%, var(--safe-outro-accent) 12%, color-mix(in srgb, var(--safe-outro-primary) 40%, transparent) 36%, transparent 72%); animation: safe-wave-flash .36s ease-out 1; }
.safe-wave-ring { width: 24px; height: 24px; border: 2px solid var(--safe-outro-accent); box-shadow: 0 0 18px var(--safe-outro-primary); animation: safe-wave-ring .52s ease-out 1; }
.profile-missionFinale .safe-wave-ring, .profile-bossFinale .safe-wave-ring { animation-duration: .66s; }
.profile-bossFinale .safe-wave-ring { border-width: 3px; }
.damage-explosive .safe-wave-flash { filter: sepia(.25) saturate(1.35); }
.damage-electric .safe-wave-flash { filter: hue-rotate(170deg) saturate(1.45); }
.damage-ice .safe-wave-flash { filter: hue-rotate(145deg) brightness(1.15); }
.safe-wave-letterbox { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.safe-wave-letterbox i { position: absolute; left: 0; right: 0; height: 7%; background: rgba(0,0,0,.94); animation: safe-letterbox .24s ease-out both; }
.safe-wave-letterbox i:first-child { top: 0; transform-origin: top; }
.safe-wave-letterbox i:last-child { bottom: 0; transform-origin: bottom; }
.safe-wave-last-target { position: relative; z-index: 4; margin-bottom: 12%; color: #fde68a !important; letter-spacing: .18em !important; text-shadow: 0 0 14px rgba(251,191,36,.78); }
.reduce-motion .safe-wave-impact, .reduce-motion .safe-wave-letterbox { display: none; }
@keyframes safe-wave-flash { 0%,35% { opacity:0; scale:.35; } 45% { opacity:.9; scale:.72; } 100% { opacity:0; scale:1.5; } }
@keyframes safe-wave-ring { 0%,38% { opacity:0; width:24px; height:24px; } 45% { opacity:.9; } 100% { opacity:0; width:260px; height:260px; } }
@keyframes safe-letterbox { from { scale:1 0; } to { scale:1 1; } }
`;
function repairStyles() {
  const file="src/styles.css"; const source=readText(file); let c=stripOldCss(source.content);
  const oldSafe=c.indexOf("/* wave-outro-cinematic-safe-v2.1 */"); if(oldSafe>=0) c=c.slice(0,oldSafe).trimEnd()+"\n";
  c+=SAFE_CSS; writeText(file,c,source.eol);
}
function cleanupOldFiles() {
  const files=[
    "src/game/waveOutro/waveOutroProfiles.js","src/game/waveOutro/waveOutroCamera.js","src/game/waveOutro/waveOutroAudio.js",
    "src/game/waveOutro/waveOutroEffects.js","src/game/waveOutro/waveOutroRenderer.js","src/game/waveOutro/waveOutroProfiles.test.js",
    "src/game/waveOutro/waveOutroCamera.test.js","scripts/check-wave-outro-contract.mjs","scripts/check-wave-outro-runtime.mjs"
  ];
  for(const rel of files){ const p=path.join(root,rel); if(fs.existsSync(p)) fs.rmSync(p,{force:true}); }
}

try {
  repairBattleModel();
  repairGameCanvas();
  repairGraphicsRuntime();
  repairStyles();
  cleanupOldFiles();
  console.log("Reparo cinematográfico seguro v2.1.0 aplicado.");
  console.log("O motor de waveOutro foi normalizado para a base estável; a cinematografia agora fica isolada no GameCanvas/CSS.");
} catch(error) {
  console.error(error?.stack||error);
  console.error("IMPORTANTE: nenhum restore automático foi executado.");
  process.exitCode=1;
}
