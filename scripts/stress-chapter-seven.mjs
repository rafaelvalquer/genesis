import { PHASES } from "../src/game/content.js";
import {
  createBattleSession,
  getSnapshot,
  placeTroop,
  repositionTroop,
  startWave,
  stepBattle,
} from "../src/game/battleModel.js";
import { buildSectorQueue } from "../src/game/chapter07/convoySpawnDirector.js";
import { acknowledgeConvoyCheckpoint } from "../src/game/chapter07/convoyCheckpoints.js";

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, value] = argument.replace(/^--/, "").split("=");
  return [key, value ?? true];
}));
const seedCount = Math.max(1, Number(args.seeds || 25));
const phases = PHASES.filter((phase) => phase.chapterId === "chapter_07");
if (phases.length !== 8) throw new Error("Capítulo 7 incompleto");

function acceleratedPhase(phase) {
  return {
    ...phase,
    targetDurationMs: 20_000,
    convoy: { ...phase.convoy, targetUninterruptedTravelMs: 4_000 },
    sectors: phase.sectors.map((sector) => ({
      ...sector,
      openingPackets: [],
      reinforcement: { ...sector.reinforcement, warningAtMs: 999_999, startsAtMs: 999_999 },
    })),
  };
}

function finiteSession(session) {
  const values = [session.elapsed, session.energy, session.integrity, session.convoy?.x,
    session.convoy?.hp, session.convoy?.progress, session.convoy?.reserve];
  return values.every(Number.isFinite);
}

function runSeed(phase, seed) {
  for (let sector = 0; sector < 4; sector += 1) {
    if (!buildSectorQueue(phase, sector, seed).every((entry) => entry.row !== 2)) {
      throw new Error(`${phase.id}/seed${seed}: spawn em R3`);
    }
  }

  const session = createBattleSession(acceleratedPhase(phase), ["colono"], seed);
  if (!placeTroop(session, "colono", 1, 1).ok || !placeTroop(session, "colono", 3, 2).ok) {
    throw new Error(`${phase.id}/seed${seed}: falha ao posicionar escolta`);
  }
  if (!startWave(session)) throw new Error(`${phase.id}/seed${seed}: setor inicial não iniciou`);
  let previousProgress = 0;
  let peakQueue = session.queue.length;
  let steps = 0;
  const checkpointCols = [[4, 5], [6, 7], [8, 9]];
  while (!session.outcome && steps < 300) {
    stepBattle(session, 100);
    steps += 1;
    peakQueue = Math.max(peakQueue, session.queue.length);
    if (!finiteSession(session)) throw new Error(`${phase.id}/seed${seed}: NaN/Infinity`);
    if (session.convoy.progress < previousProgress) throw new Error(`${phase.id}/seed${seed}: progresso regrediu`);
    previousProgress = session.convoy.progress;
    if (session.convoy.reserve < 0 || session.convoy.reserve > session.convoy.reserveMax) {
      throw new Error(`${phase.id}/seed${seed}: reserva fora dos limites`);
    }
    if (session.convoyFlow.state === "checkpointDecision") {
      session.convoyFlow.checkpointOptionChosen = true;
      if (!acknowledgeConvoyCheckpoint(session)) {
        throw new Error(`${phase.id}/seed${seed}: checkpoint não foi reconhecido`);
      }
    }
    if (session.convoyFlow.state === "checkpointPreparation") {
      if (session.queue.length) throw new Error(`${phase.id}/seed${seed}: queue vazou no checkpoint`);
      const checkpoint = session.convoyFlow.reachedCheckpointCount - 1;
      const [firstCol, secondCol] = checkpointCols[checkpoint];
      const reposition = (troop, row, preferredCol) => {
        const candidates = [preferredCol, preferredCol + 1, preferredCol - 1, preferredCol + 2, preferredCol - 2];
        return candidates.some((col) => col >= 0 && col < 12 && repositionTroop(session, troop.id, row, col).ok);
      };
      if (!reposition(session.troops[0], 1, firstCol)
        || !reposition(session.troops[1], 3, secondCol)) {
        throw new Error(`${phase.id}/seed${seed}: reposicionamento falhou`);
      }
      if (!startWave(session)) throw new Error(`${phase.id}/seed${seed}: próximo setor não iniciou`);
    }
  }
  if (session.outcome !== "victory") throw new Error(`${phase.id}/seed${seed}: não concluiu (${session.outcome || "timeout"})`);
  const snapshot = getSnapshot(session);
  if (snapshot.convoy.progress !== 1) throw new Error(`${phase.id}/seed${seed}: destino incompleto`);
  return { phaseId: phase.id, seed, steps, peakQueue, reserve: snapshot.convoy.reserve };
}

function runStallProbe() {
  const phase = acceleratedPhase(phases[0]);
  const session = createBattleSession(phase, ["colono"], 70049);
  startWave(session);
  let peakEntities = 0;
  for (let elapsed = 0; elapsed < 600_000; elapsed += 100) {
    stepBattle(session, 100);
    peakEntities = Math.max(peakEntities, session.enemies.length + session.queue.length + session.projectiles.length);
    if (!finiteSession(session)) throw new Error("stall 10min: NaN/Infinity");
    if (session.convoy.progress < 0 || session.convoy.progress > 1) throw new Error("stall 10min: progresso inválido");
  }
  if (peakEntities > 0) throw new Error(`stall 10min: crescimento de entidades (${peakEntities})`);
  return { durationMs: session.elapsed, peakEntities, progress: session.convoy.progress, reserve: session.convoy.reserve };
}

const reports = [];
for (let seed = 1; seed <= seedCount; seed += 1) {
  for (const phase of phases) reports.push(runSeed(phase, seed));
}
const deterministicA = runSeed(phases[7], 56007);
const deterministicB = runSeed(phases[7], 56007);
if (JSON.stringify(deterministicA) !== JSON.stringify(deterministicB)) throw new Error("stress não determinístico");

console.log(JSON.stringify({
  seeds: seedCount,
  scenarios: reports.length,
  maxSteps: Math.max(...reports.map((report) => report.steps)),
  maxQueue: Math.max(...reports.map((report) => report.peakQueue)),
  deterministic: true,
  stall10Minutes: runStallProbe(),
}, null, 2));
