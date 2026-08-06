export class AgentMemory {
  constructor() {
    this.lastWaveIndex = 0;
    this.lastWaveActive = false;
    this.preparationStartedAt = 0;
    this.lastActionAt = -Infinity;
    this.lastSuccessfulActionAt = -Infinity;
    this.actionCooldowns = new Map();
    this.actionFailures = new Map();
    this.placements = [];
    this.removals = [];
    this.specials = [];
    this.decisions = [];
    this.waveStarts = [];
    this.adaptiveAidActions = [];
  }

  update(session) {
    const waveChanged = (
      session.waveIndex
      !== this.lastWaveIndex
    );

    const waveEnded = (
      this.lastWaveActive
      && !session.waveActive
    );

    if (waveChanged || waveEnded) {
      this.preparationStartedAt = (
        session.elapsed
      );
    }

    this.lastWaveIndex = session.waveIndex;
    this.lastWaveActive = session.waveActive;
  }

  getPreparationElapsed(session) {
    return Math.max(
      0,
      session.elapsed
      - this.preparationStartedAt,
    );
  }

  canAttempt(
    key,
    elapsed,
  ) {
    return elapsed >= (
      this.actionCooldowns.get(key)
      || -Infinity
    );
  }

  recordFailure(
    key,
    elapsed,
    reason,
  ) {
    const previous = (
      this.actionFailures.get(key)
      || {
        count: 0,
        reason: null,
      }
    );

    const count = previous.count + 1;

    this.actionFailures.set(
      key,
      {
        count,
        reason,
      },
    );

    const delay = Math.min(
      5000,
      250 * 2 ** Math.min(4, count - 1),
    );

    this.actionCooldowns.set(
      key,
      elapsed + delay,
    );
  }

  recordSuccess(
    action,
    elapsed,
    result,
  ) {
    const key = action.key;

    if (key) {
      this.actionFailures.delete(key);
      this.actionCooldowns.set(
        key,
        elapsed + 120,
      );
    }

    this.lastActionAt = elapsed;
    this.lastSuccessfulActionAt = elapsed;

    const entry = {
      elapsed,
      action: {
        ...action,
      },
      result,
    };

    switch (action.type) {
      case "place":
        this.placements.push(entry);
        break;
      case "remove":
        this.removals.push(entry);
        break;
      case "activateSpecial":
        this.specials.push(entry);
        break;
      case "selectDecision":
        this.decisions.push(entry);
        break;
      case "startWave":
        this.waveStarts.push(entry);
        this.preparationStartedAt = elapsed;
        break;
      case "openAdaptiveAid":
      case "selectAdaptiveAid":
        this.adaptiveAidActions.push(entry);
        break;
      default:
        break;
    }
  }

  summary() {
    return {
      placements: this.placements.length,
      removals: this.removals.length,
      specials: this.specials.length,
      decisions: this.decisions.length,
      waveStarts: this.waveStarts.length,
      adaptiveAidActions:
        this.adaptiveAidActions.length,
      failedActionKeys: [
        ...this.actionFailures.entries(),
      ].map(([key, value]) => ({
        key,
        ...value,
      })),
    };
  }
}
