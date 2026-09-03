import { ENEMIES } from "../content.js";

/**
 * Applies visual/audio/UI reactions to one completed fixed simulation step.
 * Events are traversed exactly once. `once` preserves the previous semantics,
 * where each reaction fired at most once per step even if several matching
 * events were emitted.
 */
export function handleBattleStepEvents(events, {
  audioRef,
  play,
  sessionRef,
  setBanner,
  setMessage,
  setRemoveMode,
  setRepositionTroopId,
  setSelectedTroop,
  settings,
}) {
  const handled = new Set();
  const once = (key, callback) => {
    if (handled.has(key)) return;
    handled.add(key);
    callback();
  };

  for (const event of events) {
    switch (event.type) {
      case "spawn":
        once("spawn", () => play("alert", 0.08));
        break;
      case "convoyUnderAttack":
        once("convoyUnderAttack", () => {
          play("convoyAttack", .34);
          setMessage("TRANSPORTE SOB ATAQUE", { tone: "danger" });
        });
        break;
      case "escortLost":
        once("escortLost", () => setMessage("SEM ESCOLTA · o transporte permanecerá parado", { tone: "warning", persistent: true }));
        break;
      case "escortRestored":
      case "convoyAttackCleared":
        once(event.type, () => setMessage("ESCOLTA RESTAURADA", { tone: "info" }));
        break;
      case "convoyHit":
        once("convoyHit", () => play("convoyHit", .42));
        break;
      case "convoyCritical":
        once("convoyCritical", () => play("convoyCritical", .68));
        break;
      case "checkpointReached":
        once("checkpointReached", () => {
          play("convoyCheckpoint", .72);
          setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
        });
        break;
      case "checkpointPreparation":
        once("checkpointPreparation", () => {
          setSelectedTroop(null);
          setRepositionTroopId(null);
          setRemoveMode(false);
          setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
        });
        break;
      case "energyGenerated":
        if (event.sourceKind === "convoy") once("convoyEnergyGenerated", () => play("convoyLogistics", .24));
        break;
      case "reserveEmpty":
        once("reserveEmpty", () => {
          play("convoyReserveEmpty", .58);
          setMessage("RESERVA ESGOTADA", { tone: "warning" });
        });
        break;
      case "reinforcementWarning":
        once("reinforcementWarning", () => {
          play("convoyReinforcement", .5);
          setMessage("REFORÇOS INIMIGOS", { tone: "danger" });
        });
        break;
      case "convoyDestroyed":
        once("convoyDestroyed", () => play("convoyDestruction", .85));
        break;
      case "convoyEvacuated":
        once("convoyEvacuated", () => play("convoyEvacuation", .85));
        break;
      case "rastejanteBite":
        once("rastejanteBite", () => play("rastejanteBite", .35));
        break;
      case "treeBroodTriggered":
        once("treeBroodTriggered", () => play("treeBroodOpen", .32));
        break;
      case "treeLarvaSpawned":
        once("treeLarvaSpawned", () => play("larvaEmerge", .18));
        break;
      case "enemyDeath":
        if (event.entity?.type === "larvaRaizFerro") once("larvaDeath", () => play("larvaDeath", .12));
        break;
      case "rastejanteFrenzyChanged":
        if (event.frenzyLevel === 2) once("rastejanteFrenzy", () => play("rastejanteFrenzy", .45));
        break;
      case "saltadorJumpStart":
        once("saltadorJumpStart", () => play("saltadorJump", .32));
        break;
      case "saltadorJumpLand":
        once("saltadorJumpLand", () => play("saltadorLand", .28));
        break;
      case "saltadorRasanteImpact":
        once("saltadorRasanteImpact", () => play("saltadorRasante", .42));
        break;
      case "pulseCharging":
        once("pulseCharging", () => play("alert", 0.65));
        break;
      case "shoot":
        if (event.weapon === "icaroBullet") {
          once("icaroBullet", () => play("icaroBurstShot", 0.34));
        } else if (event.weapon !== "icaroInterceptionShot") {
          once("shoot", () => play("shoot", 0.18));
        }
        break;
      case "mantisSpikeImpact":
        once("mantisSpikeImpact", () => play("shoot", 0.12));
        break;
      case "mantisSpikeDetonation":
        once("mantisSpikeDetonation", () => play("melee", 0.24));
        break;
      case "icaroTargetLock":
        once("icaroTargetLock", () => play("icaroInterceptionLock", 0.5));
        break;
      case "icaroInterceptionFire":
        once("icaroInterceptionFire", () => play("icaroInterceptionFire", 0.58));
        break;
      case "troopDeath":
        if (event.entity?.type === "interceptadorIcaro") once("icaroDeath", () => play("icaroDeath", 0.5));
        break;
      case "leviathanChargeStarted":
        once("leviathanChargeStarted", () => play("leviathanCharge", 0.5));
        break;
      case "leviathanFire":
        once("leviathanFire", () => play("leviathanFire", 0.78));
        break;
      case "leviathanImpact":
      case "leviathanSecondImpact":
        once("leviathanImpact", () => play("leviathanImpact", 0.58));
        break;
      case "structuralRuptureApplied":
        once("structuralRuptureApplied", () => play("leviathanRupture", 0.72));
        break;
      case "leviathanCooldownStarted":
        once("leviathanCooldownStarted", () => play("leviathanCooldown", 0.35));
        break;
      case "colossoAwakened":
        once("colossoAwakened", () => {
          setBanner("⚠ COLOSSO DA CALDEIRA");
          play("colossoAwaken", 0.88);
        });
        break;
      case "permanentThermalHazardStarted":
        once("permanentThermalHazardStarted", () => {
          setBanner("⚠ A CALDEIRA ENTROU EM ERUPÇÃO · LINHA FRONTAL INSTÁVEL");
          play("alert", 0.72);
        });
        break;
      case "colossoTelegraph":
        once("colossoTelegraph", () => play({
          rift: "colossoRiftCharge",
          slam: "colossoSlamCharge",
          fracture: "colossoFracture",
          seismic: "colossoSeismicCharge",
        }[event.attack], 0.52));
        break;
      case "colossoAttackImpact":
        once("colossoAttackImpact", () => play({
          rift: "colossoRiftOpen",
          slam: "colossoSlamImpact",
          fracture: "colossoFracture",
          seismic: "colossoSeismicImpact",
          finalCollapse: "colossoFinalCollapse",
        }[event.attack], 0.72));
        break;
      case "colossoPhaseChanged":
        once("colossoPhaseChanged", () => {
          setBanner(event.phase === 2 ? "FASE II · RUPTURA" : "FASE III · COLAPSO");
          play(event.phase === 2 ? "colossoPhase2" : "colossoPhase3", 0.76);
        });
        break;
      case "colossoFinalCollapse":
        once("colossoFinalCollapse", () => {
          setBanner("⚠ COLAPSO DA CALDEIRA");
          play("colossoFinalCollapse", 0.9);
        });
        break;
      case "colossoDeathStarted":
        once("colossoDeathStarted", () => {
          setBanner("NÚCLEO INSTÁVEL · COLOSSO EM COLAPSO");
          play("colossoDeath", 0.84);
        });
        break;
      case "pulseFired":
        once("pulseFired", () => play("shoot", 0.85));
        break;
      case "melee":
        if (event.sourceEnemyId === "larvaRaizFerro") once("larvaAttack", () => play("larvaAttack", .16));
        once("melee", () => play("melee", 0.2));
        break;
      case "ramImpact":
        once("ramImpact", () => play("melee", 0.65));
        break;
      case "duneRipperRoar":
        once("duneRipperRoar", () => play("alert", 0.45));
        break;
      case "executorSlash":
        if (event.combo === 1) once("executorSlash1", () => play("executorSlash1", 0.45));
        if (event.combo === 2) once("executorSlash2", () => play("executorSlash2", 0.5));
        break;
      case "executorFinisher":
        once("executorFinisher", () => play("executorFinisher", 0.7));
        break;
      case "executorComboReset":
        once("executorComboReset", () => play("executorComboReset", 0.25));
        break;
      case "windCurrentWarning":
        once("windCurrentWarning", () => {
          play("windWarning", 0.55);
          play("thunder", 0.18);
        });
        break;
      case "windCurrentStarted":
        once("windCurrentStarted", () => {
          const loopAudio = audioRef.current.windActiveLoop;
          if (loopAudio) {
            loopAudio.currentTime = 0;
            loopAudio.volume = Math.max(0, Math.min(1, settings.masterVolume * settings.effectsVolume * 0.42));
            loopAudio.play().catch(() => {});
          }
        });
        break;
      case "windPrimaryGust":
        once("windPrimaryGust", () => play("windPrimaryGust", 0.78));
        break;
      case "windTroopShifted":
      case "windTroopChainShifted":
      case "windEnemyShifted":
        once("windShift", () => play("windTroopShift", 0.42));
        break;
      case "windTroopEjected":
      case "windTroopEjectedPermanent":
      case "windTroopCollision":
      case "windEnemyEjected":
        once("windEjection", () => play("windEjection", 0.72));
        break;
      case "windCurrentRecovering":
        once("windCurrentRecovering", () => {
          audioRef.current.windActiveLoop?.pause();
          play("windRecovery", 0.48);
        });
        break;
      case "windCurrentEnded":
        once("windCurrentEnded", () => audioRef.current.windActiveLoop?.pause());
        break;
      case "tideWarning":
        once("tideWarning", () => play("alert", 0.52));
        break;
      case "tideHighStarted":
        once("tideHighStarted", () => play("melee", 0.38));
        break;
      case "tideLowStarted":
        once("tideLowStarted", () => play("deploy", 0.24));
        break;
      case "capsuleIncoming":
        once("capsuleIncoming", () => {
          setBanner("OPORTUNIDADE TÁTICA");
          setMessage("Transmissão aliada interceptada. Recursos de emergência disponíveis.");
          play("alert", 0.7);
        });
        break;
      case "capsuleLanded":
        once("capsuleLanded", () => play("melee", 0.45));
        break;
      case "capsuleOpening":
        once("capsuleOpening", () => play("deploy", 0.5));
        break;
      case "bossPhase":
        once("bossPhase", () => {
          const alpha = sessionRef.current.enemies.find((enemy) => enemy.variant === "alpha");
          const alphaName = ENEMIES[alpha?.type]?.label?.toUpperCase() || "ALFA";
          setBanner(`⚠ ${alphaName} ALFA · FASE ${event.phase + 1}`);
        });
        break;
      case "waveComplete":
        once("waveComplete", () => {
          audioRef.current.windActiveLoop?.pause();
          setBanner("PERÍMETRO SEGURO · REORGANIZAÇÃO EM CURSO");
        });
        break;
      default:
        break;
    }
  }
}
