#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];
const requireText = (content, value, label) => checks.push({ ok: content.includes(value), label });
const rejectText = (content, value, label) => checks.push({ ok: !content.includes(value), label });

const model = read("src/game/battleModel.js");
const canvas = read("src/game/GameCanvas.jsx");
const graphics = read("src/game/graphicsRuntime.js");
const styles = read("src/styles.css");
const profiles = read("src/game/waveOutro/waveOutroProfiles.js");
const camera = read("src/game/waveOutro/waveOutroCamera.js");
const audio = read("src/game/waveOutro/waveOutroAudio.js");
const effects = read("src/game/waveOutro/waveOutroEffects.js");
const renderer = read("src/game/waveOutro/waveOutroRenderer.js");

requireText(model, 'getWaveOutroProfileId({ finalWave, lastKill })', "perfil escolhido ao encerrar a onda");
requireText(model, 'type: outro.finalWave ? "missionFinalFocus" : "waveFinalFocus"', "evento de foco final");
requireText(model, 'buildWaveOutroImpactEvent(outro)', "evento de impacto final");
requireText(model, 'buildWaveOutroAftermathEvent(outro)', "evento de aftermath");
requireText(model, 'outro.playbackRate = Math.max(2', "clique acelera a cinematográfica sem saltar estados");
requireText(model, 'sourceTroopType', "snapshot registra a tropa responsável");
requireText(model, 'damageKind', "snapshot registra o tipo de dano");
requireText(canvas, 'getWaveOutroMusicVolume', "ducking de áudio por curva");
requireText(canvas, 'cinematicFreezeUntil', "hit-stop somente visual");
requireText(canvas, 'settings.reduceMotion ? 1.35 : 1', "reduceMotion encurta a apresentação");
requireText(canvas, 'PERÍMETRO ASSEGURADO', "primeiro estágio da vitória final");
requireText(graphics, 'missionFinalImpact', "runtime gráfico consome impacto final");
requireText(graphics, 'deathLingerMs', "death linger do último inimigo");
requireText(styles, '/* wave-outro-cinematic-v2 */', "estilos cinematográficos instalados");
requireText(styles, 'wave-outro-letterbox', "letterbox cinematográfico");
requireText(profiles, 'bossFinale', "perfil de boss finale");
requireText(camera, 'smoothStep', "retorno de câmera com easing");
requireText(audio, 'playWaveOutroVictoryStinger', "victory stinger");
requireText(effects, 'inferWaveOutroDamageKind', "impacto varia por dano");
requireText(renderer, 'phase?.palette?.primary', "identidade visual por paleta da fase");
rejectText(model, 'MINIMUM_BANNER_VISIBLE_BEFORE_SKIP_MS', "skip antigo removido");
requireText(canvas, 'WAVE_OUTRO_RENDERABLE_STATUSES', "overlay não entra no caminho crítico do mount");
requireText(canvas, 'outro={sessionRef.current?.waveOutro}', "overlay usa estado interno completo da sessão");
requireText(renderer, 'RENDERABLE_STATUSES', "renderer ignora estados não cinematográficos");
rejectText(model, 'profileId: session.waveOutro.profileId || getWaveOutroProfileId(session.waveOutro)', "snapshot público não calcula perfil durante mount");

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FALHA"} - ${check.label}`);
  if (!check.ok) failed += 1;
}
if (failed) {
  console.error(`\n${failed} contrato(s) do final de onda falharam.`);
  process.exit(1);
}
console.log(`\n${checks.length} contratos do final de onda validados.`);
