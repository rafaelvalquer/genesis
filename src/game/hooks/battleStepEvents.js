import { ENEMIES } from "../content.js";

/** Applies visual and audio reactions to one completed fixed simulation step. */
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
  if (events.some((event) => event.type === "spawn")) play("alert", 0.08);
  if (events.some((event) => event.type === "convoyUnderAttack")) play("convoyAttack", .34);
  if (events.some((event) => event.type === "convoyUnderAttack")) setMessage("TRANSPORTE SOB ATAQUE", { tone: "danger" });
  if (events.some((event) => event.type === "escortLost")) setMessage("SEM ESCOLTA · o transporte permanecerá parado", { tone: "warning", persistent: true });
  if (events.some((event) => event.type === "escortRestored")) setMessage("ESCOLTA RESTAURADA", { tone: "info" });
  if (events.some((event) => event.type === "convoyAttackCleared")) setMessage("ESCOLTA RESTAURADA", { tone: "info" });
  if (events.some((event) => event.type === "convoyHit")) play("convoyHit", .42);
  if (events.some((event) => event.type === "convoyCritical")) play("convoyCritical", .68);
  if (events.some((event) => event.type === "checkpointReached")) play("convoyCheckpoint", .72);
  if (events.some((event) => event.type === "checkpointReached")) setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
  if (events.some((event) => event.type === "checkpointPreparation")) {
    setSelectedTroop(null);
    setRepositionTroopId(null);
    setRemoveMode(false);
    setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
  }
  if (events.some((event) => event.type === "energyGenerated" && event.sourceKind === "convoy")) play("convoyLogistics", .24);
  if (events.some((event) => event.type === "reserveEmpty")) play("convoyReserveEmpty", .58);
  if (events.some((event) => event.type === "reserveEmpty")) setMessage("RESERVA ESGOTADA", { tone: "warning" });
  if (events.some((event) => event.type === "reinforcementWarning")) play("convoyReinforcement", .5);
  if (events.some((event) => event.type === "reinforcementWarning")) setMessage("REFORÇOS INIMIGOS", { tone: "danger" });
  if (events.some((event) => event.type === "convoyDestroyed")) play("convoyDestruction", .85);
  if (events.some((event) => event.type === "convoyEvacuated")) play("convoyEvacuation", .85);
  if (events.some((event) => event.type === "rastejanteBite")) play("rastejanteBite", .35);
  if (events.some((event) => event.type === "treeBroodTriggered")) play("treeBroodOpen", .32);
  if (events.some((event) => event.type === "treeLarvaSpawned")) play("larvaEmerge", .18);
  if (events.some((event) => event.type === "melee" && event.sourceEnemyId === "larvaRaizFerro")) play("larvaAttack", .16);
  if (events.some((event) => event.type === "enemyDeath" && event.entity?.type === "larvaRaizFerro")) play("larvaDeath", .12);
  if (events.some((event) => event.type === "rastejanteFrenzyChanged" && event.frenzyLevel === 2)) play("rastejanteFrenzy", .45);
  if (events.some((event) => event.type === "saltadorJumpStart")) play("saltadorJump", .32);
  if (events.some((event) => event.type === "saltadorJumpLand")) play("saltadorLand", .28);
  if (events.some((event) => event.type === "saltadorRasanteImpact")) play("saltadorRasante", .42);
  if (events.some((event) => event.type === "pulseCharging")) play("alert", 0.65);
  if (events.some((event) => event.type === "shoot" && !["icaroBullet", "icaroInterceptionShot"].includes(event.weapon))) play("shoot", 0.18);
  if (events.some((event) => event.type === "shoot" && event.weapon === "icaroBullet")) play("icaroBurstShot", 0.34);
  if (events.some((event) => event.type === "mantisSpikeImpact")) play("shoot", 0.12);
  if (events.some((event) => event.type === "mantisSpikeDetonation")) play("melee", 0.24);
  if (events.some((event) => event.type === "icaroTargetLock")) play("icaroInterceptionLock", 0.5);
  if (events.some((event) => event.type === "icaroInterceptionFire")) play("icaroInterceptionFire", 0.58);
  if (events.some((event) => event.type === "troopDeath" && event.entity?.type === "interceptadorIcaro")) play("icaroDeath", 0.5);
  if (events.some((event) => event.type === "leviathanChargeStarted")) play("leviathanCharge", 0.5);
  if (events.some((event) => event.type === "leviathanFire")) play("leviathanFire", 0.78);
  if (events.some((event) => ["leviathanImpact", "leviathanSecondImpact"].includes(event.type))) play("leviathanImpact", 0.58);
  if (events.some((event) => event.type === "structuralRuptureApplied")) play("leviathanRupture", 0.72);
  if (events.some((event) => event.type === "leviathanCooldownStarted")) play("leviathanCooldown", 0.35);
  if (events.some((event) => event.type === "colossoAwakened")) {
    setBanner("⚠ COLOSSO DA CALDEIRA");
    play("colossoAwaken", 0.88);
  }
  if (events.some((event) => event.type === "permanentThermalHazardStarted")) {
    setBanner("⚠ A CALDEIRA ENTROU EM ERUPÇÃO · LINHA FRONTAL INSTÁVEL");
    play("alert", 0.72);
  }
  const colossoTelegraph = events.find((event) => event.type === "colossoTelegraph");
  if (colossoTelegraph) play({ rift: "colossoRiftCharge", slam: "colossoSlamCharge", fracture: "colossoFracture", seismic: "colossoSeismicCharge" }[colossoTelegraph.attack], 0.52);
  const colossoImpact = events.find((event) => event.type === "colossoAttackImpact");
  if (colossoImpact) play({ rift: "colossoRiftOpen", slam: "colossoSlamImpact", fracture: "colossoFracture", seismic: "colossoSeismicImpact", finalCollapse: "colossoFinalCollapse" }[colossoImpact.attack], 0.72);
  const colossoPhaseEvent = events.find((event) => event.type === "colossoPhaseChanged");
  if (colossoPhaseEvent) {
    setBanner(colossoPhaseEvent.phase === 2 ? "FASE II · RUPTURA" : "FASE III · COLAPSO");
    play(colossoPhaseEvent.phase === 2 ? "colossoPhase2" : "colossoPhase3", 0.76);
  }
  if (events.some((event) => event.type === "colossoFinalCollapse")) {
    setBanner("⚠ COLAPSO DA CALDEIRA");
    play("colossoFinalCollapse", 0.9);
  }
  if (events.some((event) => event.type === "colossoDeathStarted")) {
    setBanner("NÚCLEO INSTÁVEL · COLOSSO EM COLAPSO");
    play("colossoDeath", 0.84);
  }
  if (events.some((event) => event.type === "pulseFired")) play("shoot", 0.85);
  if (events.some((event) => event.type === "melee")) play("melee", 0.2);
  if (events.some((event) => event.type === "ramImpact")) play("melee", 0.65);
  if (events.some((event) => event.type === "duneRipperRoar")) play("alert", 0.45);
  if (events.some((event) => event.type === "executorSlash" && event.combo === 1)) play("executorSlash1", 0.45);
  if (events.some((event) => event.type === "executorSlash" && event.combo === 2)) play("executorSlash2", 0.5);
  if (events.some((event) => event.type === "executorFinisher")) play("executorFinisher", 0.7);
  if (events.some((event) => event.type === "executorComboReset")) play("executorComboReset", 0.25);
  if (events.some((event) => event.type === "windCurrentWarning")) {
    play("windWarning", 0.55);
    play("thunder", 0.18);
  }
  if (events.some((event) => event.type === "windCurrentStarted")) {
    const loopAudio = audioRef.current.windActiveLoop;
    if (loopAudio) {
      loopAudio.currentTime = 0;
      loopAudio.volume = Math.max(0, Math.min(1,
        settings.masterVolume * settings.effectsVolume * 0.42));
      loopAudio.play().catch(() => {});
    }
  }
  if (events.some((event) => event.type === "windPrimaryGust")) play("windPrimaryGust", 0.78);
  if (events.some((event) => event.type === "windTroopShifted"
    || event.type === "windTroopChainShifted"
    || event.type === "windEnemyShifted")) play("windTroopShift", 0.42);
  if (events.some((event) => event.type === "windTroopEjected"
    || event.type === "windTroopEjectedPermanent"
    || event.type === "windTroopCollision"
    || event.type === "windEnemyEjected")) play("windEjection", 0.72);
  if (events.some((event) => event.type === "windCurrentRecovering")) {
    audioRef.current.windActiveLoop?.pause();
    play("windRecovery", 0.48);
  }
  if (events.some((event) => event.type === "windCurrentEnded")) {
    audioRef.current.windActiveLoop?.pause();
  }
  if (events.some((event) => event.type === "tideWarning")) play("alert", 0.52);
  if (events.some((event) => event.type === "tideHighStarted")) play("melee", 0.38);
  if (events.some((event) => event.type === "tideLowStarted")) play("deploy", 0.24);
  if (events.some((event) => event.type === "capsuleIncoming")) {
    setBanner("OPORTUNIDADE TÁTICA");
    setMessage("Transmissão aliada interceptada. Recursos de emergência disponíveis.");
    play("alert", 0.7);
  }
  if (events.some((event) => event.type === "capsuleLanded")) play("melee", 0.45);
  if (events.some((event) => event.type === "capsuleOpening")) play("deploy", 0.5);
  const phaseEvent = events.find((event) => event.type === "bossPhase");
  if (phaseEvent) {
    const alpha = sessionRef.current.enemies.find((enemy) => enemy.variant === "alpha");
    const alphaName = ENEMIES[alpha?.type]?.label?.toUpperCase() || "ALFA";
    setBanner(`⚠ ${alphaName} ALFA · FASE ${phaseEvent.phase + 1}`);
  }
  if (events.some((event) => event.type === "waveComplete")) {
    audioRef.current.windActiveLoop?.pause();
    setBanner("PERÍMETRO SEGURO · REORGANIZAÇÃO EM CURSO");
  }
}

