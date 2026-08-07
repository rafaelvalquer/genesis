import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const game = read("src/game/GameCanvas.jsx");
const model = read("src/game/battleModel.js");
const profiles = read("src/game/waveOutro/waveOutroProfiles.js");
const camera = read("src/game/waveOutro/waveOutroCamera.js");
const audio = read("src/game/waveOutro/waveOutroAudio.js");
const overlay = read("src/game/waveOutro/WaveOutroCinematicOverlay.jsx");
const styles = read("src/styles.css");

const checks = [
  ["GameCanvas sem SAFE_*", !/SAFE_WAVE_OUTRO|getSafeWaveOutro|safeOutroDamageKind|safeEaseOutCubic|safeSmoothStep/.test(game)],
  ["GameCanvas sem WaveOutroOverlay local", !/function\s+WaveOutroOverlay\s*\(/.test(game)],
  ["GameCanvas mantém apenas um overlay em JSX", (game.match(/<WaveOutroCinematicOverlay\b/g) || []).length === 1 && (game.match(/<WaveOutroOverlay\b/g) || []).length === 0],
  ["GameCanvas usa áudio modular", game.includes("getWaveOutroMusicVolumeFactor(activeSession.waveOutro)")],
  ["GameCanvas usa câmera modular", game.includes("getCinematicWaveOutroCameraTransform(sessionRef.current")],
  ["alias de câmera apenas reexporta módulo", game.includes("getCinematicWaveOutroCameraTransform as getWaveOutroCameraTransform")],
  ["alias de overlay apenas reexporta módulo", game.includes("WaveOutroCinematicOverlay as WaveOutroOverlay")],
  ["câmera usa zoom", /\bzoom\s*:/.test(camera) && !/\bscale\s*:/.test(camera)],
  ["câmera fornece focusX/focusY", camera.includes("focusX") && camera.includes("focusY")],
  ["perfil usa finalWave", profiles.includes("finalWave") && !profiles.includes('type === "mission_finale"')],
  ["impacto usa finalKill/cleanup", profiles.includes('"finalKill"') && profiles.includes('"cleanup"') && !profiles.includes('status === "impact"')],
  ["cue tolera frame skip", audio.includes("elapsed >= profile.impactAtMs")],
  ["cue tem chave estável", audio.includes("completedWave") && audio.includes("startedAt")],
  ["snapshot expõe posição mínima", model.includes("x: session.waveOutro.lastKill.enemy.x") && model.includes("type: session.waveOutro.lastKill.enemy.type")],
  ["overlay usa finalWave", overlay.includes("outro.finalWave")],
  ["overlay usa elapsed via impact state", overlay.includes("getWaveOutroImpactState(outro)")],
  ["reduceMotion remove efeitos", overlay.includes("!reduceMotion")],
  ["CSS safe removido", !/safe-wave-|safe-cinematic|safe-letterbox/.test(styles)],
  ["CSS modular preservado", styles.includes(".wave-outro-cinematic-layer")],
  ["waveOutroEffects obsoleto removido", !exists("src/game/waveOutro/waveOutroEffects.js")],
  ["waveOutroRenderer obsoleto removido", !exists("src/game/waveOutro/waveOutroRenderer.js")],
  ["contrato antigo removido", !exists("scripts/check-wave-outro-cinematic-contract.mjs")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"} - ${label}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} verificações passaram.`);
if (failed) process.exit(1);
