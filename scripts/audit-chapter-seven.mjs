import { access, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CHAPTERS, ENEMIES, PHASES, TROOPS } from "../src/game/content.js";
import { CAMPAIGN_BIOMES } from "../src/campaign/campaignBiomes.js";
import { CAMPAIGN_CHAPTER_ROUTES } from "../src/campaign/campaignSceneData.js";
import {
  getCombatRows,
  getDefaultTroopDeploymentLimit,
  isSystemEnabledForPhase,
  sanitizeLoadoutForPhase,
} from "../src/game/phaseRules.js";
import { buildSectorQueue } from "../src/game/chapter07/convoySpawnDirector.js";

const failures = [];
const animationAudit = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const chapter = CHAPTERS.find((entry) => entry.id === "chapter_07");
const phases = PHASES.filter((phase) => phase.chapterId === "chapter_07");
const expectedIds = Array.from({ length: 8 }, (_, index) => `fase_${49 + index}`);

check(Boolean(chapter), "chapter_07 não registrado");
check(phases.length === 8, `esperadas 8 fases, recebidas ${phases.length}`);
check(JSON.stringify(chapter?.phaseIds) === JSON.stringify(expectedIds), "phaseIds do capítulo estão incorretos");
check(PHASES[47]?.id === "fase_48" && PHASES[48]?.id === "fase_49", "transição fase_48 -> fase_49 quebrada");
check(CAMPAIGN_CHAPTER_ROUTES.chapter_07?.length === 8, "rota do planeta precisa de 8 marcadores");
check(Boolean(CAMPAIGN_BIOMES.chapter_07), "bioma ferruginoso ausente");

for (const phase of phases) {
  check(phase.progressionMode === "convoy", `${phase.id}: progressionMode inválido`);
  check(phase.loadoutLimit === 7, `${phase.id}: loadoutLimit deve ser 7`);
  check(phase.supplyLimit === 32, `${phase.id}: supplyLimit deve ser 32`);
  check(phase.energy === 100 && phase.energyCapacity === 200, `${phase.id}: energia deve ser 100/200`);
  check(JSON.stringify(getCombatRows(phase)) === JSON.stringify([0, 1, 3, 4]), `${phase.id}: rotas de combate inválidas`);
  check(getDefaultTroopDeploymentLimit(phase) === 4, `${phase.id}: limite padrão deve ser 4`);
  check(phase.rules.transportRow === 2, `${phase.id}: R3 não está reservada`);
  check(sanitizeLoadoutForPhase(phase, ["colono", "reator", "thermalPlatform"]).join() === "colono",
    `${phase.id}: loadout bloqueado não é filtrado`);
  check(!isSystemEnabledForPhase(phase, "enemyEnergyPickups"), `${phase.id}: pickups de energia ativos`);
  check(!isSystemEnabledForPhase(phase, "waveCompletionEnergy"), `${phase.id}: energia de onda ativa`);
  check(phase.sectors?.length === 4, `${phase.id}: precisa de 4 setores`);
  check(JSON.stringify(phase.convoy?.sectorStops) === JSON.stringify([.06, .28, .51, .74, .96]),
    `${phase.id}: posições dos setores inválidas`);
  check(phase.convoy?.reserveInitial === 80 && phase.convoy?.reserveMax === 80, `${phase.id}: reserva deve ser 80/80`);
  check(phase.convoy?.energyPerPulse === 3 && phase.convoy?.energyPulseEveryMs === 5000,
    `${phase.id}: pulso logístico deve ser 3/5s`);
  for (let sectorIndex = 0; sectorIndex < 4; sectorIndex += 1) {
    const sector = phase.sectors[sectorIndex];
    check(Boolean(sector?.openingPackets?.length), `${phase.id}/S${sectorIndex + 1}: opening packets ausentes`);
    check(sector?.reinforcement?.startsAtMs > sector?.reinforcement?.warningAtMs,
      `${phase.id}/S${sectorIndex + 1}: reforço sem aviso antecipado`);
    for (const seed of [1, 7, 49, 997]) {
      check(buildSectorQueue(phase, sectorIndex, seed).every((entry) => entry.row !== 2),
        `${phase.id}/S${sectorIndex + 1}/seed${seed}: spawn em R3`);
    }
  }
}

for (const id of ["legionaroFerrugem", "saqueadorEscoria", "couracadoHematita", "cacadorComboio",
  "sabotadorOxido", "atiradorRavina", "marechalForja"]) {
  check(Boolean(ENEMIES[id]), `inimigo ferruginoso ausente: ${id}`);
}
check(ENEMIES.marechalForja?.boss === true, "Marechal da Forja não está marcado como boss");
check(Boolean(TROOPS.reator) && Boolean(TROOPS.thermalPlatform), "tropas legadas foram removidas do catálogo");

const arenaNames = ["chapter_07.webp", ...expectedIds.map((id) => `${id}.webp`)];
for (const name of arenaNames) {
  const url = new URL(`../src/game/assets/arenas/${name}`, import.meta.url);
  try {
    await access(url);
    const metadata = await stat(fileURLToPath(url));
    check(metadata.size > 100_000, `${name}: asset abaixo de 100 KB`);
  } catch {
    failures.push(`${name}: asset ausente`);
  }
}

for (const id of ["legionaroFerrugem", "saqueadorEscoria", "couracadoHematita", "cacadorComboio",
  "sabotadorOxido", "atiradorRavina", "marechalForja"]) {
  for (const state of ["idle", "walking", "attack"]) {
    const frames = [];
    for (let frame = 0; frame < 8; frame += 1) {
      const frameUrl = new URL(`../src/game/assets/enemy/${id}/${state}/frame${frame}.png`, import.meta.url);
      try {
        await access(frameUrl);
        const image = sharp(fileURLToPath(frameUrl)).ensureAlpha();
        const metadata = await image.metadata();
        check(metadata.width === 512 && metadata.height === 512,
          `${id}/${state}/frame${frame}: dimensão deve ser 512x512`);
        const { data } = await image.raw().toBuffer({ resolveWithObject: true });
        let transparent = 0;
        for (let offset = 3; offset < data.length; offset += 4) {
          if (data[offset] === 0) transparent += 1;
        }
        check(transparent / (data.length / 4) > .1,
          `${id}/${state}/frame${frame}: transparência insuficiente`);
        frames.push(data);
      } catch {
        failures.push(`${id}/${state}/frame${frame}.png: asset ausente`);
      }
    }
    const differences = [];
    for (let frame = 1; frame < frames.length; frame += 1) {
      let difference = 0;
      for (let offset = 0; offset < frames[frame].length; offset += 4) {
        difference += Math.abs(frames[frame][offset] - frames[frame - 1][offset]);
        difference += Math.abs(frames[frame][offset + 1] - frames[frame - 1][offset + 1]);
        difference += Math.abs(frames[frame][offset + 2] - frames[frame - 1][offset + 2]);
        difference += Math.abs(frames[frame][offset + 3] - frames[frame - 1][offset + 3]);
      }
      differences.push(difference / frames[frame].length);
    }
    check(differences.length === 7 && differences.every((value) => value > 1),
      `${id}/${state}: frames consecutivos não possuem variação visual suficiente`);
    animationAudit.push({
      enemy: id,
      state,
      consecutiveFrameDifference: differences.map((value) => Number(value.toFixed(2))),
    });
  }
  try {
    await access(new URL(`../src/game/assets/enemy/concepts/${id}.webp`, import.meta.url));
  } catch {
    failures.push(`${id}: preview ausente`);
  }
}
try {
  await access(new URL("../src/game/assets/chapter07/convoy.png", import.meta.url));
} catch {
  failures.push("convoy.png: asset final ausente");
}
const audioNames = ["engine_loop", "escort_online", "escort_lost", "convoy_attack", "convoy_hit", "convoy_critical",
  "checkpoint", "logistics", "reserve_empty", "reinforcement", "destruction", "evacuation", "frontier_music"];
for (const name of audioNames) {
  try {
    await access(new URL(`../src/game/assets/sfx/c7_${name}.wav`, import.meta.url));
  } catch {
    failures.push(`c7_${name}.wav: áudio ausente`);
  }
}

const report = {
  chapter: chapter?.name,
  phases: phases.length,
  markers: CAMPAIGN_CHAPTER_ROUTES.chapter_07?.length || 0,
  arenas: arenaNames.length,
  finalEnemyFrames: 7 * 3 * 8,
  chapterAudioFiles: audioNames.length,
  ferruginousEnemies: Object.values(ENEMIES).filter((enemy) => enemy.chapterId === "chapter_07").length,
  animationAudit,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
