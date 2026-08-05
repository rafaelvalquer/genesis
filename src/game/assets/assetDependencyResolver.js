import { ENEMIES, TROOPS } from "../content.js";

export class AssetDependencyError extends Error {
  constructor(message, dependencies = []) {
    super(message);
    this.name = "AssetDependencyError";
    this.dependencies = dependencies;
  }
}

const ASSET_REFERENCE_KEYS = Object.freeze([
  "type",
  "troopId",
  "assetTroopId",
  "enemyId",
  "assetEnemyId",
  "sourceType",
  "targetType",
  "from",
  "to",
  "resultType",
  "transformsInto",
]);

const ASSET_COLLECTION_KEYS = Object.freeze([
  "required",
  "requiredTroopAssetIds",
  "alliedSummons",
  "temporaryTroops",
  "transformations",
  "troopTransformations",
  "dependencies",
  "entries",
]);

function appendAssetReferences(
  value,
  destination,
  origin,
  visited = new WeakSet(),
) {
  if (typeof value === "string") {
    destination.push({ id: value, origin });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      appendAssetReferences(
        entry,
        destination,
        `${origin}[${index}]`,
        visited,
      );
    });
    return;
  }

  if (!value || typeof value !== "object" || visited.has(value)) {
    return;
  }

  visited.add(value);

  ASSET_REFERENCE_KEYS.forEach((key) => {
    if (typeof value[key] === "string") {
      destination.push({
        id: value[key],
        origin: `${origin}.${key}`,
      });
    }
  });

  ASSET_COLLECTION_KEYS.forEach((key) => {
    if (value[key] != null) {
      appendAssetReferences(
        value[key],
        destination,
        `${origin}.${key}`,
        visited,
      );
    }
  });
}

function strictDependencyMode(options = {}) {
  if (typeof options.strict === "boolean") return options.strict;

  return Boolean(
    import.meta.env?.DEV
      || import.meta.env?.MODE === "test",
  );
}

function reportUnknownDependencies(
  kind,
  phase,
  records,
  options = {},
) {
  if (!records.length) return;

  const unique = [
    ...new Map(
      records.map((record) => [
        `${record.id}:${record.origin}`,
        record,
      ]),
    ).values(),
  ];

  const label = kind === "troop" ? "tropa" : "inimigo";

  const message = unique.map((record) => (
    `Dependência de asset de ${label} desconhecida: ${record.id}\n`
    + `Fase: ${phase?.id || "<sem fase>"}\n`
    + `Origem: ${record.origin}`
  )).join("\n\n");

  if (strictDependencyMode(options)) {
    throw new AssetDependencyError(message, unique);
  }

  (options.onWarning || console.warn)(message);
}

function resolveRegistryRecords(
  records,
  registry,
  kind,
  phase,
  options = {},
) {
  const known = [];
  const unknown = [];
  const seen = new Set();

  for (const record of records) {
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);

    if (registry[record.id]) known.push(record.id);
    else unknown.push(record);
  }

  reportUnknownDependencies(
    kind,
    phase,
    unknown,
    options,
  );

  return known;
}

export function resolvePhaseTroopAssetDependencies(
  phase,
  loadout = [],
  options = {},
) {
  const records = [];

  appendAssetReferences(
    Array.isArray(loadout) ? loadout : [],
    records,
    "loadout",
  );
  appendAssetReferences(
    phase?.startingTroops,
    records,
    "startingTroops",
  );
  appendAssetReferences(
    phase?.requiredTroopAssetIds,
    records,
    "requiredTroopAssetIds",
  );
  appendAssetReferences(
    phase?.alliedSummons,
    records,
    "alliedSummons",
  );
  appendAssetReferences(
    phase?.temporaryTroops,
    records,
    "temporaryTroops",
  );
  appendAssetReferences(
    phase?.troopTransformations,
    records,
    "troopTransformations",
  );
  appendAssetReferences(
    phase?.troopAssetDependencies,
    records,
    "troopAssetDependencies",
  );

  return resolveRegistryRecords(
    records,
    TROOPS,
    "troop",
    phase,
    options,
  );
}

export function resolveBattleTroopAssetIds(
  phase,
  loadout = [],
  options = {},
) {
  return resolvePhaseTroopAssetDependencies(
    phase,
    loadout,
    options,
  );
}

function phaseEnemyRecords(phase, enemyIds) {
  const records = [];

  appendAssetReferences(
    enemyIds,
    records,
    "enemyIds",
  );

  for (const [waveIndex, wave] of (
    phase?.waves || []
  ).entries()) {
    appendAssetReferences(
      wave?.enemies,
      records,
      `waves[${waveIndex}].enemies`,
    );
    appendAssetReferences(
      wave?.bossEncounter?.type,
      records,
      `waves[${waveIndex}].bossEncounter.type`,
    );
  }

  appendAssetReferences(
    phase?.enemyAssetDependencies,
    records,
    "enemyAssetDependencies",
  );

  return records;
}

export function resolvePhaseEnemyAssetDependencies(
  phase,
  enemyIds = [],
  options = {},
) {
  const queue = phaseEnemyRecords(phase, enemyIds);
  const resolved = [];
  const unknown = [];
  const seen = new Set();

  for (let index = 0; index < queue.length; index += 1) {
    const record = queue[index];

    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);

    const config = ENEMIES[record.id];

    if (!config) {
      unknown.push(record);
      continue;
    }

    resolved.push(record.id);

    appendAssetReferences(
      config.assetDependencies,
      queue,
      `ENEMIES.${record.id}.assetDependencies`,
    );
  }

  reportUnknownDependencies(
    "enemy",
    phase,
    unknown,
    options,
  );

  return resolved;
}

export function resolvePhaseEnemyEffectDependencies(
  phase,
  enemyIds = [],
  options = {},
) {
  const resolvedEnemies = (
    resolvePhaseEnemyAssetDependencies(
      phase,
      enemyIds,
      options,
    )
  );

  const effects = [];

  appendAssetReferences(
    phase?.effectAssetDependencies,
    effects,
    "effectAssetDependencies",
  );

  resolvedEnemies.forEach((enemyId) => {
    appendAssetReferences(
      ENEMIES[enemyId]?.effectDependencies,
      effects,
      `ENEMIES.${enemyId}.effectDependencies`,
    );
  });

  return [
    ...new Set(
      effects
        .map((entry) => entry.id)
        .filter(Boolean),
    ),
  ];
}
