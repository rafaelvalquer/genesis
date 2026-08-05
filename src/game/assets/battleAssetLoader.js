import { ENEMIES, TROOPS } from "../content.js";
import {
  createAssetAbortError,
  frameNumber,
  modulesFor,
  statesForFolder,
} from "./assetModuleUtils.js";
import {
  clearDecodedImageCache,
  getAssetCacheMetrics,
  loadDecodedImage,
  releaseBattleAssets,
} from "./decodedImageCache.js";
import {
  resolvePhaseEnemyAssetDependencies,
  resolvePhaseEnemyEffectDependencies,
  resolvePhaseTroopAssetDependencies,
} from "./assetDependencyResolver.js";
import { copyBattleAudioUrls } from "./audioCatalog.js";

const troopFrameModules = import.meta.glob([
  "./troop/**/*.png",
  "!./troop/muralhaReforcada/idle/**/*.png",
], {
  query: "?url",
  import: "default",
});

const enemyFrameModules = import.meta.glob(
  "./enemy/**/*.png",
  {
    query: "?url",
    import: "default",
  },
);

const defenseFrameModules = import.meta.glob(
  "./defense/**/*.png",
  {
    query: "?url",
    import: "default",
  },
);

const effectFrameModules = import.meta.glob(
  "./effects/**/*.png",
  {
    query: "?url",
    import: "default",
  },
);

async function loadFrameSet(
  modules,
  folder,
  state,
  options = {},
) {
  const entries = modulesFor(
    modules,
    folder,
    state,
  );

  const urls = await Promise.all(
    entries.map(([, load]) => load()),
  );

  if (options.signal?.aborted) {
    throw createAssetAbortError();
  }

  const images = await Promise.all(
    urls.map((url) => loadDecodedImage(
      url,
      options.signal,
      options.retainedKeys,
    )),
  );

  const frames = [];

  entries.forEach(([key], index) => {
    frames[frameNumber(key)] = images[index];
  });

  return frames;
}

export function resolveTroopFrame(
  troopAssets,
  state,
  frame,
) {
  const stateFrames = troopAssets?.[state] || [];
  const idleFrames = troopAssets?.idle || [];

  return stateFrames[frame]
    || idleFrames[frame]
    || stateFrames.find(Boolean)
    || idleFrames.find(Boolean)
    || null;
}

export async function runWithConcurrency(
  tasks,
  options = {},
) {
  if (!tasks.length) return [];

  const concurrency = Math.max(
    1,
    Math.min(
      8,
      Math.floor(
        Number(options.concurrency) || 4,
      ),
    ),
  );

  const results = new Array(tasks.length);
  let cursor = 0;
  let firstError = null;

  const recordError = (error) => {
    if (!firstError) firstError = error;
  };

  const abort = () => {
    recordError(createAssetAbortError());
  };

  options.signal?.addEventListener(
    "abort",
    abort,
    { once: true },
  );

  if (options.signal?.aborted) abort();

  const worker = async () => {
    while (!firstError) {
      const taskIndex = cursor;

      if (taskIndex >= tasks.length) return;

      cursor += 1;

      try {
        results[taskIndex] = (
          await tasks[taskIndex]()
        );

        options.onTaskComplete?.(
          taskIndex,
          results[taskIndex],
        );
      } catch (error) {
        options.onTaskError?.(
          taskIndex,
          error,
        );
        recordError(error);
      }
    }
  };

  try {
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            concurrency,
            tasks.length,
          ),
        },
        () => worker(),
      ),
    );

    if (firstError) throw firstError;

    return results;
  } finally {
    options.signal?.removeEventListener(
      "abort",
      abort,
    );
  }
}

export async function loadBattleAssets(
  phase,
  loadout,
  onProgress = () => {},
  options = {},
) {
  if (options.signal?.aborted) {
    throw createAssetAbortError();
  }

  const dependencyOptions = {
    strict: options.strictDependencies,
    onWarning: options.onDependencyWarning,
  };

  const troopIds = (
    resolvePhaseTroopAssetDependencies(
      phase,
      loadout,
      dependencyOptions,
    )
  );

  const hasExplicitEnemyIds = (
    Array.isArray(options.enemyIds)
  );

  const enemyPhase = (
    hasExplicitEnemyIds
      ? null
      : phase
  );

  const explicitEnemyIds = (
    hasExplicitEnemyIds
      ? options.enemyIds
      : []
  );

  const enemyIds = (
    resolvePhaseEnemyAssetDependencies(
      enemyPhase,
      explicitEnemyIds,
      dependencyOptions,
    )
  );

  const effectDependencies = (
    resolvePhaseEnemyEffectDependencies(
      enemyPhase,
      enemyIds,
      dependencyOptions,
    )
  );

  const tasks = [];
  const priorityTasks = [];
  const deferredTasks = [];
  const retainedKeys = new Set();

  const loadOptions = {
    signal: options.signal,
    retainedKeys,
  };

  const result = {
    troops: {},
    enemies: {},
    defenses: {},
    effects: {},
    audio: {},
    _assetCacheKeys: retainedKeys,
  };

  result.effectDependencies = effectDependencies;

  for (const effectId of effectDependencies) {
    const states = statesForFolder(
      effectFrameModules,
      effectId,
    );

    if (!states.length) continue;

    result.effects[effectId] ||= {};

    for (const state of states) {
      tasks.push(async () => {
        result.effects[effectId][state] = (
          await loadFrameSet(
            effectFrameModules,
            effectId,
            state,
            loadOptions,
          )
        );
      });
    }
  }

  result.effects.colonyCapsule = {};

  for (const state of [
    "falling",
    "idle",
    "opening",
  ]) {
    tasks.push(async () => {
      result.effects.colonyCapsule[state] = (
        await loadFrameSet(
          effectFrameModules,
          "colonyCapsule",
          state,
          loadOptions,
        )
      );
    });
  }

  if (troopIds.includes("executorArco")) {
    result.effects.executorArcSlash = {};

    for (const state of [
      "flying",
      "impact",
    ]) {
      tasks.push(async () => {
        result.effects.executorArcSlash[state] = (
          await loadFrameSet(
            effectFrameModules,
            "executorArcSlash",
            state,
            loadOptions,
          )
        );
      });
    }
  }

  if (
    phase.environmentHazard?.id
      === "sandstorm"
  ) {
    result.effects.sandBurial = {};

    tasks.push(async () => {
      result.effects.sandBurial.buried = (
        await loadFrameSet(
          effectFrameModules,
          "sandBurial",
          "buried",
          loadOptions,
        )
      );
    });
  }

  if (
    phase.environmentHazard?.id
      === "wind_current"
  ) {
    result.effects.windCurrent = {};

    for (const state of [
      "dustDebris",
      "rockDebris",
      "emergencyReturn",
    ]) {
      tasks.push(async () => {
        result.effects.windCurrent[state] = (
          await loadFrameSet(
            effectFrameModules,
            "windCurrent",
            state,
            loadOptions,
          )
        );
      });
    }
  }

  if (!options.skipDefenses) {
    result.defenses.pulsoDesmaterializacao = {};

    for (const state of [
      "idle",
      "attack",
      "dead",
    ]) {
      tasks.push(async () => {
        result.defenses
          .pulsoDesmaterializacao[state] = (
            await loadFrameSet(
              defenseFrameModules,
              "pulsoDesmaterializacao",
              state,
              loadOptions,
            )
          );
      });
    }
  }

  for (const troopId of troopIds) {
    const troop = TROOPS[troopId];

    const states = (
      troop.assetStates
      || (
        troopId === "muralhaReforcada"
          ? ["defense"]
          : ["idle", "attack"]
      )
    );

    result.troops[troopId] = {};

    for (const state of states) {
      const task = async () => {
        let frames = await loadFrameSet(
          troopFrameModules,
          troop.spriteKey,
          state,
          loadOptions,
        );

        const fallbackState = (
          troop.assetStateFallbacks?.[state]
        );

        if (
          !frames.some(Boolean)
          && fallbackState
        ) {
          frames = await loadFrameSet(
            troopFrameModules,
            troop.spriteKey,
            fallbackState,
            loadOptions,
          );
        }

        result.troops[troopId][state] = frames;
      };

      const rareState = (
        /death|dead|special|transition/i
          .test(state)
      );

      const bucket = (
        options.deferRareStates
          && rareState
      )
        ? deferredTasks
        : (
          state === "idle"
            || state === "defense"
        )
          ? priorityTasks
          : tasks;

      bucket.push(task);
    }
  }

  for (const enemyId of enemyIds) {
    const enemy = ENEMIES[enemyId];

    if (!enemy) continue;

    result.enemies[enemyId] = {};

    for (const state of (
      enemy.assetStates
      || ["walking", "attack", "idle"]
    )) {
      const task = async () => {
        result.enemies[enemyId][state] = (
          await loadFrameSet(
            enemyFrameModules,
            enemyId,
            state,
            loadOptions,
          )
        );
      };

      const rareState = (
        /death|dead|destroy|transition/i
          .test(state)
      );

      (
        options.deferRareStates
          && rareState
          ? deferredTasks
          : tasks
      ).push(task);
    }
  }

  let done = 0;

  const total = (
    priorityTasks.length
      + tasks.length
  );

  const taskOptions = {
    concurrency: options.assetConcurrency ?? 4,
    signal: options.signal,
    onTaskComplete: () => {
      done += 1;

      onProgress({
        done,
        total,
        percent: Math.round(
          (
            done
              / Math.max(1, total)
          ) * 100,
        ),
      });
    },
  };

  try {
    await runWithConcurrency(
      priorityTasks,
      taskOptions,
    );

    await runWithConcurrency(
      tasks,
      taskOptions,
    );
  } catch (error) {
    releaseBattleAssets(result);
    throw error;
  }

  copyBattleAudioUrls(result.audio);

  result.loadDeferred = async () => {
    let deferredDone = 0;

    await runWithConcurrency(
      deferredTasks,
      {
        concurrency: (
          options.assetConcurrency ?? 4
        ),
        signal: options.signal,
        onTaskComplete: () => {
          deferredDone += 1;

          onProgress({
            done: deferredDone,
            total: deferredTasks.length,
            percent: Math.round(
              (
                deferredDone
                  / Math.max(
                    1,
                    deferredTasks.length,
                  )
              ) * 100,
            ),
            phase: "deferred",
          });
        },
      },
    );

    return result;
  };

  result.deferredStates = (
    deferredTasks.length
  );

  result.metrics = getAssetCacheMetrics();

  return result;
}

export {
  clearDecodedImageCache,
  getAssetCacheMetrics,
  releaseBattleAssets,
};
