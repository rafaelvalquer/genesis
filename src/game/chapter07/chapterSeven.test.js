import { describe, expect, it } from "vitest";
import { CHAPTERS, PHASES, TROOPS } from "../content.js";
import { buildSpawnQueue, choosePacketRows, createRng } from "../domain.js";
import { canPlaceTroop, createBattleSession, FIELD, getSnapshot, getTroopDeploymentLimit, placeTroop, repositionTroop, setEnergyPickupPointer, startWave, stepBattle, updateEnergyPickups, validateLoadoutForPhase } from "../battleModel.js";
import { getAvailableTroopsForPhase, getCombatRows, getDefaultTroopDeploymentLimit, isSystemEnabledForPhase, isTroopAllowedForPhase, sanitizeLoadoutForPhase } from "../phaseRules.js";
import { buildSectorQueue, updateConvoyReinforcements } from "./convoySpawnDirector.js";
import { damageConvoy } from "./convoyDamage.js";
import { refillConvoyReserve, updateConvoyEnergy } from "./convoyEnergy.js";
import { getEscortTroops, isEscortOperational, updateConvoyEscort } from "./convoyEscort.js";
import { calculateConvoyStars } from "./convoyScoring.js";
import { createBattleAudioChannels } from "../hooks/useBattleAudio.js";
import { acknowledgeConvoyCheckpoint, enterCheckpointClearing, enterCheckpointPreparation } from "./convoyCheckpoints.js";
import { advanceConvoyMovement, advanceConvoySectorCountdown, startConvoySectorCountdown } from "./convoyFlow.js";
import { getConvoyColumn } from "./convoyGeometry.js";
import { getConvoyEntryX, getConvoyRouteStartX } from "./convoyGeometry.js";
import { StrategicAgent } from "../simulation/ai/StrategicAgent.js";

const phase49 = PHASES.find((phase) => phase.id === "fase_49");
const phase56 = PHASES.find((phase) => phase.id === "fase_56");

describe("Chapter 7 structural contract", () => {
  it("ships final roster, convoy and audio assets", () => {
    const enemyFrames = import.meta.glob("../assets/enemy/{legionaroFerrugem,saqueadorEscoria,couracadoHematita,cacadorComboio,sabotadorOxido,atiradorRavina,marechalForja}/{idle,walking,attack}/frame*.png");
    const concepts = import.meta.glob("../assets/enemy/concepts/{legionaroFerrugem,saqueadorEscoria,couracadoHematita,cacadorComboio,sabotadorOxido,atiradorRavina,marechalForja}.webp");
    const audio = import.meta.glob("../assets/sfx/c7_*.wav");
    const convoy = import.meta.glob("../assets/chapter07/convoy.png");
    expect(Object.keys(enemyFrames)).toHaveLength(168);
    expect(Object.keys(concepts)).toHaveLength(7);
    expect(Object.keys(audio)).toHaveLength(13);
    expect(Object.keys(convoy)).toHaveLength(1);
  });
  it("maps every convoy cue and keeps the engine and music as resumable loops", () => {
    const PreviousAudio = globalThis.Audio;
    class FakeAudio {
      constructor(url) { this.url = url; this.loop = false; this.paused = true; }
      pause() { this.paused = true; }
      play() { this.paused = false; return Promise.resolve(); }
      cloneNode() { return new FakeAudio(this.url); }
    }
    globalThis.Audio = FakeAudio;
    try {
      const names = ["engine_loop", "escort_online", "escort_lost", "convoy_attack", "convoy_hit", "convoy_critical",
        "checkpoint", "logistics", "reserve_empty", "reinforcement", "destruction", "evacuation", "frontier_music"];
      const assets = { audio: Object.fromEntries(names.map((name) => [`c7_${name}.wav`, `/audio/c7_${name}.wav`])) };
      const channels = createBattleAudioChannels(assets, "chapter_07");
      for (const channel of ["convoyEngineLoop", "convoyEscort", "convoyEscortLost", "convoyAttack", "convoyHit",
        "convoyCritical", "convoyCheckpoint", "convoyLogistics", "convoyReserveEmpty", "convoyReinforcement",
        "convoyDestruction", "convoyEvacuation", "theme"]) expect(channels[channel]).toBeTruthy();
      expect(channels.theme.loop).toBe(true);
    } finally {
      globalThis.Audio = PreviousAudio;
    }
  });
  it("registers chapter 7 and eight convoy phases", () => {
    expect(CHAPTERS).toHaveLength(7);
    expect(CHAPTERS.at(-1).phaseIds).toEqual(Array.from({ length: 8 }, (_, index) => `fase_${49 + index}`));
    for (const phase of PHASES.slice(48)) {
      expect(phase.progressionMode).toBe("convoy");
      expect(phase.sectors).toHaveLength(4);
      expect(phase.convoy.checkpointProgress).toEqual([.25, .5, .75]);
    }
  });

  it("centralizes C7 rules without changing older phases", () => {
    expect(getCombatRows(phase49)).toEqual([0, 1, 3, 4]);
    expect(getCombatRows(PHASES[0])).toEqual([0, 1, 2, 3, 4]);
    expect(isTroopAllowedForPhase(phase49, "reator")).toBe(false);
    expect(isTroopAllowedForPhase(phase49, "thermalPlatform")).toBe(false);
    expect(isTroopAllowedForPhase(phase49, "colono")).toBe(true);
    expect(getDefaultTroopDeploymentLimit(phase49)).toBe(4);
    expect(getTroopDeploymentLimit("colono", phase49)).toBe(4);
    expect(getTroopDeploymentLimit("colono", PHASES[0])).toBe(5);
    expect(isSystemEnabledForPhase(phase49, "enemyEnergyPickups")).toBe(false);
    expect(getAvailableTroopsForPhase(phase49, 48).some((troop) => troop.id === "reator")).toBe(false);
  });

  it("rejects invalid loadouts and R3 placement in the engine", () => {
    expect(validateLoadoutForPhase(phase49, ["colono", "reator"]).ok).toBe(false);
    const session = createBattleSession(phase49, ["colono"], 7);
    expect(canPlaceTroop(session, "colono", 2, 4)).toBe("Rota exclusiva do transporte.");
  });

  it("obeys the disabled dematerialization contract across the full stack", () => {
    const convoySession = createBattleSession(phase49, ["colono"], 18);
    const legacySession = createBattleSession(PHASES[0], ["colono"], 18);
    expect(convoySession.dematerializationPulses).toEqual([]);
    expect(legacySession.dematerializationPulses).toHaveLength(FIELD.rows);
  });

  it("holds the checkpoint briefing until the player acknowledges it", () => {
    const session = createBattleSession(phase49, ["colono"], 19);
    session.convoyFlow.state = "checkpointClearing";
    session.convoyFlow.reachedCheckpointCount = 1;
    expect(enterCheckpointPreparation(session)).toBe(true);
    expect(session.convoyFlow.checkpointBriefingPending).toBe(true);
    expect(acknowledgeConvoyCheckpoint(session)).toBe(true);
    expect(session.convoyFlow.checkpointBriefingPending).toBe(false);
  });
});

describe("Chapter 7 spawn invariants", () => {
  it("sanitizes every route strategy", () => {
    for (const strategy of ["focused", "split", "spread", "scripted"]) {
      const rows = choosePacketRows({ strategy, rng: createRng(1), fixedRows: strategy === "scripted" ? [0, 2, 3] : null, allowedRows: [0, 1, 3, 4] });
      expect(rows).not.toContain(2);
    }
  });

  it("never spawns in R3 across 10,000 seeds", () => {
    for (let seed = 1; seed <= 10000; seed += 1) {
      for (let sector = 0; sector < 4; sector += 1) {
        expect(buildSectorQueue(phase49, sector, seed).every((entry) => entry.row !== 2)).toBe(true);
      }
    }
  }, 60000);

  it("preserves legacy wave routing", () => {
    expect(buildSpawnQueue(PHASES[0], 0, 1).every((entry) => entry.row == null || entry.row >= 0 && entry.row < 5)).toBe(true);
  });
});

describe("Convoy systems", () => {
  it("counts only operational escorts in R2/R4 and one drone stack once", () => {
    const session = createBattleSession(phase49, ["colono", "droneSentinela", "medicaNanites"], 2);
    const candidates = [
      { id: "a", type: "colono", row: 1, col: 1, hp: 10 },
      { id: "b", type: "colono", row: 0, col: 1, hp: 10 },
      { id: "c", type: "droneSentinela", row: 3, col: 1, hp: 10, droneCount: 3 },
      { id: "d", type: "medicaNanites", row: 3, col: 1, hp: 10, controlStunnedUntil: 99 },
    ];
    session.troops = candidates;
    expect(isEscortOperational(candidates[0], session)).toBe(true);
    expect(isEscortOperational(candidates[3], session)).toBe(false);
    expect(getEscortTroops(session).map((troop) => troop.id)).toEqual(["a", "c"]);
    updateConvoyEscort(session);
    expect(session.convoy.escortTroopIds).toHaveLength(2);
  });

  it("moves at one fixed speed and stops without escort or while attacked", () => {
    const fast = { ...phase49, convoy: { ...phase49.convoy, targetUninterruptedTravelMs: 4000 }, sectors: phase49.sectors.map((sector) => ({ ...sector, openingPackets: [], reinforcement: { ...sector.reinforcement, warningAtMs: 999999, startsAtMs: 999999 } })) };
    const session = createBattleSession(fast, ["colono"], 3);
    expect(placeTroop(session, "colono", 1, 2).ok).toBe(true);
    expect(startWave(session)).toBe(true);
    expect(session.convoy.x).toBe(getConvoyEntryX());
    expect(session.convoy.entryState).toBe("entering");
    stepBattle(session, 2300);
    expect(session.convoy.entryState).toBe("active");
    expect(session.convoy.progress).toBe(0);
    const before = session.convoy.x;
    stepBattle(session, 100);
    expect(session.convoy.x).toBeGreaterThan(before);
    session.troops[0].dead = true;
    const stopped = session.convoy.x;
    stepBattle(session, 100);
    expect(session.convoy.x).toBe(stopped);
  });

  it("applies logistics precisely and refill once", () => {
    const session = createBattleSession(phase49, ["colono"], 4);
    session.convoyFlow.state = "sectorActive";
    session.energy = 100; session.elapsed = 5000; session.convoy.nextEnergyPulseAt = 5000;
    updateConvoyEnergy(session);
    expect(session.energy).toBe(100); expect(session.convoy.reserve).toBe(77);
    expect(session.energyPickups.filter((pickup) => pickup.sourceKind === "convoy")).toHaveLength(3);
    session.energy = 200; session.elapsed = 10000; updateConvoyEnergy(session);
    expect(session.convoy.reserve).toBe(77);
    session.convoy.reserve = 20;
    expect(refillConvoyReserve(session, 0)).toBe(50);
    expect(refillConvoyReserve(session, 0)).toBe(0);
    expect(session.convoy.reserve).toBe(70);
  });

  it("releases convoy energy as collectible pickups and credits only on collection", () => {
    const session = createBattleSession(phase49, ["colono"], 41);
    session.convoyFlow.state = "sectorActive";
    session.energy = 100;
    session.elapsed = 5000;
    session.convoy.nextEnergyPulseAt = 5000;
    updateConvoyEnergy(session);
    const pickup = session.energyPickups.find((entry) => entry.sourceKind === "convoy");
    session.energyPickups.filter((entry) => entry !== pickup).forEach((entry, index) => { entry.x += 100 + index * 20; });
    expect(session.energy).toBe(100);
    setEnergyPickupPointer(session, { x: pickup.x, y: pickup.y });
    updateEnergyPickups(session, 1, []);
    expect(session.energy).toBe(101);
    expect(session.energyPickups).toHaveLength(2);
  });

  it("handles damage, defeat scoring and objective scoring", () => {
    const session = createBattleSession(phase49, ["colono"], 5);
    expect(damageConvoy(session, 100)).toBe(100);
    session.convoy.invulnerable = true;
    expect(damageConvoy(session, 100)).toBe(0);
    expect(calculateConvoyStars({ outcome: "victory", convoyHp: 800, convoyMaxHp: 1000, durationMs: 100, targetDurationMs: 200 })).toBe(3);
    expect(calculateConvoyStars({ outcome: "victory", convoyHp: 500, convoyMaxHp: 1000, durationMs: 300, targetDurationMs: 200 })).toBe(1);
    expect(calculateConvoyStars({ outcome: "defeat", convoyHp: 1000, convoyMaxHp: 1000, durationMs: 1, targetDurationMs: 2 })).toBe(0);
  });

  it("runs all four sectors, three checkpoints and manual restarts to victory", () => {
    const fast = { ...phase49, targetDurationMs: 20000, convoy: { ...phase49.convoy, targetUninterruptedTravelMs: 4000 }, sectors: phase49.sectors.map((sector) => ({ ...sector, openingPackets: [], reinforcement: { ...sector.reinforcement, warningAtMs: 999999, startsAtMs: 999999 } })) };
    const session = createBattleSession(fast, ["colono"], 6);
    placeTroop(session, "colono", 1, 1); placeTroop(session, "colono", 3, 2); startWave(session);
    const checkpointCols = [[4, 5], [6, 7], [8, 9]];
    for (let checkpoint = 0; checkpoint < 3; checkpoint += 1) {
      for (let guard = 0; guard < 100 && session.convoyFlow.state !== "checkpointPreparation"; guard += 1) stepBattle(session, 100);
      expect(session.convoyFlow.state).toBe("checkpointPreparation");
      const troop = session.troops[0];
      const hp = troop.hp; const ready = troop.attackReadyAt; const id = troop.id;
      expect(repositionTroop(session, troop.id, 1, checkpointCols[checkpoint][0]).ok).toBe(true);
      expect(repositionTroop(session, session.troops[1].id, 3, checkpointCols[checkpoint][1]).ok).toBe(true);
      expect(troop).toMatchObject({ id, hp, attackReadyAt: ready });
      expect(startWave(session)).toBe(true);
    }
    for (let guard = 0; guard < 30 && !session.outcome; guard += 1) stepBattle(session, 100);
    expect(session.outcome).toBe("victory");
    expect(getSnapshot(session).convoy.progress).toBe(1);
  });

  it("scenario B: a stalled convoy keeps logistics and reinforcement running, then resumes with escort", () => {
    const session = createBattleSession(phase49, ["colono"], 71);
    startWave(session);
    const beforeX = session.convoy.x;
    session.energy = 100;
    session.elapsed = session.convoy.nextEnergyPulseAt;
    updateConvoyEnergy(session);
    expect(session.convoy.x).toBe(beforeX);
    expect(session.energy).toBe(100);
    const director = session.convoyFlow.spawnDirector;
    session.elapsed = session.convoyFlow.sectorStartedAt + phase49.sectors[0].reinforcement.startsAtMs;
    director.nextReinforcementAt = session.elapsed;
    const events = [];
    updateConvoyReinforcements(session, events);
    expect(events.some((event) => event.type === "reinforcementQueued")).toBe(true);
    placeTroop(session, "colono", 1, 1);
    updateConvoyEscort(session);
    advanceConvoyMovement(session, 100);
    expect(session.convoy.x).toBeGreaterThan(beforeX);
  });

  it("never reserves or arms Demolidora mines in the transport row across 10,000 seeds", () => {
    for (let seed = 0; seed < 10000; seed += 1) {
      const session = createBattleSession(phase49, ["demolidora"], seed, { sandbox: true });
      expect(placeTroop(session, "demolidora", 1, 1).ok).toBe(true);
      stepBattle(session, 1);
      expect(session.projectiles
        .filter((entry) => entry.kind === "mine")
        .every((entry) => entry.targetRow !== 2)).toBe(true);
      stepBattle(session, 650);
      expect(session.mines.every((mine) => mine.row !== 2)).toBe(true);
    }
  }, 60000);

  it("starts each convoy sector through a visual countdown without advancing simulation time", () => {
    const session = createBattleSession(phase49, ["colono"], 81);
    const elapsed = session.elapsed;
    expect(startConvoySectorCountdown(session)).toBe(true);
    expect(session.convoyFlow.state).toBe("sectorCountdown");
    expect(session.elapsed).toBe(elapsed);
    const events = [];
    advanceConvoySectorCountdown(session, 800, events);
    expect(session.convoyFlow.state).toBe("sectorCountdown");
    expect(session.elapsed).toBe(elapsed);
    advanceConvoySectorCountdown(session, 1600, events);
    expect(session.convoyFlow.state).toBe("sectorActive");
    expect(session.elapsed).toBe(elapsed);
    expect(events.some((event) => event.type === "convoyCountdownGo")).toBe(true);
  });

  it("holds checkpoint preparation until the 2.3 second cinematic completes", () => {
    const session = createBattleSession(phase49, ["colono"], 82);
    session.convoyFlow.state = "checkpointClearing";
    session.convoyFlow.reachedCheckpointCount = 1;
    session.enemies = [];
    const events = stepBattle(session, 32);
    expect(events.some((event) => event.type === "checkpointCinematicStarted")).toBe(true);
    expect(session.convoyFlow.state).toBe("checkpointCinematic");
    expect(session.convoyFlow.checkpointCinematic.elapsedMs).toBe(0);
    for (let elapsed = 0; elapsed < 2200; elapsed += 100) {
      stepBattle(session, 100);
      expect(session.convoyFlow.state).toBe("checkpointCinematic");
    }
    stepBattle(session, 100);
    expect(session.convoyFlow.state).toBe("checkpointPreparation");
    expect(session.convoyFlow.checkpointBriefingPending).toBe(true);
  });

  it("freezes convoy pickup lifetime during cinematic and mandatory briefing", () => {
    const session = createBattleSession(phase49, ["colono"], 83);
    session.convoyFlow.state = "checkpointPreparation";
    session.energyPickups = [{ id: "convoy-pickup", x: 200, y: 200, vx: 0, vy: 0, amount: 1, ageMs: 9999, sourceKind: "convoy" }];
    stepBattle(session, 1000);
    expect(session.energyPickups[0].ageMs).toBe(9999);
    session.convoyFlow.state = "sectorActive";
    stepBattle(session, 1000);
    expect(session.energyPickups).toHaveLength(0);
  });

  it("scenario C: checkpoint clearing cannot advance while a combat threat remains", () => {
    const session = createBattleSession(phase49, ["colono"], 72);
    session.enemies = [{ id: "threat", type: "legionaroFerrugem", hp: 1, dead: false }];
    enterCheckpointClearing(session, 0);
    expect(enterCheckpointPreparation(session)).toBe(false);
    expect(session.convoyFlow.state).toBe("checkpointClearing");
    session.enemies[0].dead = true;
    expect(enterCheckpointPreparation(session)).toBe(true);
    expect(session.convoyFlow.state).toBe("checkpointPreparation");
  });

  it("scenarios D/E: convoy zero and base zero produce defeat", () => {
    const convoyDefeat = createBattleSession(phase49, ["colono"], 73);
    startWave(convoyDefeat);
    convoyDefeat.convoy.hp = 0;
    stepBattle(convoyDefeat, 16);
    expect(convoyDefeat.outcome).toBeNull();
    expect(convoyDefeat.pendingOutcome).toBe("defeat");
    expect(convoyDefeat.convoyFlow.state).toBe("destroying");
    for (let guard = 0; guard < 110 && !convoyDefeat.outcome; guard += 1) stepBattle(convoyDefeat, 16);
    expect(convoyDefeat.outcome).toBe("defeat");
    const baseDefeat = createBattleSession(phase49, ["colono"], 74);
    startWave(baseDefeat);
    baseDefeat.integrity = 0;
    stepBattle(baseDefeat, 16);
    expect(baseDefeat.outcome).toBe("defeat");
  });

  it("scenario F: a living boss does not block destination victory", () => {
    const session = createBattleSession(phase49, ["colono"], 75);
    session.convoyFlow.state = "sectorActive";
    session.convoyFlow.sectorIndex = 3;
    session.convoy.entryState = "active";
    session.convoy.escorted = true;
    session.convoy.x = session.convoy.destinationX - session.convoy.speedPxPerSecond;
    session.enemies = [{ id: "boss", type: "marechalForja", hp: 9999, dead: false }];
    expect(advanceConvoyMovement(session, 1000)).toBe("victory");
    expect(session.enemies[0].dead).toBe(false);
  });

  it("scenario G: a saved Reactor loadout is sanitized", () => {
    expect(sanitizeLoadoutForPhase(phase49, ["reator", "colono", "thermalPlatform", "droneSentinela"]))
      .toEqual(["colono", "droneSentinela"]);
  });

  it("scenario H: checkpoint preparation removes mines, mine projectiles and reservations", () => {
    const session = createBattleSession(phase49, ["colono"], 76);
    session.mines = [{ id: "mine" }];
    session.projectiles = [{ id: "mine-shot", kind: "mine" }, { id: "bullet", kind: "bullet" }];
    session.mineReservations = [{ row: 1, col: 1 }];
    enterCheckpointClearing(session, 0);
    expect(enterCheckpointPreparation(session)).toBe(true);
    expect(session.mines).toEqual([]);
    expect(session.projectiles).toEqual([{ id: "bullet", kind: "bullet" }]);
    expect(session.mineReservations).toEqual([]);
  });

  it("keeps a boss hunter settled at the final checkpoint instead of oscillating", () => {
    const session = createBattleSession(phase56, ["cacadorLeviatas", "colono", "droneSentinela", "sniper"], 77);
    const col = getConvoyColumn(session.convoy);
    const firingCol = FIELD.firstTroopCol + 3;
    session.convoyFlow.state = "checkpointPreparation";
    session.convoyFlow.reachedCheckpointCount = 3;
    session.troops = [
      { id: "hunter", type: "cacadorLeviatas", row: 0, col: firingCol, hp: 100, dead: false },
      { id: "lane-shot", type: "sniper", row: 1, col: firingCol, hp: 100, dead: false },
      { id: "escort-a", type: "colono", row: 1, col: Math.min(FIELD.lastTroopCol, col + 1), hp: 100, dead: false },
      { id: "escort-b", type: "droneSentinela", row: 3, col: Math.min(FIELD.lastTroopCol, col + 1), hp: 100, dead: false },
    ];
    const agent = new StrategicAgent({ phase: phase56, phaseForecast: {}, profile: {}, config: {} });
    expect(agent.planConvoyReposition(session)).toEqual([
      expect.objectContaining({ type: "startWave", reason: "convoyCheckpointReady" }),
    ]);
  });
});
