export const TROOPS = {
  colono: {
    id: "colono", label: "Colono", role: "Linha de frente", spriteKey: "colono",
    price: 10, supply: 3, deployCooldownMs: 4000, hp: 34, range: 0.9,
    attackEveryMs: 780, damage: 8, attack: "melee", color: "#fbbf24", unlockAt: 0,
    description: "Combatente barato para segurar a linha.",
  },
  marine: {
    id: "marine", label: "Marine", role: "Rajada", spriteKey: "marine",
    price: 15, supply: 5, deployCooldownMs: 5000, hp: 30, range: 5.5,
    attackEveryMs: 1150, damage: 4, burst: 3, burstIntervalMs: 120,
    attack: "bullet", color: "#38bdf8", unlockAt: 2,
    attackVisual: {
      height: 126, durationMs: 420, effect: "marineBullet",
      shots: [
        { atMs: 0, frame: 8, muzzle: { x: 0.83, y: 0.67 } },
        { atMs: 120, frame: 23, muzzle: { x: 0.84, y: 0.68 } },
        { atMs: 240, frame: 38, muzzle: { x: 0.93, y: 0.69 } },
      ],
    },
    description: "Três disparos rápidos contra alvos comuns.",
  },
  muralhaReforcada: {
    id: "muralhaReforcada", label: "Muralha", role: "Defesa", spriteKey: "muralhaReforcada",
    price: 15, supply: 6, deployCooldownMs: 2500, hp: 120, range: 0,
    attackEveryMs: 0, damage: 0, attack: "none", color: "#94a3b8", unlockAt: 0,
    description: "Bloqueia uma rota e absorve muito dano.",
  },
  "caçador": {
    id: "caçador", label: "Caçador", role: "Escopeta", spriteKey: "marine",
    price: 12, supply: 4, deployCooldownMs: 5000, hp: 27, range: 3.4,
    attackEveryMs: 1050, damage: 5, pellets: 5, attack: "shotgun", color: "#fb7185", unlockAt: 5,
    attackVisual: { height: 126, durationMs: 420, effect: "shotgun", shots: [{ atMs: 0, frame: 8, muzzle: { x: 0.83, y: 0.67 } }] },
    description: "Cone de estilhaços contra grupos próximos.",
  },
  sniper: {
    id: "sniper", label: "Sniper", role: "Precisão", spriteKey: "sniper",
    price: 20, supply: 7, deployCooldownMs: 6000, hp: 22, range: 8.8,
    attackEveryMs: 1900, damage: 30, attack: "bullet", color: "#f97316", unlockAt: 3,
    attackVisual: { height: 126, durationMs: 440, effect: "sniperBullet", shots: [{ atMs: 0, frame: 12, muzzle: { x: 0.995, y: 0.4 } }] },
    description: "Dano extremo em alvos resistentes e elites.",
  },
  krio: {
    id: "krio", label: "Krio", role: "Controle", spriteKey: "guarda",
    price: 12, supply: 4, deployCooldownMs: 5000, hp: 27, range: 5,
    attackEveryMs: 1050, damage: 5, attack: "ice", slowFactor: 0.5, slowMs: 1800,
    color: "#67e8f9", unlockAt: 7, description: "Reduz a velocidade dos inimigos atingidos.",
    attackVisual: { height: 126, durationMs: 420, effect: "ice", shots: [{ atMs: 0, frame: 7, muzzle: { x: 0.97, y: 0.37 } }] },
  },
  ranger: {
    id: "ranger", label: "Ranger", role: "Laser", spriteKey: "ranger",
    price: 25, supply: 7, deployCooldownMs: 6000, hp: 24, range: 8,
    attackEveryMs: 900, damage: 11, attack: "laser", color: "#e879f9", unlockAt: 4,
    attackVisual: { height: 126, durationMs: 400, effect: "laser", shots: [{ atMs: 0, frame: 7, muzzle: { x: 0.97, y: 0.37 } }] },
    description: "Feixe instantâneo de grande alcance.",
  },
  bombardeiro: {
    id: "bombardeiro", label: "Bombardeiro", role: "Área", spriteKey: "ranger",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 25, range: 6.2,
    attackEveryMs: 1700, damage: 14, radius: 58, attack: "missile", color: "#fb923c", unlockAt: 6,
    attackVisual: { height: 126, durationMs: 440, effect: "microMissile", visualCount: 3, shots: [{ atMs: 0, frame: 7, muzzle: { x: 0.97, y: 0.37 } }] },
    description: "Míssil teleguiado com dano em área.",
  },
  guarda: {
    id: "guarda", label: "Guarda", role: "Artilheiro incendiário", spriteKey: "guarda",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 29, range: 2.5,
    attackEveryMs: 900, damage: 9, attack: "fireball", color: "#f59e0b", unlockAt: 1,
    attackVisual: { height: 126, durationMs: 420, effect: "fireball", shots: [{ atMs: 0, frame: 7, muzzle: { x: 0.97, y: 0.37 } }] },
    description: "Dispara projéteis incendiários contra o primeiro inimigo da rota.",
  },
};

export const ENEMIES = {
  medu: {
    id: "medu", label: "Medu", role: "Comum", hp: 28, speed: 28, damage: 5,
    attackEveryMs: 1300, baseDamage: 10, threat: 10, color: "#ef4444", scale: 1,
  },
  crix: {
    id: "crix", label: "Crix", role: "Corredor", hp: 24, speed: 46, damage: 4,
    attackEveryMs: 1000, baseDamage: 10, threat: 18, color: "#a855f7", scale: 1,
  },
  krulax: {
    id: "krulax", label: "Krulax", role: "Resistente", hp: 54, speed: 21, damage: 8,
    attackEveryMs: 1600, baseDamage: 15, threat: 14, color: "#f59e0b", scale: 1.08,
  },
  krakhul: {
    id: "krakhul", label: "Krakhul", role: "Elite", hp: 110, speed: 16, damage: 14,
    attackEveryMs: 1800, baseDamage: 30, threat: 24, color: "#f43f5e", scale: 1.45,
  },
};

export const ARENAS = {
  fase_01: {
    arenaId: "fase_01", palette: { primary: "#22d3ee", accent: "#f59e0b", shadow: "#030b14", haze: "#6b8da3" },
    ambientEffects: ["dust", "beacons", "heat"], waveIntensity: [0.28, 0.48, 0.72, 1],
    battlefieldTheme: { id: "colony", seed: 101, material: "metal", base: "bunker", entrance: "fortified", lane: "#173447", laneAlt: "#1d4052", edge: "#38bdf8", detail: "#f59e0b" },
  },
  fase_02: {
    arenaId: "fase_02", palette: { primary: "#22d3ee", accent: "#a78bfa", shadow: "#020b13", haze: "#b8d8df" },
    ambientEffects: ["fog", "spores", "bioluminescence"], waveIntensity: [0.3, 0.52, 0.76, 1],
    battlefieldTheme: { id: "jungle", seed: 202, material: "earth", base: "outpost", entrance: "overgrowth", lane: "#243d35", laneAlt: "#304c3c", edge: "#5eead4", detail: "#a78bfa" },
  },
  fase_03: {
    arenaId: "fase_03", palette: { primary: "#38bdf8", accent: "#fb923c", shadow: "#0b1118", haze: "#d0b28d" },
    ambientEffects: ["dust", "fissures", "sparks"], waveIntensity: [0.32, 0.54, 0.78, 1],
    battlefieldTheme: { id: "crater", seed: 303, material: "rock", base: "miner", entrance: "crater", lane: "#3b3635", laneAlt: "#49413d", edge: "#7dd3fc", detail: "#fb923c" },
  },
  fase_04: {
    arenaId: "fase_04", palette: { primary: "#67e8f9", accent: "#f472b6", shadow: "#0d0315", haze: "#9f7aea" },
    ambientEffects: ["spores", "pulse", "resin"], waveIntensity: [0.34, 0.56, 0.8, 1],
    battlefieldTheme: { id: "krulax", seed: 404, material: "chitin", base: "bio-shield", entrance: "maw", lane: "#392645", laneAlt: "#4a2b4e", edge: "#67e8f9", detail: "#f472b6" },
  },
  fase_05: {
    arenaId: "fase_05", palette: { primary: "#67e8f9", accent: "#ef4444", shadow: "#010408", haze: "#526575" },
    ambientEffects: ["smoke", "emergency", "searchlights"], waveIntensity: [0.36, 0.58, 0.82, 1],
    battlefieldTheme: { id: "station", seed: 505, material: "station", base: "bulkhead", entrance: "airlock", lane: "#17212a", laneAlt: "#202c35", edge: "#64748b", detail: "#ef4444" },
  },
  fase_06: {
    arenaId: "fase_06", palette: { primary: "#7dd3fc", accent: "#a78bfa", shadow: "#020617", haze: "#818cf8" },
    ambientEffects: ["rain", "lightning", "reflections"], waveIntensity: [0.38, 0.6, 0.84, 1],
    battlefieldTheme: { id: "storm", seed: 606, material: "wet-metal", base: "reactor", entrance: "gantry", lane: "#182a3b", laneAlt: "#20384b", edge: "#7dd3fc", detail: "#a78bfa" },
  },
  fase_07: {
    arenaId: "fase_07", palette: { primary: "#22d3ee", accent: "#fbbf24", shadow: "#020617", haze: "#0891b2" },
    ambientEffects: ["portal", "debris", "energy"], waveIntensity: [0.4, 0.62, 0.86, 1],
    battlefieldTheme: { id: "ancient", seed: 707, material: "ancient", base: "obelisk", entrance: "portal", lane: "#27343d", laneAlt: "#334650", edge: "#22d3ee", detail: "#fbbf24" },
  },
  fase_08: {
    arenaId: "fase_08", palette: { primary: "#67e8f9", accent: "#f43f5e", shadow: "#110317", haze: "#c026d3" },
    ambientEffects: ["spores", "pulse", "veins", "smoke"], waveIntensity: [0.44, 0.66, 0.88, 1],
    battlefieldTheme: { id: "hive", seed: 808, material: "organic", base: "core-shield", entrance: "womb", lane: "#3b173d", laneAlt: "#4b1d49", edge: "#c026d3", detail: "#f43f5e" },
  },
};

export const DECISIONS = {
  resupply: [
    { id: "supply", label: "Reabastecer", description: "+6 supply imediato.", effect: { supply: 6 } },
    { id: "repair", label: "Reparar núcleo", description: "+20 integridade da base.", effect: { integrity: 20 } },
  ],
  tempo: [
    { id: "rush", label: "Antecipar onda", description: "+25 energia, inimigos 8% mais rápidos.", effect: { energy: 25, enemySpeed: 1.08 } },
    { id: "fortify", label: "Fortificar", description: "+15 integridade, custa 2 supply.", effect: { integrity: 15 }, cost: { supply: 2 } },
  ],
  offense: [
    { id: "ballistic", label: "Munição perfurante", description: "+12% de dano para todas as tropas.", effect: { troopDamage: 1.12 } },
    { id: "control", label: "Campo criogênico", description: "+20% na duração de lentidão.", effect: { slowDuration: 1.2 } },
  ],
};

const wave = (enemies, decision = null) => ({ enemies, decision });
const phase = (id, name, subtitle, energy, cadenceMs, environment, targetDurationMs, waves, extra = {}) => ({
  id, name, subtitle, energy, baseIntegrity: 100, cadenceMs, environment,
  targetDurationMs, waves, ...ARENAS[id], ...extra,
});

export const PHASES = [
  phase("fase_01", "Perímetro Leste", "Primeiro contato", 80, 4800, "clear", 300000, [
    wave([{ type: "medu", count: 6 }], DECISIONS.resupply),
    wave([{ type: "crix", count: 4 }], DECISIONS.tempo),
    wave([{ type: "medu", count: 6 }, { type: "crix", count: 2 }], DECISIONS.offense),
    wave([{ type: "medu", count: 8 }, { type: "krulax", count: 2 }]),
  ]),
  phase("fase_02", "Floresta Exterior", "Movimento sob neblina", 90, 4000, "fog", 330000, [
    wave([{ type: "crix", count: 6 }], DECISIONS.resupply),
    wave([{ type: "medu", count: 6 }, { type: "crix", count: 4 }], DECISIONS.tempo),
    wave([{ type: "krulax", count: 10 }], DECISIONS.offense),
    wave([{ type: "crix", count: 8 }, { type: "krulax", count: 3 }]),
  ]),
  phase("fase_03", "Cratera Norte", "Blindados na linha", 100, 3520, "clear", 360000, [
    wave([{ type: "medu", count: 10 }, { type: "crix", count: 3 }], DECISIONS.resupply),
    wave([{ type: "krulax", count: 12 }], DECISIONS.tempo),
    wave([{ type: "crix", count: 8 }, { type: "medu", count: 6 }], DECISIONS.offense),
    wave([{ type: "krakhul", count: 3 }, { type: "krulax", count: 12 }]),
  ]),
  phase("fase_04", "Ninho Krulax", "A muralha de carne", 110, 3040, "clear", 390000, [
    wave([{ type: "krulax", count: 14 }], DECISIONS.resupply),
    wave([{ type: "crix", count: 12 }, { type: "medu", count: 2 }], DECISIONS.tempo),
    wave([{ type: "krulax", count: 12 }, { type: "medu", count: 10 }], DECISIONS.offense),
    wave([{ type: "krakhul", count: 5 }, { type: "crix", count: 10 }]),
  ]),
  phase("fase_05", "Estação Silenciosa", "Sombras entre as torres", 120, 2720, "dark", 420000, [
    wave([{ type: "medu", count: 16 }, { type: "crix", count: 9 }], DECISIONS.resupply),
    wave([{ type: "krulax", count: 24 }], DECISIONS.tempo),
    wave([{ type: "krakhul", count: 8 }, { type: "crix", count: 10 }], DECISIONS.offense),
    wave([{ type: "krakhul", count: 10 }, { type: "krulax", count: 12 }]),
  ]),
  phase("fase_06", "Tempestade Iônica", "A linha sob descarga", 130, 2400, "storm", 450000, [
    wave([{ type: "crix", count: 24 }], DECISIONS.resupply),
    wave([{ type: "krulax", count: 32 }], DECISIONS.tempo),
    wave([{ type: "medu", count: 22 }, { type: "krakhul", count: 10 }], DECISIONS.offense),
    wave([{ type: "crix", count: 20 }, { type: "krakhul", count: 8 }]),
  ]),
  phase("fase_07", "Portal Ancestral", "O enxame sem fim", 140, 2080, "clear", 480000, [
    wave([{ type: "krulax", count: 40 }], DECISIONS.resupply),
    wave([{ type: "crix", count: 28 }, { type: "medu", count: 8 }], DECISIONS.tempo),
    wave([{ type: "krakhul", count: 26 }], DECISIONS.offense),
    wave([{ type: "krakhul", count: 22 }, { type: "krulax", count: 12 }]),
  ]),
  phase("fase_08", "Coração da Colmeia", "Elimine o Krakhul Alfa", 150, 1760, "hive", 540000, [
    wave([{ type: "medu", count: 24 }, { type: "crix", count: 30 }], DECISIONS.resupply),
    wave([{ type: "krulax", count: 56 }], DECISIONS.tempo),
    wave([{ type: "krakhul", count: 34 }], DECISIONS.offense),
    wave([{ type: "krulax", count: 50 }, { type: "krakhul", variant: "alpha", count: 1 }]),
  ], { boss: true }),
];

export const getPhase = (id) => PHASES.find((entry) => entry.id === id) || null;
export const getPhaseIndex = (id) => PHASES.findIndex((entry) => entry.id === id);
export const getUnlockedTroops = (phaseIndex) => Object.values(TROOPS)
  .filter((troop) => troop.unlockAt <= phaseIndex)
  .sort((left, right) => {
    const leftStructure = left.id === "muralhaReforcada";
    const rightStructure = right.id === "muralhaReforcada";
    if (leftStructure !== rightStructure) return leftStructure ? 1 : -1;
    return left.unlockAt - right.unlockAt;
  });
