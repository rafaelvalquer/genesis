import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(repoRoot, relative), content, "utf8");
}

function replaceOnce(content, needle, replacement, label, alreadyNeedle = null) {
  if (alreadyNeedle && content.includes(alreadyNeedle)) return content;
  const index = content.indexOf(needle);
  if (index < 0) throw new Error(`Âncora não encontrada para ${label}. A versão do repositório pode ter mudado.`);
  if (content.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Âncora ambígua para ${label}. Patch interrompido por segurança.`);
  }
  return content.slice(0, index) + replacement + content.slice(index + needle.length);
}

const gameCanvasPath = "src/game/GameCanvas.jsx";
let gameCanvas = read(gameCanvasPath);

gameCanvas = replaceOnce(
  gameCanvas,
  'import { drawSprite, drawSpriteInRect, getTroopVisualEntity } from "./render/battleSceneRenderer.js";',
  'import { drawSprite, drawSpriteInRect, getTroopVisualEntity } from "./render/battleSceneRenderer.js";\n// genesis-wave-outro-cinematic-v1.0.0\nimport { getCinematicWaveOutroCameraTransform } from "./waveOutro/waveOutroCamera.js";\nimport { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "./waveOutro/waveOutroAudio.js";\nimport { WaveOutroCinematicOverlay } from "./waveOutro/WaveOutroCinematicOverlay.jsx";',
  "imports do final cinematográfico",
  'from "./waveOutro/waveOutroCamera.js"',
);

gameCanvas = replaceOnce(
  gameCanvas,
  "export function WaveOutroOverlay({ outro }) {",
  'export function WaveOutroOverlay({ outro, phaseName = "" }) {',
  "assinatura de WaveOutroOverlay",
  'WaveOutroOverlay({ outro, phaseName = "" })',
);

gameCanvas = replaceOnce(
  gameCanvas,
  `  if (outro.status === "finalKill") {\n    return <div className="wave-outro last-kill" aria-live="polite"><small>ÚLTIMO ALVO NEUTRALIZADO</small></div>;\n  }`,
  `  if (outro.status === "finalKill") {\n    return (\n      <div className={\`wave-outro last-kill \${outro.finalWave ? "mission-final-kill" : ""}\`} aria-live="polite">\n        <small>{outro.finalWave ? "ALVO FINAL NEUTRALIZADO" : "ÚLTIMO ALVO NEUTRALIZADO"}</small>\n      </div>\n    );\n  }`,
  "rótulo do último alvo",
  "mission-final-kill",
);

gameCanvas = replaceOnce(
  gameCanvas,
  `  if (outro.status === "victoryIntro") {\n    return (\n      <div className="wave-outro decision-intro victory-intro" aria-live="polite">\n        <b>MISSÃO CONCLUÍDA</b>\n        <span>Perímetro assegurado</span>\n      </div>\n    );\n  }`,
  `  if (outro.status === "victoryIntro") {\n    return (\n      <div className="wave-outro decision-intro victory-intro mission-finale" aria-live="polite">\n        <b>MISSÃO CONCLUÍDA</b>\n        <span>{phaseName ? \`\${phaseName} · Perímetro assegurado\` : "Perímetro assegurado"}</span>\n      </div>\n    );\n  }`,
  "introdução de vitória",
  "victory-intro mission-finale",
);

gameCanvas = replaceOnce(
  gameCanvas,
  `  const bannerStartedAt = WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs + WAVE_OUTRO_TIMINGS.cleanupMs;`,
  `  if (outro.status === "waveCompleteBanner" && outro.finalWave) {\n    return (\n      <div className="wave-outro wave-complete mission-secured active" aria-live="polite">\n        <b>PERÍMETRO ASSEGURADO</b>\n        <span>Última resistência neutralizada</span>\n        <small>{outro.killed} inimigos eliminados</small>\n      </div>\n    );\n  }\n  const bannerStartedAt = WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs + WAVE_OUTRO_TIMINGS.cleanupMs;`,
  "banner especial da última onda",
  "mission-secured",
);

gameCanvas = replaceOnce(
  gameCanvas,
  "  const notificationIdRef = useRef(1);",
  "  const notificationIdRef = useRef(1);\n  const waveOutroCueRef = useRef(null);",
  "controle de cue cinematográfico",
  "waveOutroCueRef",
);

const oldVictoryIntro = `        if (outroEvents.some((event) => event.type === "victoryIntro")) {\n          setBanner("MISSÃO CONCLUÍDA");\n        }`;
const newVictoryIntro = `        if (outroEvents.some((event) => event.type === "victoryIntro")) {\n          setBanner("MISSÃO CONCLUÍDA");\n          play("deploy", 0.58);\n          play("alert", 0.34);\n        }`;
gameCanvas = replaceOnce(
  gameCanvas,
  oldVictoryIntro,
  newVictoryIntro,
  "stinger de vitória",
  'play("deploy", 0.58)',
);

const oldAudioBlock = `      const themeAudio = audioRef.current.theme;\n      if (themeAudio && activeSession?.waveOutro?.status === "cleanup") {\n        const cleanupProgress = Math.min(1, Math.max(0,\n          (activeSession.waveOutro.elapsedMs - WAVE_OUTRO_TIMINGS.finalKillSlowMotionMs)\n          / WAVE_OUTRO_TIMINGS.cleanupMs));\n        const baseMusicVolume = settings.masterVolume * settings.musicVolume;\n        themeAudio.volume = Math.max(0, Math.min(1, baseMusicVolume * (1 - cleanupProgress * 0.8)));\n      }`;
const newAudioBlock = `      const cueState = getWaveOutroCueState(activeSession?.waveOutro);\n      if (cueState?.impactReady && waveOutroCueRef.current !== cueState.key) {\n        waveOutroCueRef.current = cueState.key;\n        const lastEnemy = activeSession.waveOutro.lastKill?.enemy;\n        const impactEvent = {\n          type: cueState.finalWave ? "missionFinalImpact" : "waveFinalImpact",\n          x: Number.isFinite(lastEnemy?.x) ? lastEnemy.x : FIELD.width * 0.64,\n          y: Number.isFinite(lastEnemy?.y)\n            ? lastEnemy.y\n            : ((activeSession.waveOutro.lastKill?.row ?? 2) + 0.5) * CELL.height,\n          shake: settings.reduceMotion ? 0 : cueState.shake,\n          color: phase.palette.accent,\n          seed: Math.round((lastEnemy?.x || 17) * 31 + (lastEnemy?.y || 23) * 17),\n        };\n        consumeGraphicsEvents(graphicsRef.current, [impactEvent], activeSession.elapsed, settings);\n        play("melee", cueState.finalWave ? 0.88 : cueState.cinematic ? 0.68 : 0.48);\n        play("alert", cueState.finalWave ? 0.30 : 0.14);\n      }\n      const themeAudio = audioRef.current.theme;\n      if (themeAudio && activeOutro) {\n        const baseMusicVolume = settings.masterVolume * settings.musicVolume;\n        const outroVolumeFactor = getWaveOutroMusicVolumeFactor(activeSession.waveOutro);\n        themeAudio.volume = Math.max(0, Math.min(1, baseMusicVolume * outroVolumeFactor));\n      }`;
gameCanvas = replaceOnce(
  gameCanvas,
  oldAudioBlock,
  newAudioBlock,
  "ducking e impacto sonoro do final da onda",
  "getWaveOutroMusicVolumeFactor(activeSession.waveOutro)",
);

gameCanvas = replaceOnce(
  gameCanvas,
  "      const outroCamera = getWaveOutroCameraTransform(sessionRef.current, settings.reduceMotion);",
  "      const outroCamera = getCinematicWaveOutroCameraTransform(sessionRef.current, settings.reduceMotion);",
  "câmera cinematográfica ativa",
  "getCinematicWaveOutroCameraTransform(sessionRef.current, settings.reduceMotion)",
);

gameCanvas = replaceOnce(
  gameCanvas,
  "            <WaveOutroOverlay outro={snapshot.waveOutro} />",
  `            <WaveOutroCinematicOverlay\n              outro={snapshot.waveOutro}\n              palette={phase.palette}\n              reduceMotion={settings.reduceMotion}\n            />\n            <WaveOutroOverlay outro={snapshot.waveOutro} phaseName={phase.name} />`,
  "camadas cinematográficas no canvas",
  "<WaveOutroCinematicOverlay",
);

write(gameCanvasPath, gameCanvas);

const battleModelPath = "src/game/battleModel.js";
let battleModel = read(battleModelPath);
const oldSnapshot = `      lastKill: session.waveOutro.lastKill ? {\n        row: session.waveOutro.lastKill.row,\n        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,\n        cinematic: session.waveOutro.lastKill.cinematic,\n      } : null,`;
const newSnapshot = `      lastKill: session.waveOutro.lastKill ? {\n        row: session.waveOutro.lastKill.row,\n        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,\n        cinematic: session.waveOutro.lastKill.cinematic,\n        enemy: session.waveOutro.lastKill.enemy ? {\n          type: session.waveOutro.lastKill.enemy.type,\n          x: session.waveOutro.lastKill.enemy.x,\n          y: session.waveOutro.lastKill.enemy.y,\n          variant: session.waveOutro.lastKill.enemy.variant || null,\n          scale: session.waveOutro.lastKill.enemy.scale || 1,\n        } : null,\n      } : null,`;
battleModel = replaceOnce(
  battleModel,
  oldSnapshot,
  newSnapshot,
  "snapshot visual do último inimigo",
  "enemy: session.waveOutro.lastKill.enemy ? {",
);
write(battleModelPath, battleModel);

const stylesPath = "src/styles.css";
let styles = read(stylesPath);
if (!styles.includes("genesis-wave-outro-cinematic-v1.0.0")) {
  styles += `\n\n/* genesis-wave-outro-cinematic-v1.0.0 */\n.wave-outro-cinematic-layer {\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n  pointer-events: none;\n  z-index: 7;\n}\n\n.wave-outro-impact-flash {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n}\n\n.wave-outro-impact-ring {\n  position: absolute;\n  width: 92px;\n  height: 92px;\n  border: 3px solid var(--wave-outro-accent, #e0f2fe);\n  border-radius: 50%;\n  box-shadow:\n    0 0 12px var(--wave-outro-primary, #38bdf8),\n    0 0 32px color-mix(in srgb, var(--wave-outro-primary, #38bdf8) 65%, transparent);\n  transform-origin: center;\n  will-change: transform, opacity;\n}\n\n.wave-outro-letterbox {\n  position: absolute;\n  left: 0;\n  right: 0;\n  height: 7.5%;\n  background: linear-gradient(180deg, rgba(2, 6, 23, .98), rgba(2, 6, 23, .88));\n  box-shadow: 0 0 28px rgba(2, 6, 23, .7);\n}\n\n.wave-outro-letterbox.top { top: 0; }\n.wave-outro-letterbox.bottom { bottom: 0; transform: rotate(180deg); }\n\n.wave-outro.mission-final-kill small {\n  letter-spacing: .2em;\n  text-shadow: 0 0 18px rgba(255, 255, 255, .45);\n}\n\n.wave-outro.mission-secured {\n  background: radial-gradient(circle at center, rgba(8, 47, 73, .48), rgba(2, 6, 23, .78));\n}\n\n.wave-outro.mission-secured b {\n  font-size: clamp(1.7rem, 4vw, 3.5rem);\n  letter-spacing: .13em;\n  text-shadow: 0 0 26px rgba(103, 232, 249, .38);\n}\n\n.wave-outro.victory-intro.mission-finale b {\n  font-size: clamp(2rem, 5vw, 4.2rem);\n  letter-spacing: .12em;\n  text-shadow: 0 0 34px rgba(255, 255, 255, .32);\n}\n\n.wave-outro.victory-intro.mission-finale span {\n  letter-spacing: .08em;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .wave-outro-impact-flash,\n  .wave-outro-impact-ring {\n    display: none;\n  }\n}\n`;
  write(stylesPath, styles);
}

console.log("Patch cinematográfico aplicado com sucesso.");
