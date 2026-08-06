import {
  getUnlockedTroops,
  TROOPS,
} from "../../content.js";
import {
  createRng,
} from "../../domain.js";
import {
  createPhaseForecast,
} from "./phaseForecast.js";
import {
  estimateTroopEfficiency,
  getTroopTags,
} from "./troopTaxonomy.js";

function roleScore(
  config,
  forecast,
  profile,
) {
  const tags = getTroopTags(config);
  let score = (
    estimateTroopEfficiency(config)
    * 10
  );

  if (tags.has("economy")) {
    score += (
      profile.economyWeight * 18
      + forecast.totalWaves * 1.6
    );
  }

  if (tags.has("frontline")) {
    score += (
      profile.defenseWeight * 18
      + Math.min(
        20,
        forecast.maximumWavePressure * .3,
      )
    );
  }

  if (tags.has("support")) {
    score += (
      profile.supportWeight * 15
    );
  }

  if (tags.has("offense")) {
    score += (
      profile.offenseWeight * 17
    );
  }

  if (tags.has("area")) {
    score += (
      profile.areaDamageWeight
      * Math.min(
        24,
        forecast.totalUnits * .18,
      )
    );
  }

  if (tags.has("control")) {
    score += (
      profile.controlWeight
      * (
        forecast.highSpeed
          ? 20
          : 9
      )
    );
  }

  if (tags.has("antiAir")) {
    score += (
      profile.antiAirWeight
      * (
        forecast.airborne
          ? 34
          : 3
      )
    );
  }

  if (tags.has("amphibious")) {
    score += [
      "tide_cycle",
      "tide",
    ].includes(forecast.hazardId)
      || forecast.mechanicId === "tide_cycle"
      ? 30
      : 2;
  }

  if (tags.has("windResistant")) {
    score += forecast.hazardId === "wind_current"
      ? 26
      : 1;
  }

  if (tags.has("ranged")) {
    score += forecast.hazardId === "sandstorm"
      ? -5
      : 6;
  }

  if (
    forecast.boss
    && tags.has("offense")
  ) {
    score += profile.bossWeight * 18;
  }

  if (
    forecast.shields
    && (
      config.shieldIgnoreFactor
      || config.structuralRupture
      || config.attack === "melee"
    )
  ) {
    score += 15;
  }

  return score;
}

function bestByTag(
  candidates,
  tag,
  selected,
) {
  return candidates.find(
    (entry) => (
      !selected.has(entry.id)
      && entry.tags.has(tag)
    ),
  );
}

function addIfPresent(
  selected,
  entry,
  limit,
) {
  if (
    entry
    && selected.size < limit
  ) {
    selected.add(entry.id);
  }
}

export function planLoadoutForPhase({
  phase,
  phaseIndex,
  profile,
  seed = 1,
  forecast = createPhaseForecast(
    phase,
    seed,
  ),
}) {
  const available = getUnlockedTroops(
    phaseIndex,
  );

  const scored = available
    .map((config) => ({
      id: config.id,
      config,
      tags: getTroopTags(config),
      score: roleScore(
        config,
        forecast,
        profile,
      ),
    }))
    .sort(
      (left, right) => (
        right.score - left.score
        || left.id.localeCompare(right.id)
      ),
    );

  const limit = Math.max(
    1,
    Math.min(
      Number(phase.loadoutLimit)
        || scored.length,
      scored.length,
    ),
  );

  const selected = new Set();

  const needsEconomy = (
    phase.waves.length >= 3
    && profile.economyTarget > 0
  );

  if (needsEconomy) {
    addIfPresent(
      selected,
      bestByTag(
        scored,
        "economy",
        selected,
      ),
      limit,
    );
  }

  addIfPresent(
    selected,
    bestByTag(
      scored,
      "frontline",
      selected,
    ),
    limit,
  );

  if (forecast.airborne) {
    addIfPresent(
      selected,
      bestByTag(
        scored,
        "antiAir",
        selected,
      ),
      limit,
    );
  }

  if (
    forecast.totalUnits >= 35
    || forecast.summoners
  ) {
    addIfPresent(
      selected,
      bestByTag(
        scored,
        "area",
        selected,
      ),
      limit,
    );
  }

  if (
    forecast.highSpeed
    || forecast.maximumWavePressure >= 12
  ) {
    addIfPresent(
      selected,
      bestByTag(
        scored,
        "control",
        selected,
      ),
      limit,
    );
  }

  addIfPresent(
    selected,
    bestByTag(
      scored,
      "support",
      selected,
    ),
    limit,
  );

  addIfPresent(
    selected,
    bestByTag(
      scored,
      "offense",
      selected,
    ),
    limit,
  );

  for (const entry of scored) {
    if (selected.size >= limit) break;
    selected.add(entry.id);
  }

  return {
    loadout: [...selected],
    forecast,
    scored,
  };
}

function swapCandidate(
  base,
  removeId,
  addId,
) {
  if (
    !removeId
    || !addId
    || removeId === addId
  ) {
    return null;
  }

  const next = base.map(
    (id) => (
      id === removeId
        ? addId
        : id
    ),
  );

  return (
    new Set(next).size === next.length
      ? next
      : null
  );
}

function candidateKey(loadout) {
  return [...loadout]
    .sort()
    .join("|");
}

export function generateLoadoutCandidates({
  phase,
  phaseIndex,
  profile,
  seed = 1,
  maximumCandidates = 12,
}) {
  const planned = planLoadoutForPhase({
    phase,
    phaseIndex,
    profile,
    seed,
  });

  const candidates = new Map();
  const add = (loadout) => {
    if (!loadout?.length) return;
    candidates.set(
      candidateKey(loadout),
      loadout,
    );
  };

  add(planned.loadout);

  const selectedEntries = (
    planned.scored.filter(
      (entry) => (
        planned.loadout.includes(entry.id)
      ),
    )
  );

  const unselectedEntries = (
    planned.scored.filter(
      (entry) => (
        !planned.loadout.includes(entry.id)
      ),
    )
  );

  for (const selected of selectedEntries) {
    const alternatives = unselectedEntries
      .filter((entry) => (
        [...selected.tags].some(
          (tag) => entry.tags.has(tag),
        )
      ))
      .slice(0, 3);

    for (const alternative of alternatives) {
      add(
        swapCandidate(
          planned.loadout,
          selected.id,
          alternative.id,
        ),
      );

      if (
        candidates.size
        >= maximumCandidates
      ) {
        return {
          ...planned,
          candidates: [
            ...candidates.values(),
          ],
        };
      }
    }
  }

  const rng = createRng(seed ^ 0x51f15e);

  while (
    candidates.size < maximumCandidates
    && unselectedEntries.length
    && selectedEntries.length
  ) {
    const remove = selectedEntries[
      Math.floor(
        rng() * selectedEntries.length
      )
    ];

    const addEntry = unselectedEntries[
      Math.floor(
        rng() * unselectedEntries.length
      )
    ];

    add(
      swapCandidate(
        planned.loadout,
        remove.id,
        addEntry.id,
      ),
    );

    if (
      candidates.size
      >= planned.scored.length
    ) {
      break;
    }
  }

  return {
    ...planned,
    candidates: [
      ...candidates.values(),
    ],
  };
}

export function describeLoadout(
  loadout,
) {
  return loadout.map((troopId) => {
    const config = TROOPS[troopId];

    return {
      id: troopId,
      label: config?.label || troopId,
      role: config?.role || null,
      price: Number(config?.price) || 0,
      supply: Number(config?.supply) || 0,
      tags: [
        ...getTroopTags(config),
      ],
    };
  });
}
