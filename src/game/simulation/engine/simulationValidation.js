export class SimulationValidationError
  extends Error {
  constructor(
    message,
    details = {},
  ) {
    super(message);
    this.name = "SimulationValidationError";
    this.details = details;
  }
}

function assertFinite(
  value,
  label,
  details,
) {
  if (!Number.isFinite(value)) {
    throw new SimulationValidationError(
      `${label} contém valor não finito.`,
      {
        ...details,
        value,
      },
    );
  }
}

function assertEntity(
  entity,
  kind,
) {
  const details = {
    kind,
    id: entity.id,
    type: entity.type,
  };

  assertFinite(
    Number(entity.x),
    `${kind}.x`,
    details,
  );

  assertFinite(
    Number(entity.y),
    `${kind}.y`,
    details,
  );

  assertFinite(
    Number(entity.hp),
    `${kind}.hp`,
    details,
  );

  assertFinite(
    Number(entity.maxHp),
    `${kind}.maxHp`,
    details,
  );

  if (
    Number(entity.maxHp) < 0
    || Number(entity.hp)
      < -0.001
  ) {
    throw new SimulationValidationError(
      `${kind} possui vida inválida.`,
      {
        ...details,
        hp: entity.hp,
        maxHp: entity.maxHp,
      },
    );
  }

  if (
    entity.row !== undefined
    && (
      !Number.isInteger(entity.row)
      || entity.row < 0
      || entity.row > 4
    )
  ) {
    throw new SimulationValidationError(
      `${kind} possui rota inválida.`,
      {
        ...details,
        row: entity.row,
      },
    );
  }
}

function assertUniqueIds(
  collections,
) {
  const ids = new Map();

  collections.forEach(
    ([name, entries]) => {
      entries.forEach((entry) => {
        if (!entry?.id) return;

        if (ids.has(entry.id)) {
          throw new SimulationValidationError(
            "ID duplicado na sessão.",
            {
              id: entry.id,
              firstCollection:
                ids.get(entry.id),
              secondCollection: name,
            },
          );
        }

        ids.set(entry.id, name);
      });
    },
  );
}

export function validateSimulationState(
  session,
) {
  assertFinite(
    Number(session.elapsed),
    "session.elapsed",
    {
      phaseId: session.phase?.id,
    },
  );

  assertFinite(
    Number(session.energy),
    "session.energy",
    {
      phaseId: session.phase?.id,
    },
  );

  assertFinite(
    Number(session.integrity),
    "session.integrity",
    {
      phaseId: session.phase?.id,
    },
  );

  assertFinite(
    Number(session.supply),
    "session.supply",
    {
      phaseId: session.phase?.id,
    },
  );

  if (
    session.energy < -0.001
    || session.supply < -0.001
  ) {
    throw new SimulationValidationError(
      "Recursos negativos na sessão.",
      {
        energy: session.energy,
        supply: session.supply,
      },
    );
  }

  if (
    session.waveIndex < 0
    || session.waveIndex
      >= session.phase.waves.length
  ) {
    throw new SimulationValidationError(
      "Índice de onda fora da fase.",
      {
        waveIndex: session.waveIndex,
        totalWaves:
          session.phase.waves.length,
      },
    );
  }

  session.troops.forEach(
    (entity) => (
      assertEntity(entity, "troop")
    ),
  );

  session.enemies.forEach(
    (entity) => (
      assertEntity(entity, "enemy")
    ),
  );

  const projectileCollections = [
    session.projectiles,
    session.enemyProjectiles,
  ];

  projectileCollections.forEach(
    (entries, collectionIndex) => {
      entries.forEach((projectile) => {
        const kind = collectionIndex === 0
          ? "projectile"
          : "enemyProjectile";

        assertFinite(
          Number(projectile.x),
          `${kind}.x`,
          {
            id: projectile.id,
            kind: projectile.kind,
          },
        );

        assertFinite(
          Number(projectile.y),
          `${kind}.y`,
          {
            id: projectile.id,
            kind: projectile.kind,
          },
        );
      });
    },
  );

  assertUniqueIds([
    ["troops", session.troops],
    ["enemies", session.enemies],
    ["projectiles", session.projectiles],
    [
      "enemyProjectiles",
      session.enemyProjectiles,
    ],
    ["mines", session.mines],
    [
      "energyPickups",
      session.energyPickups,
    ],
  ]);

  if (
    session.outcome
    && !session.result
  ) {
    throw new SimulationValidationError(
      "A batalha possui resultado lógico sem resultado serializado.",
      {
        outcome: session.outcome,
      },
    );
  }

  return true;
}

export function createProgressFingerprint(
  session,
) {
  const enemyHp = session.enemies.reduce(
    (total, enemy) => (
      total
      + Math.max(0, Number(enemy.hp) || 0)
    ),
    0,
  );

  const troopHp = session.troops.reduce(
    (total, troop) => (
      total
      + Math.max(0, Number(troop.hp) || 0)
    ),
    0,
  );

  return [
    session.waveIndex,
    Number(session.waveActive),
    session.queue.length,
    session.enemies.length,
    Math.round(enemyHp),
    session.troops.length,
    Math.round(troopHp),
    Math.round(session.integrity),
    Math.round(session.energy),
    Math.round(session.supply),
    session.killed,
    session.pendingDecision?.length || 0,
    session.waveOutro?.status || "idle",
    session.adaptiveAid?.status || "disabled",
    session.pendingOutcome || "",
    session.outcome || "",
  ].join("|");
}

export class StagnationDetector {
  constructor(
    maximumStagnationMs,
  ) {
    this.maximumStagnationMs = (
      maximumStagnationMs
    );
    this.fingerprint = null;
    this.changedAt = 0;
  }

  update(
    session,
    clockMs = session.elapsed,
  ) {
    const next = (
      createProgressFingerprint(session)
    );

    const clock = Number.isFinite(
      Number(clockMs),
    )
      ? Number(clockMs)
      : session.elapsed;

    if (next !== this.fingerprint) {
      this.fingerprint = next;
      this.changedAt = clock;

      return {
        stagnant: false,
        durationMs: 0,
      };
    }

    const durationMs = (
      clock - this.changedAt
    );

    return {
      stagnant: (
        durationMs
        >= this.maximumStagnationMs
      ),
      durationMs,
      fingerprint: next,
    };
  }
}
