import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(repoRoot, relative), content, "utf8");
const exists = (relative) => fs.existsSync(path.join(repoRoot, relative));
const newlineOf = (content) => content.includes("\r\n") ? "\r\n" : "\n";
const normalizeNewlines = (content, newline) => content.replace(/\r?\n/g, newline);

function patchGameCanvas() {
  const file = "src/game/GameCanvas.jsx";
  let content = read(file);
  const newline = newlineOf(content);

  // A arquitetura final mantém somente os módulos waveOutro como fonte de verdade.
  const safeStart = content.indexOf("const SAFE_WAVE_OUTRO_PROFILES");
  const safeEnd = content.indexOf("export function resolveInspectedTroopId", safeStart >= 0 ? safeStart : 0);
  if (safeStart >= 0) {
    if (safeEnd < 0) throw new Error("GameCanvas incompatível: fim do bloco SAFE_* não encontrado.");
    content = content.slice(0, safeStart) + content.slice(safeEnd);
    console.log("[GameCanvas] removido bloco SAFE_* e WaveOutroOverlay local");
  }

  // Normaliza a importação de áudio para usar cue + ducking do módulo único.
  const audioImportRegex = /import\s*\{[^;]*?\}\s*from\s*["']\.\/waveOutro\/waveOutroAudio\.js["'];?/s;
  const audioMatch = content.match(audioImportRegex);
  if (!audioMatch) throw new Error("GameCanvas incompatível: import de waveOutroAudio não encontrado.");
  content = content.replace(
    audioImportRegex,
    'import { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "./waveOutro/waveOutroAudio.js";',
  );

  // Compatibilidade sem duplicar implementação: aliases apontam para os módulos finais.
  const compatBlock = [
    "export { getCinematicWaveOutroCameraTransform as getWaveOutroCameraTransform };",
    "export { WaveOutroCinematicOverlay as WaveOutroOverlay };",
    "",
  ].join("\n");
  if (!content.includes("getCinematicWaveOutroCameraTransform as getWaveOutroCameraTransform")) {
    const marker = "export function resolveInspectedTroopId";
    const index = content.indexOf(marker);
    if (index < 0) throw new Error("GameCanvas incompatível: resolveInspectedTroopId não encontrado.");
    content = content.slice(0, index) + compatBlock + content.slice(index);
  }

  // Ducking passa a usar waveOutroAudio.js.
  content = content.replace(
    /getSafeWaveOutroMusicVolume\(activeSession\.waveOutro,\s*baseMusicVolume\)/g,
    "baseMusicVolume * getWaveOutroMusicVolumeFactor(activeSession.waveOutro)",
  );

  // Remove quaisquer chamadas residuais do overlay antigo e deixa um único overlay modular.
  const pairRegex = /<WaveOutroCinematicOverlay[\s\S]*?\/>\s*<WaveOutroOverlay[\s\S]*?\/>/;
  if (pairRegex.test(content)) {
    content = content.replace(pairRegex, [
      "<WaveOutroCinematicOverlay",
      "              outro={snapshot.waveOutro}",
      "              phase={phase}",
      "              reduceMotion={settings.reduceMotion}",
      "            />",
    ].join("\n"));
  } else {
    // Normaliza uma chamada modular já única.
    content = content.replace(/palette=\{phase\.palette\}/g, "phase={phase}");
    content = content.replace(/\s*<WaveOutroOverlay[\s\S]*?\/>/g, "");
  }

  // Remove comentários de pacotes antigos, que não fazem parte da arquitetura de runtime.
  content = content.replace(/\s*\/\/ genesis-wave-outro-cinematic-v1\.0\.0\s*/g, newline);

  if (/SAFE_WAVE_OUTRO|getSafeWaveOutro|safeOutroDamageKind|safeEaseOutCubic|safeSmoothStep/.test(content)) {
    throw new Error("Limpeza incompleta: símbolos SAFE_* ainda existem no GameCanvas.");
  }
  if (/function\s+WaveOutroOverlay\s*\(/.test(content)) {
    throw new Error("Limpeza incompleta: WaveOutroOverlay local ainda existe.");
  }
  if (!content.includes("getWaveOutroMusicVolumeFactor(activeSession.waveOutro)")) {
    throw new Error("Integração incompleta: ducking modular não foi conectado.");
  }

  write(file, normalizeNewlines(content, newline));
  console.log("[GameCanvas] arquitetura modular consolidada");
}

function patchBattleModel() {
  const file = "src/game/battleModel.js";
  let content = read(file);
  const newline = newlineOf(content);
  const snapshotStart = content.indexOf("export function getSnapshot");
  if (snapshotStart < 0) throw new Error("battleModel incompatível: getSnapshot não encontrado.");

  const lastKillStart = content.indexOf("lastKill: session.waveOutro.lastKill ? {", snapshotStart);
  if (lastKillStart < 0) throw new Error("battleModel incompatível: snapshot de lastKill não encontrado.");
  if (content.slice(lastKillStart, lastKillStart + 1200).includes("x: session.waveOutro.lastKill.enemy.x")) {
    console.log("[battleModel] snapshot mínimo do último abate já está normalizado");
    return;
  }
  const lastKillEndMarker = "} : null,";
  const lastKillEnd = content.indexOf(lastKillEndMarker, lastKillStart);
  if (lastKillEnd < 0) throw new Error("battleModel incompatível: fim do snapshot de lastKill não encontrado.");

  const replacement = [
    "lastKill: session.waveOutro.lastKill ? {",
    "        row: session.waveOutro.lastKill.row,",
    "        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,",
    "        cinematic: session.waveOutro.lastKill.cinematic,",
    "        enemy: session.waveOutro.lastKill.enemy ? {",
    "          type: session.waveOutro.lastKill.enemy.type,",
    "          x: session.waveOutro.lastKill.enemy.x,",
    "          y: session.waveOutro.lastKill.enemy.y,",
    "          variant: session.waveOutro.lastKill.enemy.variant,",
    "        } : null,",
    "      } : null,",
  ].join("\n");

  content = content.slice(0, lastKillStart) + replacement + content.slice(lastKillEnd + lastKillEndMarker.length);
  write(file, normalizeNewlines(content, newline));
  console.log("[battleModel] snapshot mínimo do último abate expõe type/x/y/variant");
}

function patchStyles() {
  const file = "src/styles.css";
  let content = read(file);
  const newline = newlineOf(content);
  const marker = "/* wave-outro-cinematic-safe-v2.1 */";
  const start = content.indexOf(marker);
  if (start >= 0) {
    const tail = content.slice(start);
    const endMatch = tail.match(/@keyframes\s+safe-letterbox\s*\{[^}]*\}/);
    if (!endMatch) throw new Error("styles.css incompatível: fim do CSS safe-wave não encontrado.");
    const end = start + endMatch.index + endMatch[0].length;
    content = content.slice(0, start).trimEnd() + "\n" + content.slice(end).trimStart();
    console.log("[styles] removido CSS safe-wave duplicado");
  }

  if (/safe-wave-|safe-cinematic|safe-letterbox/.test(content)) {
    throw new Error("Limpeza incompleta: CSS safe-wave ainda existe.");
  }
  if (!content.includes(".wave-outro-cinematic-layer")) {
    throw new Error("styles.css incompatível: CSS modular cinematográfico não encontrado.");
  }

  write(file, normalizeNewlines(content.trimEnd() + "\n", newline));
}

function removeObsoleteSourceFiles() {
  for (const relative of [
    "src/game/waveOutro/waveOutroEffects.js",
    "src/game/waveOutro/waveOutroRenderer.js",
    "scripts/check-wave-outro-cinematic-contract.mjs",
  ]) {
    if (exists(relative)) {
      fs.rmSync(path.join(repoRoot, relative), { force: true });
      console.log(`[cleanup] removido arquivo obsoleto: ${relative}`);
    }
  }
}

patchGameCanvas();
patchBattleModel();
patchStyles();
removeObsoleteSourceFiles();
console.log("Arquitetura final de waveOutro aplicada sem rollback automático.");
