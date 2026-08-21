function increment(
  object,
  key,
  amount = 1,
) {
  object[key] = (
    Number(object[key]) || 0
  ) + amount;
}

function eventAmount(event) {
  return Number(
    event.amount
    ?? event.damage
    ?? 0,
  ) || 0;
}

export class SimulationMetrics {
  constructor({
    phase,
    seed,
    strategyId,
    loadout,
    actionLogLimit = 600,
  }) {
    this.phaseId = phase.id;
    this.chapterId = (
      phase.chapterId
      || null
    );
    this.seed = seed;
    this.strategyId = strategyId;
    this.loadout = [...loadout];
    this.actionLogLimit = actionLogLimit;

    this.startedAt = Date.now();
    this.completedAt = null;
    this.wallDurationMs = 0;

    this.steps = 0;
    this.agentTicks = 0;
    this.validationChecks = 0;

    this.events = {};
    this.eventDamage = {};
    this.actions = [];
    this.actionFailures = [];

    this.deployments = 0;
    this.removals = 0;
    this.replacements = 0;
    this.specialsUsed = 0;
    this.decisionsSelected = 0;
    this.adaptiveAidSelections = 0;
    this.pulseActivations = 0;
    this.pulseAiActivations = 0;
    this.pulseAutomaticActivations = 0;
    this.pulseDamage = 0;
    this.pulseKills = 0;
    this.pulseDamageByRow = {};

    this.enemyDeaths = 0;
    this.troopDeaths = 0;
    this.baseBreaches = 0;
    this.energyGenerated = 0;
    this.energyCollected = 0;
    this.thermalPlatformDeployments = 0;
    this.thermalPlatformDestroyed = 0;
    this.thermalBurnEvents = 0;
    this.thermalPlatformRescues = 0;
    this.maximumPlatformHeat = 0;
    this.averagePlatformHeat = 0;
    this.thermalBurnDamage = 0;
    this.thermalTroopsLost = 0;
    this.eruptionCount = 0;

    this.peakEnemies = 0;
    this.peakTroops = 0;
    this.peakProjectiles = 0;
    this.peakEnemyProjectiles = 0;
    this.peakMines = 0;
    this.peakActiveEntities = 0;

    this.waveCompletionTimes = [];
    this.lastWaveCompletedAt = null;
    this.lostCells = new Set();
    this.invalidState = null;
    this.deadlock = null;
    this.timeout = false;
  }

  recordStep(session) {
    this.steps += 1;

    this.peakEnemies = Math.max(
      this.peakEnemies,
      session.enemies.length,
    );

    this.peakTroops = Math.max(
      this.peakTroops,
      session.troops.length,
    );

    this.peakProjectiles = Math.max(
      this.peakProjectiles,
      session.projectiles.length,
    );

    this.peakEnemyProjectiles = Math.max(
      this.peakEnemyProjectiles,
      session.enemyProjectiles.length,
    );

    this.peakMines = Math.max(
      this.peakMines,
      session.mines.length,
    );

    this.peakActiveEntities = Math.max(
      this.peakActiveEntities,
      session.enemies.length
      + session.troops.length
      + session.projectiles.length
      + session.enemyProjectiles.length
      + session.mines.length,
    );
    const thermalPlatforms = session.supportStructures || [];
    if (thermalPlatforms.length) this.maximumPlatformHeat = Math.max(this.maximumPlatformHeat, ...thermalPlatforms.map((platform) => platform.heat || 0));
    this.averagePlatformHeat = (session.thermalMetrics?.heatSampleTotal || 0) / Math.max(1, session.thermalMetrics?.heatSampleCount || 0);
    this.thermalBurnDamage = session.thermalMetrics?.burnDamage || 0;
    this.thermalTroopsLost = session.thermalMetrics?.troopsLost || 0;
  }

  recordEvents(
    events,
    session,
  ) {
    for (const event of events || []) {
      const type = String(
        event.type || "unknown",
      );

      increment(this.events, type);
      if (type === "thermalPlatformDeployed") this.thermalPlatformDeployments += 1;
      if (type === "thermalPlatformDeployed" && event.rescuedTroopId) this.thermalPlatformRescues += 1;
      if (type === "thermalPlatformDestroyed") this.thermalPlatformDestroyed += 1;
      if (type === "thermalBurnStarted") this.thermalBurnEvents += 1;
      if (type === "thermalCycleChanged" && event.state === "eruption") this.eruptionCount += 1;

      const amount = eventAmount(event);

      if (amount) {
        increment(
          this.eventDamage,
          type,
          amount,
        );
      }

      if (
        type === "enemyDeath"
        || type === "bossDeath"
      ) {
        this.enemyDeaths += 1;
      }

      if (type === "troopDeath") {
        this.troopDeaths += 1;

        const row = Number(event.entity?.row);
        const col = Number(event.entity?.col);

        if (
          Number.isInteger(row)
          && Number.isInteger(col)
        ) {
          this.lostCells.add(
            `${row}:${col}`,
          );
        }
      }

      if (
        type === "breach"
        || type === "baseHit"
      ) {
        this.baseBreaches += 1;
      }

      if (type === "pulseCharging") {
        this.pulseActivations += 1;
        if (event.source === "ai") this.pulseAiActivations += 1;
        if (event.source === "automatic") this.pulseAutomaticActivations += 1;
      }

      if (type === "pulseHit") {
        this.pulseDamage += amount;
        increment(this.pulseDamageByRow, String(event.row), amount);
        if (event.killed) this.pulseKills += 1;
      }

      if (type === "energyGenerated") {
        this.energyGenerated += amount;
      }

      if (
        type === "energyCollected"
        || type === "energyPickupCollected"
      ) {
        this.energyCollected += amount;
      }

      if (
        type === "waveComplete"
        || type === "waveOutroStarted"
      ) {
        const wave = Number(
          event.wave
          || session.waveIndex + 1,
        );

        if (
          this.lastWaveCompletedAt
          !== session.elapsed
        ) {
          this.waveCompletionTimes.push({
            wave,
            elapsedMs: session.elapsed,
          });

          this.lastWaveCompletedAt = (
            session.elapsed
          );
        }
      }
    }
  }

  recordAction(
    action,
    result,
    elapsed,
  ) {
    if (result?.ok) {
      switch (action.type) {
        case "place": {
          this.deployments += 1;

          const cellKey = (
            `${action.row}:${action.col}`
          );

          if (this.lostCells.has(cellKey)) {
            this.replacements += 1;
            this.lostCells.delete(cellKey);
          }

          break;
        }
        case "remove":
          this.removals += 1;
          break;
        case "activateSpecial":
          this.specialsUsed += 1;
          break;
        case "activateDematerializationPulse":
          break;
        case "selectDecision":
          this.decisionsSelected += 1;
          break;
        case "selectAdaptiveAid":
          this.adaptiveAidSelections += 1;
          break;
        default:
          break;
      }
    } else if (!result?.skipped) {
      this.actionFailures.push({
        elapsed,
        type: action.type,
        reason:
          result?.reason || "falha",
      });
    }

    if (
      this.actions.length
      < this.actionLogLimit
    ) {
      this.actions.push({
        elapsed,
        type: action.type,
        ok: Boolean(result?.ok),
        reason:
          action.reason
          || result?.reason
          || null,
        troopId:
          action.troopId || null,
        row:
          Number.isInteger(action.row)
            ? action.row
            : null,
        col:
          Number.isInteger(action.col)
            ? action.col
            : null,
        optionId:
          action.option?.id
          || action.optionId
          || null,
      });
    }
  }

  finalize(
    session,
    agentSummary,
  ) {
    this.completedAt = Date.now();
    this.wallDurationMs = (
      this.completedAt - this.startedAt
    );

    return {
      simulationVersion: 1,
      phaseId: this.phaseId,
      chapterId: this.chapterId,
      seed: this.seed,
      strategyId: this.strategyId,
      loadout: [...this.loadout],
      outcome:
        session.result?.outcome
        || session.outcome
        || null,
      stars:
        Number(session.result?.stars)
        || 0,
      durationMs:
        Number(
          session.result?.durationMs
          ?? session.elapsed,
        ),
      integrity:
        Number(
          session.result?.integrity
          ?? (
            session.integrityMax > 0
              ? (
                session.integrity
                / session.integrityMax
                * 100
              )
              : 0
          ),
        ),
      integrityCurrent:
        Number(session.integrity),
      integrityMax:
        Number(session.integrityMax),
      resources: {
        energy:
          Number(session.energy),
        energyMax:
          Number(session.energyMax),
        supply:
          Number(session.supply),
        supplyMax:
          Number(session.supplyMax),
      },
      convoy: session.convoy ? {
        hp: Number(session.convoy.hp),
        maxHp: Number(session.convoy.maxHp),
        progress: Number(session.convoy.progress),
        x: Number(session.convoy.x),
        escorted: Boolean(session.convoy.escorted),
        underAttack: Boolean(session.convoy.underAttack),
        reserve: Number(session.convoy.reserve),
        flowState: session.convoyFlow?.state || null,
        sectorIndex: Number(session.convoyFlow?.sectorIndex ?? -1),
      } : null,
      remainingEnemies: session.enemies
        .filter((enemy) => !enemy.dead && enemy.hp > 0)
        .map((enemy) => ({
          id: enemy.id,
          type: enemy.type,
          row: Number(enemy.row),
          x: Number(enemy.x),
          hp: Number(enemy.hp),
          targetKind: enemy.targetKind || null,
        })),
      remainingTroops: session.troops
        .filter((troop) => !troop.dead && troop.hp > 0)
        .map((troop) => ({
          id: troop.id,
          type: troop.type,
          row: Number(troop.row),
          col: Number(troop.col),
          hp: Number(troop.hp),
        })),
      enemiesDefeated:
        Number(
          session.result
            ?.enemiesDefeated
          ?? session.killed
          ?? this.enemyDeaths,
        ),
      troopDeaths: this.troopDeaths,
      deployments: this.deployments,
      removals: this.removals,
      replacements: this.replacements,
      specialsUsed: this.specialsUsed,
      decisionsSelected:
        this.decisionsSelected,
      adaptiveAidSelections:
        this.adaptiveAidSelections,
      dematerializationPulse: {
        activations: this.pulseActivations,
        aiActivations: this.pulseAiActivations,
        automaticActivations: this.pulseAutomaticActivations,
        damage: this.pulseDamage,
        kills: this.pulseKills,
        damageByRow: { ...this.pulseDamageByRow },
      },
      assistanceTriggered: Boolean(
        session.result
          ?.assistanceTriggered
        || session.assistanceTriggered,
      ),
      assistanceUsed: Boolean(
        session.result?.assistanceUsed
        || session.assistanceUsed,
      ),
      peaks: {
        enemies: this.peakEnemies,
        troops: this.peakTroops,
        projectiles:
          this.peakProjectiles,
        enemyProjectiles:
          this.peakEnemyProjectiles,
        mines: this.peakMines,
        activeEntities:
          this.peakActiveEntities,
      },
      energy: {
        final: Number(session.energy),
        generated: this.energyGenerated,
        collected: this.energyCollected,
      },
      thermal: {
        platformDeployments: this.thermalPlatformDeployments,
        platformDestroyed: this.thermalPlatformDestroyed,
        burnEvents: this.thermalBurnEvents,
        platformRescues: this.thermalPlatformRescues,
        maximumPlatformHeat: this.maximumPlatformHeat,
        averagePlatformHeat: this.averagePlatformHeat,
        burnDamage: this.thermalBurnDamage,
        troopsLost: this.thermalTroopsLost,
        eruptionCount: this.eruptionCount,
      },
      waveCompletionTimes: [
        ...this.waveCompletionTimes,
      ],
      events: {
        ...this.events,
      },
      eventDamage: {
        ...this.eventDamage,
      },
      steps: this.steps,
      agentTicks: this.agentTicks,
      validationChecks:
        this.validationChecks,
      wallDurationMs:
        this.wallDurationMs,
      timeout: this.timeout,
      deadlock: this.deadlock,
      invalidState: this.invalidState,
      failureReason: (
        this.invalidState?.message
        || this.deadlock?.message
        || (
          this.timeout
            ? "maximumDuration"
            : null
        )
      ),
      agent: agentSummary,
      actions: [...this.actions],
      actionFailures: [
        ...this.actionFailures,
      ],
      result: session.result
        ? {
          ...session.result,
        }
        : null,
    };
  }
}
