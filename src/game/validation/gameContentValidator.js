const DEFAULT_TROOP_STATES = Object.freeze(["idle", "attack"]);
const DEFAULT_ENEMY_STATES = Object.freeze(["walking", "attack", "idle"]);

function issue(severity, code, entityType, entityId, path, message, value) {
  return { severity, code, entityType, entityId, path, message, ...(value === undefined ? {} : { value }) };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function frameSet(manifest, entityType, folder, state) {
  const group = entityType === "troop" ? manifest?.troops : manifest?.enemies;
  return group?.[folder]?.[state] || [];
}

function hasFrameState(manifest, entityType, folder, state) {
  return frameSet(manifest, entityType, folder, state).length > 0;
}

function validateFrameSequence(frames, context, push) {
  if (!frames.length) return;
  const sorted = [...frames].sort((a, b) => a - b);
  for (let index = 0; index <= sorted.at(-1); index += 1) {
    if (!sorted.includes(index)) {
      push(issue("error", "ASSET_FRAME_GAP", context.entityType, context.entityId,
        `${context.assetPath}/${context.state}`, `Frame ${index} ausente na sequência.`, index));
    }
  }
}

function resolveDeclaredStates(entityType, entityId, config) {
  if (entityType === "troop") {
    const base = config.assetStates || (entityId === "muralhaReforcada" ? ["defense"] : DEFAULT_TROOP_STATES);
    return [...base, ...(config.assetDirectionalStates || [])];
  }
  return config.assetStates || DEFAULT_ENEMY_STATES;
}

function walkVisualContracts(value, path = "", output = []) {
  if (!isObject(value)) return output;
  const visualPath = path.split(".").some((segment) => /visuals?$/i.test(segment));
  const looksVisual = typeof value.state === "string"
    || Array.isArray(value.timeline)
    || Array.isArray(value.shots)
    || Object.hasOwn(value, "frameMuzzles")
    || Object.hasOwn(value, "muzzle")
    || (visualPath && Object.hasOwn(value, "durationMs"));
  if (looksVisual) output.push({ path, visual: value });
  for (const [key, child] of Object.entries(value)) {
    if (!isObject(child)) continue;
    const childPath = path ? `${path}.${key}` : key;
    walkVisualContracts(child, childPath, output);
  }
  return output;
}

function validateMuzzle(muzzle, context, path, push) {
  if (!isObject(muzzle) || !finite(muzzle.x) || !finite(muzzle.y)) {
    push(issue("error", "VISUAL_MUZZLE_INVALID", context.entityType, context.entityId, path,
      "Muzzle deve possuir x/y numéricos e finitos.", muzzle));
  }
}

function validateVisualContract(contract, context, push) {
  const { visual, path } = contract;
  const duration = visual.durationMs;
  if (duration !== undefined && (!finite(duration) || duration < 0)) {
    push(issue("error", "VISUAL_DURATION_INVALID", context.entityType, context.entityId,
      `${path}.durationMs`, "durationMs deve ser um número finito não negativo.", duration));
  }

  const state = visual.state;
  const fallback = state && context.config.assetStateFallbacks?.[state];
  const frames = state
    ? frameSet(context.manifest, context.entityType, context.assetFolder, state)
    : [];
  const fallbackFrames = fallback
    ? frameSet(context.manifest, context.entityType, context.assetFolder, fallback)
    : [];
  const availableFrames = frames.length ? frames : fallbackFrames;

  if (state && !availableFrames.length) {
    push(issue("warning", "VISUAL_STATE_NOT_REGISTERED", context.entityType, context.entityId,
      `${path}.state`, `Estado visual ${state} não possui frames runtime conhecidos.`, state));
  }

  const maxFrame = availableFrames.length ? Math.max(...availableFrames) : null;
  const timeline = Array.isArray(visual.timeline) ? visual.timeline : [];
  let previousAt = -Infinity;
  for (let index = 0; index < timeline.length; index += 1) {
    const entry = timeline[index];
    const entryPath = `${path}.timeline[${index}]`;
    if (!isObject(entry) || !finite(entry.atMs) || entry.atMs < 0) {
      push(issue("error", "VISUAL_TIMELINE_TIME_INVALID", context.entityType, context.entityId,
        `${entryPath}.atMs`, "atMs da timeline deve ser finito e não negativo.", entry?.atMs));
      continue;
    }
    if (entry.atMs < previousAt) {
      push(issue("error", "VISUAL_TIMELINE_UNSORTED", context.entityType, context.entityId,
        `${entryPath}.atMs`, "Timeline deve estar em ordem crescente de tempo.", entry.atMs));
    }
    previousAt = entry.atMs;
    if (finite(duration) && entry.atMs > duration) {
      push(issue("error", "VISUAL_TIMELINE_OUTSIDE_DURATION", context.entityType, context.entityId,
        `${entryPath}.atMs`, `Timeline excede durationMs=${duration}.`, entry.atMs));
    }
    if (entry.frame !== undefined && (!Number.isInteger(entry.frame) || entry.frame < 0)) {
      push(issue("error", "VISUAL_FRAME_INVALID", context.entityType, context.entityId,
        `${entryPath}.frame`, "Frame deve ser inteiro não negativo.", entry.frame));
    } else if (maxFrame !== null && entry.frame > maxFrame) {
      push(issue("error", "VISUAL_FRAME_OUT_OF_RANGE", context.entityType, context.entityId,
        `${entryPath}.frame`, `Frame ${entry.frame} excede o máximo ${maxFrame} do estado ${state}.`, entry.frame));
    }
  }

  const shots = Array.isArray(visual.shots) ? visual.shots : [];
  previousAt = -Infinity;
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const shotPath = `${path}.shots[${index}]`;
    if (!isObject(shot) || !finite(shot.atMs) || shot.atMs < 0) {
      push(issue("error", "VISUAL_SHOT_TIME_INVALID", context.entityType, context.entityId,
        `${shotPath}.atMs`, "atMs do tiro deve ser finito e não negativo.", shot?.atMs));
      continue;
    }
    if (shot.atMs < previousAt) {
      push(issue("error", "VISUAL_SHOTS_UNSORTED", context.entityType, context.entityId,
        `${shotPath}.atMs`, "Shots devem estar em ordem crescente de tempo.", shot.atMs));
    }
    previousAt = shot.atMs;
    if (finite(duration) && shot.atMs > duration) {
      push(issue("error", "VISUAL_SHOT_OUTSIDE_DURATION", context.entityType, context.entityId,
        `${shotPath}.atMs`, `Tiro excede durationMs=${duration}.`, shot.atMs));
    }
    if (shot.frame !== undefined && (!Number.isInteger(shot.frame) || shot.frame < 0)) {
      push(issue("error", "VISUAL_SHOT_FRAME_INVALID", context.entityType, context.entityId,
        `${shotPath}.frame`, "Frame do tiro deve ser inteiro não negativo.", shot.frame));
    } else if (maxFrame !== null && shot.frame > maxFrame) {
      push(issue("error", "VISUAL_SHOT_FRAME_OUT_OF_RANGE", context.entityType, context.entityId,
        `${shotPath}.frame`, `Frame ${shot.frame} excede o máximo ${maxFrame} do estado ${state}.`, shot.frame));
    }
    if (shot.muzzle !== undefined) validateMuzzle(shot.muzzle, context, `${shotPath}.muzzle`, push);

    if (timeline.length && Number.isInteger(shot.frame)) {
      const active = timeline.findLast?.((entry) => finite(entry.atMs) && entry.atMs <= shot.atMs)
        || [...timeline].reverse().find((entry) => finite(entry.atMs) && entry.atMs <= shot.atMs);
      if (active?.frame !== undefined && active.frame !== shot.frame) {
        push(issue("warning", "VISUAL_SHOT_FRAME_TIMING_MISMATCH", context.entityType, context.entityId,
          shotPath, `No instante ${shot.atMs}ms a timeline aponta frame ${active.frame}, mas o shot declara ${shot.frame}.`));
      }
    }
  }

  if (visual.muzzle !== undefined) validateMuzzle(visual.muzzle, context, `${path}.muzzle`, push);
  if (visual.frameMuzzles !== undefined) {
    const entries = Array.isArray(visual.frameMuzzles)
      ? visual.frameMuzzles.map((muzzle, index) => [index, muzzle]).filter(([, muzzle]) => muzzle != null)
      : isObject(visual.frameMuzzles) ? Object.entries(visual.frameMuzzles) : [];
    for (const [frameKey, muzzle] of entries) {
      const frame = Number(frameKey);
      if (!Number.isInteger(frame) || frame < 0 || (maxFrame !== null && frame > maxFrame)) {
        push(issue("error", "VISUAL_FRAME_MUZZLE_OUT_OF_RANGE", context.entityType, context.entityId,
          `${path}.frameMuzzles.${frameKey}`, "frameMuzzles referencia um frame inexistente.", frameKey));
      }
      validateMuzzle(muzzle, context, `${path}.frameMuzzles.${frameKey}`, push);
    }
  }

  if (context.config.attackEveryMs && shots.length) {
    const lastShot = Math.max(...shots.map((shot) => Number(shot.atMs) || 0));
    if (lastShot > context.config.attackEveryMs) {
      push(issue("warning", "ATTACK_SEQUENCE_EXCEEDS_INTERVAL", context.entityType, context.entityId,
        path, `Último tiro (${lastShot}ms) ocorre após attackEveryMs=${context.config.attackEveryMs}.`));
    }
  }
}

function validateEntity(entityType, entityId, config, manifest, push) {
  if (!isObject(config)) {
    push(issue("error", "ENTITY_CONFIG_INVALID", entityType, entityId, entityId, "Configuração deve ser objeto."));
    return;
  }

  const assetFolder = entityType === "troop" ? (config.spriteKey || entityId) : entityId;
  const declaredStates = resolveDeclaredStates(entityType, entityId, config);
  const seenStates = new Set();
  for (const state of declaredStates) {
    if (seenStates.has(state)) {
      push(issue("warning", "ASSET_DUPLICATE_STATE", entityType, entityId, "assetStates", `Estado ${state} foi declarado mais de uma vez.`, state));
      continue;
    }
    seenStates.add(state);
    const frames = frameSet(manifest, entityType, assetFolder, state);
    const fallback = config.assetStateFallbacks?.[state];
    const fallbackFrames = fallback ? frameSet(manifest, entityType, assetFolder, fallback) : [];
    if (!frames.length && !fallbackFrames.length) {
      push(issue("error", entityType === "troop" && config.assetDirectionalStates?.includes(state)
        ? "ASSET_DIRECTIONAL_STATE_MISSING" : "ASSET_STATE_MISSING", entityType, entityId,
      `assetStates.${state}`, `Nenhum frame encontrado para ${assetFolder}/${state}${fallback ? ` nem fallback ${fallback}` : ""}.`, state));
    }
    validateFrameSequence(frames, { entityType, entityId, assetPath: assetFolder, state }, push);
  }

  const fallbacks = config.assetStateFallbacks || {};
  for (const [state, fallback] of Object.entries(fallbacks)) {
    if (state === fallback) {
      push(issue("error", "ASSET_FALLBACK_CYCLE", entityType, entityId, `assetStateFallbacks.${state}`, "Fallback não pode apontar para o próprio estado."));
    }
    if (!hasFrameState(manifest, entityType, assetFolder, fallback)) {
      push(issue("error", "ASSET_FALLBACK_MISSING", entityType, entityId, `assetStateFallbacks.${state}`, `Fallback ${fallback} não possui frames runtime.`));
    }
    const second = fallbacks[fallback];
    if (second === state) {
      push(issue("error", "ASSET_FALLBACK_CYCLE", entityType, entityId, `assetStateFallbacks.${state}`, `Ciclo de fallback detectado: ${state} → ${fallback} → ${state}.`));
    }
  }

  const context = { entityType, entityId, config, manifest, assetFolder };
  for (const contract of walkVisualContracts(config)) validateVisualContract(contract, context, push);

  if (config.canTargetAir === false && (config.interceptionCooldownMs || /antia[eé]reo|a[eé]reo/i.test(String(config.role || "")))) {
    push(issue("warning", "TARGETING_AIR_CONTRADICTION", entityType, entityId, "canTargetAir",
      "Configuração possui comportamento/descrição antiaérea, mas canTargetAir=false."));
  }
  if (config.canTargetAir === false && config.canTargetGround === false && (config.damage > 0 || config.projectileSpeed > 0)) {
    push(issue("warning", "TARGETING_NO_VALID_CLASS", entityType, entityId, "canTargetAir",
      "Entidade ofensiva não pode mirar ar nem chão."));
  }
}

export function validateGameContent({ troops = {}, enemies = {}, assetManifest = {} } = {}) {
  const errors = [];
  const warnings = [];
  const push = (entry) => (entry.severity === "error" ? errors : warnings).push(entry);

  for (const [entityId, config] of Object.entries(troops)) validateEntity("troop", entityId, config, assetManifest, push);
  for (const [entityId, config] of Object.entries(enemies)) validateEntity("enemy", entityId, config, assetManifest, push);

  const order = (left, right) => `${left.entityType}:${left.entityId}:${left.code}:${left.path}`
    .localeCompare(`${right.entityType}:${right.entityId}:${right.code}:${right.path}`);
  errors.sort(order);
  warnings.sort(order);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      troops: Object.keys(troops).length,
      enemies: Object.keys(enemies).length,
      errors: errors.length,
      warnings: warnings.length,
    },
  };
}

export default validateGameContent;
