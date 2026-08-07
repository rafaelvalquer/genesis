import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const gameCanvas = read("src/game/GameCanvas.jsx");
const battleModel = read("src/game/battleModel.js");
const styles = read("src/styles.css");

for (const expected of [
  'getCinematicWaveOutroCameraTransform',
  'getWaveOutroMusicVolumeFactor',
  'getWaveOutroCueState',
  '<WaveOutroCinematicOverlay',
  'PERÍMETRO ASSEGURADO',
  'ALVO FINAL NEUTRALIZADO',
  'play("deploy", 0.58)',
]) {
  assert(gameCanvas.includes(expected), `GameCanvas não contém: ${expected}`);
}

for (const expected of [
  'finalKillSlowMotionMs: 600',
  'cleanupMs: 400',
  'waveCompletedBannerMs: 2000',
  'tacticalAdvantageIntroMs: 1100',
  'totalMs: 4100',
  'enemy: session.waveOutro.lastKill.enemy ? {',
]) {
  assert(battleModel.includes(expected), `Contrato do motor alterado ou snapshot ausente: ${expected}`);
}

assert(styles.includes("genesis-wave-outro-cinematic-v1.0.0"), "CSS cinematográfico não instalado.");
assert(fs.existsSync(path.join(repoRoot, "src/game/waveOutro/waveOutroCamera.js")), "Módulo de câmera ausente.");
assert(fs.existsSync(path.join(repoRoot, "src/game/waveOutro/waveOutroAudio.js")), "Módulo de áudio ausente.");
assert(fs.existsSync(path.join(repoRoot, "src/game/waveOutro/WaveOutroCinematicOverlay.jsx")), "Overlay cinematográfico ausente.");

console.log("Contrato do final de onda cinematográfico: OK");
