import { createTideCycleHazard } from "./tideCycle.js";

const phase = (
  id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, waves, extra = {},
) => ({ id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, waves, ...extra });

const PHASE_BLUEPRINTS = [
  phase(
    "fase_33", "Costa dos Naufrágios", "A primeira maré alcança os destroços", 690,
    "fase_33",
    { primary: "#22d3ee", accent: "#f59e0b", shadow: "#020b12", haze: "#67e8f9" },
    {
      id: "nereida-wreck-coast", seed: 3333, material: "wet-metal",
      base: "wreck-bastion", entrance: "storm-surf",
      lane: "#173b42", laneAlt: "#214d52", edge: "#67e8f9", detail: "#f59e0b",
    },
    { floodedFromCol: 8, highDurationMs: 8500, enemySpeedFactor: 1.15 },
    [
      [{ type: "medu", count: 15 }],
      [{ type: "medu", count: 10 }, { type: "crix", count: 10 }],
      [{ type: "crix", count: 10 }, { type: "krulax", count: 10 }],
      [{ type: "medu", count: 10 }, { type: "krulax", count: 10 }, { type: "krakhul", count: 5 }],
      [{ type: "crix", count: 10 }, { type: "krulax", count: 15 }, { type: "parasitaSaltador", count: 5 }],
      [
        { type: "medu", count: 10 }, { type: "crix", count: 10 }, { type: "krulax", count: 10 },
        { type: "krakhul", count: 5 }, { type: "parasitaSaltador", count: 5 },
      ],
    ],
  ),
  phase(
    "fase_34", "Mangue Luminescente", "Raízes antigas brilham sob águas rasas", 720,
    "fase_34",
    { primary: "#2dd4bf", accent: "#a3e635", shadow: "#03120f", haze: "#5eead4" },
    {
      id: "nereida-luminous-mangrove", seed: 3434, material: "earth",
      base: "root-outpost", entrance: "mangrove-channel",
      lane: "#254d3f", laneAlt: "#315c49", edge: "#5eead4", detail: "#a3e635",
    },
    { floodedFromCol: 8, highDurationMs: 9000, enemySpeedFactor: 1.16 },
    [
      [{ type: "medu", count: 18 }, { type: "crix", count: 8 }],
      [{ type: "crix", count: 15 }, { type: "krulax", count: 10 }],
      [{ type: "medu", count: 15 }, { type: "parasitaSaltador", count: 8 }],
      [{ type: "krulax", count: 18 }, { type: "krakhul", count: 5 }],
      [{ type: "crix", count: 15 }, { type: "brakor", count: 5 }, { type: "medu", count: 10 }],
      [{ type: "krakhul", count: 8 }, { type: "parasitaSaltador", count: 8 }, { type: "krulax", count: 16 }],
    ],
  ),
  phase(
    "fase_35", "Recife Ossificado", "Corais crescem sobre ossadas de leviatãs", 750,
    "fase_35",
    { primary: "#67e8f9", accent: "#c084fc", shadow: "#041018", haze: "#a5f3fc" },
    {
      id: "nereida-ossified-reef", seed: 3535, material: "organic",
      base: "bone-reef", entrance: "coral-arch",
      lane: "#24434b", laneAlt: "#31535b", edge: "#a5f3fc", detail: "#c084fc",
    },
    { floodedFromCol: 7, highDurationMs: 9500, enemySpeedFactor: 1.18 },
    [
      [{ type: "medu", count: 20 }, { type: "krulax", count: 10 }],
      [{ type: "crix", count: 18 }, { type: "krakhul", count: 5 }],
      [{ type: "krulax", count: 18 }, { type: "parasitaSaltador", count: 8 }],
      [{ type: "brakor", count: 6 }, { type: "medu", count: 18 }],
      [{ type: "krakhul", count: 8 }, { type: "crix", count: 18 }, { type: "oculis", count: 4 }],
      [{ type: "brakor", count: 8 }, { type: "krulax", count: 18 }, { type: "parasitaSaltador", count: 10 }],
    ],
  ),
  phase(
    "fase_36", "Estação Afogada", "Uma instalação esquecida resiste sob a água", 780,
    "fase_36",
    { primary: "#38bdf8", accent: "#fbbf24", shadow: "#020c16", haze: "#7dd3fc" },
    {
      id: "nereida-flooded-station", seed: 3636, material: "station",
      base: "submerged-station", entrance: "pressure-lock",
      lane: "#173747", laneAlt: "#20485a", edge: "#7dd3fc", detail: "#fbbf24",
    },
    { floodedFromCol: 7, highDurationMs: 10000, enemySpeedFactor: 1.19 },
    [
      [{ type: "crix", count: 20 }, { type: "medu", count: 15 }],
      [{ type: "krulax", count: 20 }, { type: "krakhul", count: 5 }],
      [{ type: "parasitaSaltador", count: 10 }, { type: "medu", count: 20 }],
      [{ type: "brakor", count: 8 }, { type: "crix", count: 20 }],
      [{ type: "oculis", count: 6 }, { type: "krulax", count: 20 }, { type: "krakhul", count: 6 }],
      [{ type: "brakor", count: 10 }, { type: "parasitaSaltador", count: 10 }, { type: "crix", count: 20 }],
    ],
  ),
  phase(
    "fase_37", "Fendas Hidrotermais", "Vapor e pressão transformam o fundo oceânico", 810,
    "fase_37",
    { primary: "#22d3ee", accent: "#fb7185", shadow: "#071014", haze: "#f97316" },
    {
      id: "nereida-hydrothermal-rifts", seed: 3737, material: "rock",
      base: "vent-basin", entrance: "thermal-rift",
      lane: "#283b3f", laneAlt: "#35494c", edge: "#67e8f9", detail: "#fb7185",
    },
    { floodedFromCol: 7, highDurationMs: 10500, enemySpeedFactor: 1.21 },
    [
      [{ type: "medu", count: 24 }, { type: "crix", count: 12 }],
      [{ type: "krulax", count: 22 }, { type: "parasitaSaltador", count: 10 }],
      [{ type: "brakor", count: 8 }, { type: "krakhul", count: 8 }],
      [{ type: "oculis", count: 8 }, { type: "crix", count: 22 }],
      [{ type: "brakor", count: 10 }, { type: "krulax", count: 22 }, { type: "medu", count: 15 }],
      [{ type: "krakhul", count: 10 }, { type: "parasitaSaltador", count: 12 }, { type: "oculis", count: 8 }],
    ],
  ),
  phase(
    "fase_38", "Jardins Predadores", "A flora abissal reage à presença humana", 840,
    "fase_38",
    { primary: "#c084fc", accent: "#2dd4bf", shadow: "#090716", haze: "#e879f9" },
    {
      id: "nereida-predatory-gardens", seed: 3838, material: "organic",
      base: "anemone-garden", entrance: "living-coral",
      lane: "#283246", laneAlt: "#353c55", edge: "#c084fc", detail: "#2dd4bf",
    },
    { floodedFromCol: 6, highDurationMs: 11000, enemySpeedFactor: 1.22 },
    [
      [{ type: "crix", count: 24 }, { type: "parasitaSaltador", count: 12 }],
      [{ type: "krulax", count: 25 }, { type: "krakhul", count: 8 }],
      [{ type: "brakor", count: 10 }, { type: "medu", count: 24 }],
      [{ type: "oculis", count: 10 }, { type: "crix", count: 24 }],
      [{ type: "krakhul", count: 12 }, { type: "parasitaSaltador", count: 14 }, { type: "krulax", count: 20 }],
      [{ type: "brakor", count: 12 }, { type: "oculis", count: 10 }, { type: "medu", count: 24 }],
    ],
  ),
  phase(
    "fase_39", "Cemitério dos Leviatãs", "O caminho atravessa restos de criaturas colossais", 870,
    "fase_39",
    { primary: "#93c5fd", accent: "#a78bfa", shadow: "#030712", haze: "#67e8f9" },
    {
      id: "nereida-leviathan-graveyard", seed: 3939, material: "ancient",
      base: "leviathan-ribs", entrance: "skull-gate",
      lane: "#1e3347", laneAlt: "#294158", edge: "#93c5fd", detail: "#a78bfa",
    },
    { floodedFromCol: 6, highDurationMs: 11500, enemySpeedFactor: 1.24, maxChance: 0.5 },
    [
      [{ type: "medu", count: 28 }, { type: "krulax", count: 18 }],
      [{ type: "crix", count: 28 }, { type: "parasitaSaltador", count: 14 }],
      [{ type: "brakor", count: 12 }, { type: "krakhul", count: 12 }],
      [{ type: "oculis", count: 12 }, { type: "krulax", count: 25 }],
      [{ type: "brakor", count: 14 }, { type: "parasitaSaltador", count: 16 }, { type: "medu", count: 24 }],
      [{ type: "krakhul", variant: "alpha", count: 1 }, { type: "brakor", count: 14 }, { type: "crix", count: 28 }],
    ],
  ),
  phase(
    "fase_40", "Trono Abissal", "O coração de Nereida desperta sob a maré", 900,
    "fase_40",
    { primary: "#e879f9", accent: "#22d3ee", shadow: "#02030a", haze: "#8b5cf6" },
    {
      id: "nereida-abyssal-throne", seed: 4040, material: "organic",
      base: "abyssal-throne", entrance: "leviathan-heart",
      lane: "#1e2843", laneAlt: "#293354", edge: "#e879f9", detail: "#22d3ee",
    },
    {
      floodedFromCol: 5, highDurationMs: 12500, enemySpeedFactor: 1.27,
      baseChance: 0.25, maxChance: 0.55, checkEveryMs: 10000,
    },
    [
      [{ type: "crix", count: 30 }, { type: "krulax", count: 20 }],
      [{ type: "medu", count: 30 }, { type: "parasitaSaltador", count: 16 }],
      [{ type: "brakor", count: 14 }, { type: "krakhul", count: 14 }],
      [{ type: "oculis", count: 14 }, { type: "crix", count: 30 }, { type: "krulax", count: 20 }],
      [{ type: "brakor", count: 16 }, { type: "parasitaSaltador", count: 18 }, { type: "krakhul", count: 12 }],
      [
        { type: "krakhul", variant: "alpha", count: 1 }, { type: "brakor", variant: "alpha", count: 1 },
        { type: "oculis", count: 14 }, { type: "krulax", count: 24 }, { type: "crix", count: 24 },
      ],
    ],
    { boss: true },
  ),
];

function createChapterFivePhase(blueprint, chapterIndex) {
  const { tide, waves: waveBlueprints, ...rest } = blueprint;
  const waves = waveBlueprints.map((enemies) => ({ enemies }));
  return {
    ...rest,
    waves,
    cadenceMs: 1000 - chapterIndex * 15,
    targetDurationMs: 900000 + chapterIndex * 45000,
    baseIntegrity: 100,
    chapterId: "chapter_05",
    chapterIndex,
    supplyLimit: 40,
    loadoutLimit: 8,
    waveCompletionEnergy: 20,
    environment: "abyss",
    ambientEffects: ["mist", "wet", "bioluminescence", "bubbles"],
    environmentHazard: createTideCycleHazard(chapterIndex, tide),
    waveIntensity: waves.map((_, waveIndex) => (
      0.38 + 0.62 * waveIndex / Math.max(1, waves.length - 1)
    )),
  };
}

export const CHAPTER_FIVE_PHASES = PHASE_BLUEPRINTS.map(createChapterFivePhase);
export const CHAPTER_FIVE_PHASE_IDS = Object.freeze(CHAPTER_FIVE_PHASES.map((entry) => entry.id));
