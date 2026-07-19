export const TROOPS = {
  colono: {
    id: "colono", label: "Colono", role: "Linha de frente", spriteKey: "colono",
    price: 10, supply: 3, deployCooldownMs: 4000, hp: 34, range: 0.9,
    attackEveryMs: 1000, damage: 8, attack: "melee", color: "#fbbf24", unlockAt: 0,
    idleVisual: {
      durationMs: 1400,
      timeline: [
        { atMs: 0, frame: 0 },
        { atMs: 175, frame: 1 },
        { atMs: 350, frame: 2 },
        { atMs: 525, frame: 3 },
        { atMs: 700, frame: 4 },
        { atMs: 875, frame: 5 },
        { atMs: 1050, frame: 6 },
        { atMs: 1225, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 420,
      // Root anchors compensate for the different transparent padding in each frame.
      frameAnchors: {
        idle: [
          { x: 0.3763, y: 0.9089, scale: 1 },
          { x: 0.3902, y: 0.9089, scale: 1 },
          { x: 0.3835, y: 0.9089, scale: 1 },
          { x: 0.3875, y: 0.9089, scale: 1 },
          { x: 0.3888, y: 0.9089, scale: 1 },
          { x: 0.3929, y: 0.9089, scale: 1 },
          { x: 0.3879, y: 0.9089, scale: 1 },
          { x: 0.3951, y: 0.9089, scale: 1 },
        ],
        attack: [
          { x: 0.316, y: 0.877, scale: 1.165 },
          { x: 0.226, y: 0.888, scale: 1.199 },
          { x: 0.364, y: 0.775, scale: 1.134 },
          { x: 0.344, y: 0.775, scale: 1.145 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 },
        { atMs: 96, frame: 1 },
        { atMs: 192, frame: 2 },
        { atMs: 288, frame: 3 },
      ],
    },
    description: "Combatente barato para segurar a linha.",
  },
  reator: {
    id: "reator", label: "Reator de Energia", role: "Economia", spriteKey: "reator",
    price: 10, supply: 4, deployCooldownMs: 20000, hp: 16, range: 0,
    attackEveryMs: 6000, damage: 0, attack: "energy", color: "#22d3ee", unlockAt: 0,
    maxDeployed: 5, energyPerPulse: 1, waveEnergyBonus: 8, spriteOffsetY: 10,
    idleVisual: {
      durationMs: 2000,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 250, frame: 1 },
        { atMs: 500, frame: 2 }, { atMs: 750, frame: 3 },
        { atMs: 1000, frame: 4 }, { atMs: 1250, frame: 5 },
        { atMs: 1500, frame: 6 }, { atMs: 1750, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 700, effect: "energyPulse",
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 90, frame: 1 },
        { atMs: 180, frame: 2 }, { atMs: 270, frame: 3 },
        { atMs: 360, frame: 4 }, { atMs: 450, frame: 5 },
        { atMs: 540, frame: 6 }, { atMs: 630, frame: 7 },
      ],
    },
    description: "Gera 1 energia a cada 6s. Até 5 ativos, com implantação a cada 20s.",
  },
  marine: {
    id: "marine", label: "Marine", role: "Rajada", spriteKey: "marine",
    price: 15, supply: 5, deployCooldownMs: 5000, hp: 30, range: 5.5,
    attackEveryMs: 2000, damage: 4, burst: 3, burstIntervalMs: 120,
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
  medicaNanites: {
    id: "medicaNanites", label: "Médica de Nanites", role: "Suporte / Cura", spriteKey: "medicaNanites",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 24, range: 5,
    attack: "naniteBullet", damage: 2, attackEveryMs: 900, projectileSpeed: 230,
    healRangeTiles: 5, maxHealingPerCharge: 20, healPulseAmount: 2,
    healPulseEveryMs: 400, healStartThreshold: 0.75, healCooldownMs: 5000,
    color: "#2dd4bf", unlockAt: 0,
    assetStates: ["idle", "heal", "attack", "cooldown"],
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    healVisual: {
      state: "heal", height: 126, durationMs: 1600, loop: true,
      muzzle: { x: 0.82, y: 0.4 },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisual: {
      state: "attack", height: 126, durationMs: 480, releaseMs: 180,
      effect: "naniteBullet",
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 60, frame: 1 },
        { atMs: 120, frame: 2 }, { atMs: 180, frame: 3 },
        { atMs: 240, frame: 4 }, { atMs: 300, frame: 5 },
        { atMs: 360, frame: 6 }, { atMs: 420, frame: 7 },
      ],
      shots: [{ atMs: 180, frame: 3, muzzle: { x: 0.84, y: 0.39 } }],
    },
    cooldownVisual: {
      state: "cooldown", height: 126, durationMs: 1200, loop: true,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 150, frame: 1 },
        { atMs: 300, frame: 2 }, { atMs: 450, frame: 3 },
        { atMs: 600, frame: 4 }, { atMs: 750, frame: 5 },
        { atMs: 900, frame: 6 }, { atMs: 1050, frame: 7 },
      ],
    },
    description: "Cura a tropa mais ferida à sua frente. Após restaurar até 20 de vida, precisa recarregar sua arma.",
  },
  lumiUrsa7: {
    id: "lumiUrsa7", label: "Lumi e URSA-7", role: "Controle / Defesa", spriteKey: "lumiUrsa7",
    price: 22, supply: 7, deployCooldownMs: 7000, hp: 68, range: 2,
    attack: "repulsor", damage: 7, attackEveryMs: 1900, projectileSpeed: 430,
    repulsorRangeTiles: 2, pushDistanceTiles: 1, pushVisualDurationMs: 300,
    stunChance: 0.1, stunMs: 2000,
    defenseDamageFactor: 0.5, transitionInMs: 720, shieldActivationMs: 520,
    defenseExitDelayMs: 350, transitionOutMs: 720,
    color: "#38d4e8", unlockAt: 11,
    healthBarOffset: 92, healthBarWidth: 72,
    assetStates: ["idle", "attack", "transitionIn", "defense", "transitionOut"],
    idleVisual: {
      height: 164,
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisual: {
      state: "attack", height: 190, durationMs: 640, releaseMs: 320, effect: "repulsorFist",
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 80, frame: 1 },
        { atMs: 160, frame: 2 }, { atMs: 240, frame: 3 },
        { atMs: 320, frame: 4 }, { atMs: 400, frame: 5 },
        { atMs: 480, frame: 6 }, { atMs: 560, frame: 7 },
      ],
      shots: [{ atMs: 320, frame: 4, muzzle: { x: 0.826, y: 0.563 } }],
      frameAnchors: Object.fromEntries(
        ["idle", "attack", "transitionIn", "defense", "transitionOut"]
          .map((state) => [state, Array.from({ length: 8 }, () => ({ x: 0.4375, y: 0.96875 }))]),
      ),
    },
    transitionInVisual: { state: "transitionIn", height: 164, durationMs: 720 },
    defenseVisual: { state: "defense", height: 164, durationMs: 1200, loop: true },
    transitionOutVisual: { state: "transitionOut", height: 164, durationMs: 720 },
    defenseShieldVisual: {
      offsetX: 2, offsetY: -4, radiusX: 67, radiusY: 61,
      transitionOut: { offsetY: -10, radiusY: 69 },
    },
    description: "Empurra inimigos próximos e entra em modo defensivo quando a linha de frente é rompida.",
  },
  muralhaReforcada: {
    id: "muralhaReforcada", label: "Muralha", role: "Defesa", spriteKey: "muralhaReforcada",
    price: 15, supply: 6, deployCooldownMs: 2500, hp: 120, range: 0,
    attackEveryMs: 0, damage: 0, attack: "none", color: "#94a3b8", unlockAt: 0,
    description: "Bloqueia uma rota e absorve muito dano.",
  },
  demolidora: {
    id: "demolidora", label: "Demolidora de Minas", role: "Armadilha / Preparação", spriteKey: "demolidora",
    price: 16, supply: 5, deployCooldownMs: 6000, hp: 20, range: 3,
    attackEveryMs: 8000, damage: 36, radius: 58, attack: "mine", color: "#22d3ee", unlockAt: 5,
    mineRangeCols: 3, maxActiveMines: 5, mineFlightMs: 650, mineArcHeight: 90,
    closeRange: 2, closeDamage: 2, closeAttackEveryMs: 650,
    assetStates: ["idle", "attackMine", "attackGun", "mine"],
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisuals: {
      mine: {
        state: "attackMine", height: 126, durationMs: 640,
        timeline: [
          { atMs: 0, frame: 0 }, { atMs: 80, frame: 1 },
          { atMs: 160, frame: 2 }, { atMs: 240, frame: 3 },
          { atMs: 320, frame: 4 }, { atMs: 400, frame: 5 },
          { atMs: 480, frame: 6 }, { atMs: 560, frame: 7 },
        ],
        shots: [{ atMs: 320, frame: 4, muzzle: { x: 0.92, y: 0.43 } }],
      },
      gun: {
        state: "attackGun", height: 126, durationMs: 480, effect: "demolidoraBullet",
        timeline: [
          { atMs: 0, frame: 0 }, { atMs: 60, frame: 1 },
          { atMs: 120, frame: 2 }, { atMs: 180, frame: 3 },
          { atMs: 240, frame: 4 }, { atMs: 300, frame: 5 },
          { atMs: 360, frame: 6 }, { atMs: 420, frame: 7 },
        ],
        shots: [{ atMs: 180, frame: 3, muzzle: { x: 0.93, y: 0.34 } }],
      },
    },
    attackVisual: {
      height: 126,
      frameAnchors: {
        idle: Array.from({ length: 8 }, () => ({ x: 0.3875, y: 0.93 })),
        attackMine: Array.from({ length: 8 }, () => ({ x: 0.3875, y: 0.93 })),
        attackGun: Array.from({ length: 8 }, () => ({ x: 0.3875, y: 0.93 })),
      },
    },
    description: "Lança minas magnéticas em células vazias e usa uma arma leve contra ameaças próximas.",
  },
  "caçador": {
    id: "caçador", label: "Caçador", role: "Escopeta", spriteKey: "cacador",
    price: 12, supply: 4, deployCooldownMs: 5000, hp: 27, range: 3.4,
    attackEveryMs: 1420, damage: 5, pellets: 5, attack: "shotgun", color: "#fb7185", unlockAt: 5,
    idleVisual: {
      durationMs: 1400,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 175, frame: 1 },
        { atMs: 350, frame: 2 }, { atMs: 525, frame: 3 },
        { atMs: 700, frame: 4 }, { atMs: 875, frame: 5 },
        { atMs: 1050, frame: 6 }, { atMs: 1225, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 420, effect: "shotgun",
      frameAnchors: {
        idle: [
          { x: 0.4688, y: 0.9089 }, { x: 0.4683, y: 0.9089 },
          { x: 0.4674, y: 0.9089 }, { x: 0.4683, y: 0.9089 },
          { x: 0.4674, y: 0.9089 }, { x: 0.4665, y: 0.9089 },
          { x: 0.4665, y: 0.9089 }, { x: 0.4679, y: 0.9089 },
        ],
        attack: [
          { x: 0.3629, y: 0.9089 }, { x: 0.4263, y: 0.9089 },
          { x: 0.4219, y: 0.9089 }, { x: 0.4317, y: 0.9089 },
          { x: 0.4263, y: 0.9089 }, { x: 0.4339, y: 0.9089 },
          { x: 0.4362, y: 0.9089 }, { x: 0.4607, y: 0.9089 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 56, frame: 1 },
        { atMs: 112, frame: 2 }, { atMs: 168, frame: 3 },
        { atMs: 224, frame: 4 }, { atMs: 280, frame: 5 },
        { atMs: 336, frame: 6 }, { atMs: 392, frame: 7 },
      ],
      shots: [{ atMs: 0, frame: 0, muzzle: { x: 0.7125, y: 0.3696 } }],
    },
    description: "Cone de estilhaços contra grupos próximos.",
  },
  sniper: {
    id: "sniper", label: "Sniper", role: "Precisão", spriteKey: "sniper",
    price: 20, supply: 7, deployCooldownMs: 6000, hp: 22, range: 8.8,
    attackEveryMs: 3000, damage: 30, attack: "bullet", color: "#f97316", unlockAt: 3,
    attackVisual: { height: 126, durationMs: 440, effect: "sniperBullet", shots: [{ atMs: 0, frame: 12, muzzle: { x: 0.995, y: 0.4 } }] },
    description: "Dano extremo em alvos resistentes e elites.",
  },
  incinerador: {
    id: "incinerador", label: "Incinerador", role: "Anti-enxame", spriteKey: "incinerador",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 29, range: 2.5,
    attackEveryMs: 160, damage: 1, attack: "flame", color: "#fb923c", unlockAt: 3,
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 640, effect: "flame",
      frameAnchors: {
        idle: [
          { x: 0.4102, y: 0.9258 }, { x: 0.4102, y: 0.9258 },
          { x: 0.4102, y: 0.9258 }, { x: 0.4121, y: 0.9258 },
          { x: 0.4121, y: 0.9219 }, { x: 0.4102, y: 0.9219 },
          { x: 0.4141, y: 0.9219 }, { x: 0.4121, y: 0.9219 },
        ],
        attack: [
          { x: 0.4121, y: 0.9258, scale: 1.0472 }, { x: 0.4102, y: 0.9258, scale: 1.1623 },
          { x: 0.4102, y: 0.9258, scale: 1.1503 }, { x: 0.4121, y: 0.9258, scale: 1.0829 },
          { x: 0.4141, y: 0.9258, scale: 1.0829 }, { x: 0.4102, y: 0.9258, scale: 1.1503 },
          { x: 0.4102, y: 0.9258, scale: 1.0571 }, { x: 0.4141, y: 0.9258, scale: 1.1212 },
        ],
      },
      frameMuzzles: [
        { x: 0.8438, y: 0.5594 }, { x: 0.7656, y: 0.5771 },
        { x: 0.7891, y: 0.5877 }, { x: 0.8164, y: 0.5683 },
        { x: 0.8242, y: 0.5528 }, { x: 0.7891, y: 0.5517 },
        { x: 0.8125, y: 0.5262 }, { x: 0.8164, y: 0.5692 },
      ],
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 80, frame: 1 },
        { atMs: 160, frame: 2 }, { atMs: 240, frame: 3 },
        { atMs: 320, frame: 4 }, { atMs: 400, frame: 5 },
        { atMs: 480, frame: 6 }, { atMs: 560, frame: 7 },
      ],
      shots: [{ atMs: 0, frame: 0, muzzle: { x: 0.83, y: 0.38 } }],
    },
    description: "Canaliza fogo contínuo e atinge todos os inimigos próximos da rota.",
  },
  krio: {
    id: "krio", label: "Krio", role: "Controle", spriteKey: "krio",
    price: 12, supply: 4, deployCooldownMs: 5000, hp: 27, range: 5,
    attackEveryMs: 1420, damage: 5, attack: "ice", slowFactor: 0.5, slowMs: 1800,
    color: "#67e8f9", unlockAt: 7,
    idleVisual: {
      durationMs: 2000,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 250, frame: 1 },
        { atMs: 500, frame: 2 }, { atMs: 750, frame: 3 },
        { atMs: 1000, frame: 4 }, { atMs: 1250, frame: 5 },
        { atMs: 1500, frame: 6 }, { atMs: 1750, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 640, effect: "ice",
      frameAnchors: {
        idle: [
          { x: 0.5, y: 0.9219, scale: 1 }, { x: 0.5, y: 0.9219, scale: 1 },
          { x: 0.5, y: 0.9219, scale: 1 }, { x: 0.5, y: 0.9219, scale: 1 },
          { x: 0.5, y: 0.9219, scale: 1 }, { x: 0.5, y: 0.9219, scale: 1 },
          { x: 0.498, y: 0.9219, scale: 1 }, { x: 0.5, y: 0.9219, scale: 1 },
        ],
        attack: [
          { x: 0.4141, y: 0.9219, scale: 1 }, { x: 0.4121, y: 0.9258, scale: 1 },
          { x: 0.4121, y: 0.9258, scale: 1 }, { x: 0.4121, y: 0.9219, scale: 1 },
          { x: 0.4121, y: 0.9219, scale: 1 }, { x: 0.4121, y: 0.9219, scale: 1 },
          { x: 0.4121, y: 0.9219, scale: 1 }, { x: 0.4121, y: 0.9219, scale: 1 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 80, frame: 1 },
        { atMs: 160, frame: 2 }, { atMs: 240, frame: 3 },
        { atMs: 320, frame: 4 }, { atMs: 400, frame: 5 },
        { atMs: 480, frame: 6 }, { atMs: 560, frame: 7 },
      ],
      shots: [{ atMs: 0, frame: 0, muzzle: { x: 0.78, y: 0.51 } }],
    },
    description: "Reduz a velocidade dos inimigos atingidos.",
  },
  ranger: {
    id: "ranger", label: "Ranger", role: "Laser", spriteKey: "ranger",
    price: 25, supply: 7, deployCooldownMs: 6000, hp: 24, range: 8,
    attackEveryMs: 1500, damage: 11, attack: "laser", color: "#e879f9", unlockAt: 4,
    idleVisual: {
      durationMs: 2000,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 250, frame: 1 },
        { atMs: 500, frame: 2 }, { atMs: 750, frame: 3 },
        { atMs: 1000, frame: 4 }, { atMs: 1250, frame: 5 },
        { atMs: 1500, frame: 6 }, { atMs: 1750, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 800, effect: "laser",
      frameAnchors: {
        idle: [
          { x: 0.4496, y: 0.9089 }, { x: 0.4509, y: 0.9089 },
          { x: 0.4478, y: 0.9089 }, { x: 0.4455, y: 0.9089 },
          { x: 0.4496, y: 0.9089 }, { x: 0.4509, y: 0.9089 },
          { x: 0.4482, y: 0.9089 }, { x: 0.4518, y: 0.9089 },
        ],
        attack: [
          { x: 0.4464, y: 0.9089 }, { x: 0.4362, y: 0.9071 },
          { x: 0.5174, y: 0.9089 }, { x: 0.442, y: 0.9089 },
          { x: 0.4402, y: 0.9089 }, { x: 0.4424, y: 0.9089 },
          { x: 0.4411, y: 0.9089 }, { x: 0.4464, y: 0.9089 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 100, frame: 1 },
        { atMs: 200, frame: 2 }, { atMs: 300, frame: 3 },
        { atMs: 400, frame: 4 }, { atMs: 500, frame: 5 },
        { atMs: 600, frame: 6 }, { atMs: 700, frame: 7 },
      ],
      shots: [{ atMs: 0, frame: 0, muzzle: { x: 0.7714, y: 0.3827 } }],
    },
    description: "Feixe instantâneo de grande alcance.",
  },
  bombardeiro: {
    id: "bombardeiro", label: "Bombardeiro", role: "Área", spriteKey: "bombardeiro",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 25, range: 6.2,
    attackEveryMs: 2300, damage: 14, radius: 58, attack: "missile", color: "#fb923c", unlockAt: 6,
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisual: {
      height: 126, durationMs: 720, effect: "microMissile", visualCount: 3,
      frameAnchors: {
        idle: [
          { x: 0.498, y: 0.9219 }, { x: 0.5, y: 0.9219 },
          { x: 0.5, y: 0.9219 }, { x: 0.498, y: 0.9258 },
          { x: 0.5, y: 0.9219 }, { x: 0.498, y: 0.9219 },
          { x: 0.498, y: 0.9219 }, { x: 0.5, y: 0.9219 },
        ],
        attack: [
          { x: 0.498, y: 0.9219, scale: 1.0212 }, { x: 0.498, y: 0.9219, scale: 1.0212 },
          { x: 0.5, y: 0.9219, scale: 1.0212 }, { x: 0.5, y: 0.9219, scale: 1.0212 },
          { x: 0.498, y: 0.9219, scale: 1.0212 }, { x: 0.498, y: 0.9219, scale: 1.0212 },
          { x: 0.5, y: 0.9219, scale: 1.0212 }, { x: 0.502, y: 0.9219, scale: 1.0212 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 90, frame: 1 },
        { atMs: 180, frame: 2 }, { atMs: 270, frame: 3 },
        { atMs: 360, frame: 4 }, { atMs: 450, frame: 5 },
        { atMs: 540, frame: 6 }, { atMs: 630, frame: 7 },
      ],
      shots: [{ atMs: 0, frame: 0, muzzle: { x: 0.8, y: 0.595 } }],
    },
    description: "Míssil teleguiado com dano em área.",
  },
  artilheiraMorteiro: {
    id: "artilheiraMorteiro", label: "Artilheira de Morteiro", role: "Artilharia indireta",
    spriteKey: "artilheiraMorteiro",
    price: 22, supply: 6, deployCooldownMs: 7000, hp: 18,
    minRange: 3, range: 6, attackEveryMs: 3000, damage: 28,
    collateralMultiplier: 0.3, projectileFlightMs: 850, projectileArcHeight: 150,
    attack: "mortar", color: "#fbbf24", unlockAt: 8,
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 },
        { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 },
        { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisual: {
      height: 118, aspectRatio: 1.5, durationMs: 960, effect: "mortarShell",
      frameAnchors: {
        idle: [
          { x: 0.5, y: 0.9727 }, { x: 0.5, y: 0.9688 },
          { x: 0.4987, y: 0.9688 }, { x: 0.4987, y: 0.9688 },
          { x: 0.4987, y: 0.9727 }, { x: 0.4987, y: 0.9688 },
          { x: 0.5013, y: 0.9727 }, { x: 0.5, y: 0.9688 },
        ],
        attack: [
          { x: 0.5, y: 0.9688 }, { x: 0.4987, y: 0.9688 },
          { x: 0.4987, y: 0.9688 }, { x: 0.5, y: 0.9688 },
          { x: 0.6367, y: 0.9688 }, { x: 0.4987, y: 0.9727 },
          { x: 0.4987, y: 0.9727 }, { x: 0.5013, y: 0.9727 },
        ],
      },
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 120, frame: 1 },
        { atMs: 240, frame: 2 }, { atMs: 360, frame: 3 },
        { atMs: 480, frame: 4 }, { atMs: 600, frame: 5 },
        { atMs: 720, frame: 6 }, { atMs: 840, frame: 7 },
      ],
      shots: [{ atMs: 480, frame: 4, muzzle: { x: 0.866, y: 0.105 } }],
    },
    description: "Morteiro automático que ignora inimigos próximos e bombardeia grupos distantes.",
  },
  colossoImpacto: {
    id: "colossoImpacto", label: "Colosso de Impacto", role: "Tanque / Controle", spriteKey: "colossoImpacto",
    price: 22, supply: 8, deployCooldownMs: 10000, hp: 180, range: 0.9,
    attackEveryMs: 1800, damage: 5, attack: "tileMelee", color: "#34d399", unlockAt: 9,
    specialDamage: 14, specialEveryMs: 16000, specialStunMs: 800, maxDeployed: 2,
    healthBarOffset: 104, healthBarWidth: 74, spriteOffsetY: 8,
    assetStates: ["idle", "attack", "special"], flipX: true,
    idleVisual: {
      durationMs: 1600,
      timeline: [
        { atMs: 0, frame: 0 }, { atMs: 200, frame: 1 }, { atMs: 400, frame: 2 }, { atMs: 600, frame: 3 },
        { atMs: 800, frame: 4 }, { atMs: 1000, frame: 5 }, { atMs: 1200, frame: 6 }, { atMs: 1400, frame: 7 },
      ],
    },
    attackVisuals: {
      normal: {
        state: "attack", height: 158, durationMs: 800, impactMs: 400,
        timeline: [
          { atMs: 0, frame: 0 }, { atMs: 100, frame: 1 }, { atMs: 200, frame: 2 }, { atMs: 300, frame: 3 },
          { atMs: 400, frame: 4 }, { atMs: 500, frame: 5 }, { atMs: 600, frame: 6 }, { atMs: 700, frame: 7 },
        ],
      },
      special: {
        state: "special", height: 158, durationMs: 1280, impactMs: 640,
        timeline: [
          { atMs: 0, frame: 0 }, { atMs: 160, frame: 1 }, { atMs: 320, frame: 2 }, { atMs: 480, frame: 3 },
          { atMs: 640, frame: 4 }, { atMs: 800, frame: 5 }, { atMs: 960, frame: 6 }, { atMs: 1120, frame: 7 },
        ],
      },
    },
    attackVisual: {
      height: 158,
      frameAnchors: {
        idle: [{ x: 0.4961, y: 0.9648 }, { x: 0.5, y: 0.9648 }, { x: 0.4961, y: 0.9648 }, { x: 0.5, y: 0.9648 }, { x: 0.4961, y: 0.9688 }, { x: 0.502, y: 0.9688 }, { x: 0.498, y: 0.9688 }, { x: 0.5, y: 0.9688 }],
        attack: [{ x: 0.498, y: 0.9688 }, { x: 0.5, y: 0.9648 }, { x: 0.5, y: 0.9688 }, { x: 0.5039, y: 0.9688 }, { x: 0.6543, y: 0.9688 }, { x: 0.502, y: 0.9688 }, { x: 0.498, y: 0.9688 }, { x: 0.5, y: 0.9688 }],
        special: [{ x: 0.498, y: 0.9688 }, { x: 0.5117, y: 0.9648 }, { x: 0.502, y: 0.9648 }, { x: 0.5, y: 0.9648 }, { x: 0.5273, y: 0.9688 }, { x: 0.5098, y: 0.9688 }, { x: 0.4961, y: 0.9688 }, { x: 0.502, y: 0.9688 }],
      },
    },
    description: "Frontline robot that holds a route and crushes every enemy in its tile.",
  },
  guarda: {
    id: "guarda", label: "Guarda", role: "Artilheiro incendiário", spriteKey: "guarda",
    price: 18, supply: 5, deployCooldownMs: 6000, hp: 29, range: 10,
    attackEveryMs: 1500, damage: 9, attack: "fireball", color: "#f59e0b", unlockAt: 1,
    attackVisual: { height: 126, durationMs: 420, effect: "fireball", shots: [{ atMs: 0, frame: 7, muzzle: { x: 0.97, y: 0.37 } }] },
    description: "Dispara projéteis incendiários contra o primeiro inimigo da rota.",
  },
};

export const ENEMIES = {
  medu: {
    id: "medu", label: "Medu", role: "Comum", hp: 28, speed: 28, damage: 5,
    attackEveryMs: 1300, baseDamage: 10, threat: 10, color: "#ef4444", scale: 1,
    description: "Batedor da colmeia que avança em formação e pressiona qualquer defesa desguarnecida.",
  },
  neurax: {
    id: "neurax", label: "Neurax", role: "Comum de força", hp: 36, speed: 23, damage: 8,
    attackEveryMs: 1500, baseDamage: 12, threat: 10, color: "#7c3aed", scale: 1,
    description: "Variante robusta do Medu, criada para resistir ao fogo sustentado e romper a linha.",
  },
  oculis: {
    id: "oculis", label: "Oculis", role: "Comum veloz", hp: 24, speed: 36, damage: 5,
    attackEveryMs: 1050, baseDamage: 8, threat: 10, color: "#06b6d4", scale: 1,
    description: "Explorador ágil que troca resistência por velocidade para alcançar o núcleo rapidamente.",
  },
  crix: {
    id: "crix", label: "Crix", role: "Corredor", hp: 24, speed: 46, damage: 4,
    attackEveryMs: 1000, baseDamage: 10, threat: 18, color: "#a855f7", scale: 1,
    description: "Corredor quitinoso que explora brechas e força respostas rápidas em sua rota.",
  },
  vexar: {
    id: "vexar", label: "Vexar", role: "Corredor de força", hp: 30, speed: 39, damage: 6,
    attackEveryMs: 1150, baseDamage: 12, threat: 18, color: "#d946ef", scale: 1,
    description: "Evolução de força do Crix, mais resistente e perigosa quando alcança as tropas.",
  },
  silex: {
    id: "silex", label: "Silex", role: "Corredor veloz", hp: 22, speed: 54, damage: 4,
    attackEveryMs: 850, baseDamage: 8, threat: 18, color: "#84cc16", scale: 1,
    description: "A forma mais veloz da família Crix, frágil, mas capaz de atravessar uma rota em instantes.",
  },
  krulax: {
    id: "krulax", label: "Krulax", role: "Resistente", hp: 54, speed: 21, damage: 8,
    attackEveryMs: 1600, baseDamage: 15, threat: 14, color: "#f59e0b", scale: 1.08,
    description: "Organismo blindado que absorve disparos enquanto abre caminho para o restante do enxame.",
  },
  myrkon: {
    id: "myrkon", label: "Myrkon", role: "Resistente de força", hp: 70, speed: 17, damage: 12,
    attackEveryMs: 1800, baseDamage: 18, threat: 14, color: "#65a30d", scale: 1.08,
    description: "Massa de assalto pesada, lenta e preparada para sobreviver a grandes concentrações de dano.",
  },
  zhyra: {
    id: "zhyra", label: "Zhyra", role: "Resistente veloz", hp: 48, speed: 28, damage: 7,
    attackEveryMs: 1250, baseDamage: 12, threat: 14, color: "#ec4899", scale: 1.08,
    description: "Variante móvel do Krulax que conserva a carapaça resistente sem abrir mão da velocidade.",
  },
  krakhul: {
    id: "krakhul", label: "Krakhul", role: "Elite", hp: 110, speed: 16, damage: 14,
    attackEveryMs: 1800, baseDamage: 30, threat: 24, color: "#f43f5e", scale: 1.45,
    description: "Elite colossal da colmeia, capaz de suportar uma defesa inteira e devastar o núcleo.",
  },
  brakor: {
    id: "brakor", label: "Brakor", role: "Elite de força", hp: 135, speed: 13, damage: 19,
    attackEveryMs: 2050, baseDamage: 35, threat: 24, color: "#ef4444", scale: 1.45,
    description: "Forma de força do Krakhul, com carapaça ampliada e impacto destrutivo contra a base.",
  },
  aurakh: {
    id: "aurakh", label: "Aurakh", role: "Elite veloz", hp: 95, speed: 21, damage: 13,
    attackEveryMs: 1450, baseDamage: 25, threat: 24, color: "#facc15", scale: 1.45,
    description: "Elite veloz que combina massa, agressividade e avanço rápido para romper linhas frágeis.",
  },
  parasitaSaltador: {
    id: "parasitaSaltador", label: "Parasita Saltador", role: "Infiltrador / assassino",
    hp: 16, speed: 42, damage: 2, attackEveryMs: 450, baseDamage: 7, threat: 16,
    color: "#ec168c", scale: 0.72,
    assetStates: ["idle", "walking", "attack", "jump"],
    jumpDurationMs: 720, jumpArcHeight: 96, attackSlowFactor: 0.65,
    attachmentOffsetY: -34,
    description: "Infiltrador que salta sobre a linha, prende-se a uma tropa e reduz sua velocidade de ataque.",
  },
  magoAbissal: {
    id: "magoAbissal", label: "Mago Abissal", role: "Suporte à distância", hp: 52, speed: 18, damage: 18,
    attack: "arcane", range: 4.5, chargeMs: 900, projectileSpeed: 130,
    attackEveryMs: 3200, baseDamage: 18, threat: 18, color: "#a855f7", scale: 1.18,
    spriteOffsetY: -10, airborne: true,
    attackVisual: { durationMs: 1300, releaseMs: 400, muzzle: { x: 0.22, y: 0.2 }, effect: "abyssOrb" },
    description: "Conjurador flutuante que ataca de longe com orbes abissais após uma breve canalização.",
  },
  estilha: {
    id: "estilha", label: "Estilha", role: "Predador de vidro",
    hp: 18, speed: 58, damage: 5, attackEveryMs: 700, baseDamage: 8, threat: 12, energyDropChance: 0.15,
    color: "#7fffd4", scale: 0.68, proceduralKind: "estilha", chapterId: "chapter_02",
    animationFrameMs: { idle: 105, walking: 70 },
    attackVisual: { durationMs: 520 },
    description: "Uma lasca viva que atravessa a linha antes que o cristal termine de ressoar.",
  },
  vitrarca: {
    id: "vitrarca", label: "Vitrarca", role: "Duelista prismático",
    hp: 62, speed: 26, damage: 11, attackEveryMs: 1300, baseDamage: 16, threat: 18, energyDropChance: 0.15,
    color: "#8b5cf6", scale: 1.12, proceduralKind: "vitrarca", chapterId: "chapter_02",
    animationFrameMs: { idle: 115, walking: 90 },
    attackVisual: { durationMs: 640 },
    description: "Um caçador equilibrado, protegido por espelhos vivos e lâminas de vidro-marinho.",
  },
  obsidonte: {
    id: "obsidonte", label: "Obsidonte", role: "Colosso de cerco",
    hp: 180, speed: 10, damage: 24, attackEveryMs: 2200, baseDamage: 40, threat: 30, energyDropChance: 0.15,
    color: "#ffcf70", scale: 1.65, proceduralKind: "obsidonte", chapterId: "chapter_02",
    animationFrameMs: { idle: 140, walking: 120 },
    attackVisual: { durationMs: 900 },
    description: "Uma fortaleza ambulante de obsidiana, lenta e quase impossível de fragmentar.",
  },
  refrator: {
    id: "refrator", label: "Refrator", role: "Artilharia prismática",
    hp: 60, speed: 19, damage: 14, attack: "arcane", range: 4, chargeMs: 650, projectileSpeed: 170,
    attackEveryMs: 2600, baseDamage: 16, threat: 20, energyDropChance: 0.15, color: "#7fffd4", scale: 1.05,
    spriteOffsetY: -8, airborne: true, proceduralKind: "refrator", chapterId: "chapter_02",
    animationFrameMs: { idle: 100, walking: 80 },
    attackVisual: { durationMs: 1050, releaseMs: 320, muzzle: { x: 0.45, y: 0.34 }, effect: "prismBolt" },
    description: "Uma lente predatória que paira atrás do enxame e dispara luz solidificada.",
  },
  crisalio: {
    id: "crisalio", label: "Crisálio", role: "Santuário prismático",
    hp: 105, speed: 7, damage: 4, attackEveryMs: 2500, baseDamage: 20, threat: 30, energyDropChance: 0.15,
    color: "#a78bfa", scale: 1.42, proceduralKind: "crisalio", chapterId: "chapter_02",
    assetStates: ["walking", "attack", "idle", "pulse"],
    attackVisual: { durationMs: 960, impactMs: 480 },
    shieldPulseEveryMs: 7000, shieldPulseVisualMs: 960,
    shieldBase: 18, shieldMaxHpFactor: 0.12, shieldCap: 42,
    shieldTargetTypes: ["estilha", "vitrarca", "obsidonte", "refrator"],
    description: "Um santuário ambulante de obsidiana cuja coroa renova o manto cristalino do Mar de Vidro.",
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
  fase_09: {
    arenaId: "fase_09", palette: { primary: "#7fffd4", accent: "#8b5cf6", shadow: "#080a12", haze: "#a7f3d0" },
    ambientEffects: ["glassDust", "refraction", "fissures"], waveIntensity: [0.34, 0.5, 0.66, 0.82, 1],
    battlefieldTheme: { id: "obsidian-coast", seed: 909, material: "obsidian-glass", base: "glass-bastion", entrance: "shard-gate", lane: "#151a24", laneAlt: "#202738", edge: "#7fffd4", detail: "#8b5cf6" },
  },
  fase_10: {
    arenaId: "fase_10", palette: { primary: "#a7f3d0", accent: "#ffcf70", shadow: "#090b13", haze: "#c4b5fd" },
    ambientEffects: ["glassDust", "refraction", "shardStorm"], waveIntensity: [0.36, 0.52, 0.68, 0.84, 1],
    battlefieldTheme: { id: "singing-dunes", seed: 1010, material: "obsidian-glass", base: "resonator", entrance: "levitating-shards", lane: "#211d2b", laneAlt: "#30283b", edge: "#a7f3d0", detail: "#ffcf70" },
  },
  fase_11: {
    arenaId: "fase_11", palette: { primary: "#7fffd4", accent: "#c084fc", shadow: "#070b11", haze: "#86efac" },
    ambientEffects: ["glassDust", "refraction", "bioluminescence"], waveIntensity: [0.38, 0.54, 0.7, 0.86, 1],
    battlefieldTheme: { id: "shard-garden", seed: 1111, material: "obsidian-glass", base: "crystal-grove", entrance: "fractured-arch", lane: "#132524", laneAlt: "#1c3532", edge: "#7fffd4", detail: "#c084fc" },
  },
  fase_12: {
    arenaId: "fase_12", palette: { primary: "#93c5fd", accent: "#ffcf70", shadow: "#080a12", haze: "#a78bfa" },
    ambientEffects: ["glassDust", "refraction", "debris", "sparks"], waveIntensity: [0.4, 0.56, 0.72, 0.88, 1],
    battlefieldTheme: { id: "broken-observatory", seed: 1212, material: "obsidian-glass", base: "astrolabe", entrance: "split-lens", lane: "#171d2c", laneAlt: "#222b3d", edge: "#93c5fd", detail: "#ffcf70" },
  },
  fase_13: {
    arenaId: "fase_13", palette: { primary: "#7fffd4", accent: "#f0abfc", shadow: "#07090f", haze: "#d8b4fe" },
    ambientEffects: ["glassDust", "refraction", "mirrors"], waveIntensity: [0.42, 0.58, 0.74, 0.9, 1],
    battlefieldTheme: { id: "mirror-canyon", seed: 1313, material: "obsidian-glass", base: "mirror-wall", entrance: "canyon-rift", lane: "#181927", laneAlt: "#29253a", edge: "#7fffd4", detail: "#f0abfc" },
  },
  fase_14: {
    arenaId: "fase_14", palette: { primary: "#c4b5fd", accent: "#ffcf70", shadow: "#090811", haze: "#7fffd4" },
    ambientEffects: ["glassDust", "refraction", "pulse", "beacons"], waveIntensity: [0.44, 0.6, 0.76, 0.92, 1],
    battlefieldTheme: { id: "prism-cathedral", seed: 1414, material: "obsidian-glass", base: "rose-window", entrance: "crystal-vault", lane: "#211d31", laneAlt: "#302943", edge: "#c4b5fd", detail: "#ffcf70" },
  },
  fase_15: {
    arenaId: "fase_15", palette: { primary: "#7fffd4", accent: "#8b5cf6", shadow: "#05070d", haze: "#ffcf70" },
    ambientEffects: ["glassDust", "refraction", "shardStorm", "lightning"], waveIntensity: [0.46, 0.62, 0.78, 0.94, 1],
    battlefieldTheme: { id: "refraction-eye", seed: 1515, material: "obsidian-glass", base: "storm-anchor", entrance: "prism-vortex", lane: "#111827", laneAlt: "#20273a", edge: "#7fffd4", detail: "#8b5cf6" },
  },
  fase_16: {
    arenaId: "fase_16", palette: { primary: "#e9d5ff", accent: "#ffcf70", shadow: "#04050a", haze: "#7fffd4" },
    ambientEffects: ["glassDust", "refraction", "shardStorm", "mirrors", "pulse"], waveIntensity: [0.48, 0.64, 0.8, 0.96, 1],
    battlefieldTheme: { id: "reflection-throne", seed: 1616, material: "obsidian-glass", base: "mirror-citadel", entrance: "black-prism", lane: "#14131f", laneAlt: "#262238", edge: "#e9d5ff", detail: "#ffcf70" },
  },
};

export const DECISIONS = {
  emergency_energy: { id: "emergency_energy", label: "Carga emergencial", description: "+25 energia imediata." },
  supply_expansion: { id: "supply_expansion", label: "Expansão logística", description: "+6 supply máximo e atual nesta fase." },
  repair_core: { id: "repair_core", label: "Reparar núcleo", description: "Recupera 20 de integridade." },
  emergency_shield: { id: "emergency_shield", label: "Escudo de emergência", description: "Bloqueia os próximos 2 invasores, até consumir ou terminar a fase." },
  armor_piercing: { id: "armor_piercing", label: "Munição perfurante", description: "+12% de dano para todas as tropas até o fim da fase." },
  accelerated_training: { id: "accelerated_training", label: "Treinamento acelerado", description: "+15% de velocidade de ataque ofensiva até o fim da fase." },
  first_impact: { id: "first_impact", label: "Primeiro impacto", description: "+50% no próximo primeiro ataque de cada tropa nesta fase." },
  rush_wave: { id: "rush_wave", label: "Antecipar onda", description: "+25 energia; inimigos ficam 8% mais rápidos nesta fase." },
  resupply: { id: "resupply", label: "Reabastecer", description: "+6 supply imediato." },
  fast_deployment: { id: "fast_deployment", label: "Implantação acelerada", description: "Reduz cooldowns de implantação em 25% nesta fase." },
  strategic_reserve: { id: "strategic_reserve", label: "Reserva estratégica", description: "+20 energia ao iniciar a próxima onda." },
  permanent_armor: { id: "permanent_armor", label: "Blindagem permanente", description: "+20 integridade máxima e atual nesta fase." },
  containment_protocol: { id: "containment_protocol", label: "Protocolo de contenção", description: "A base recebe 25% menos dano na próxima onda." },
  ballistic_specialization: { id: "ballistic_specialization", label: "Especialização balística", description: "Marine, Sniper e Caçador causam +20% de dano nesta fase." },
  explosive_specialization: { id: "explosive_specialization", label: "Especialização explosiva", description: "Bombardeiro e minas da Demolidora causam +25% nesta fase." },
  energy_specialization: { id: "energy_specialization", label: "Especialização energética", description: "Aprimora Ranger, Krio e Guarda até o fim da fase." },
  efficient_batteries: { id: "efficient_batteries", label: "Baterias eficientes", description: "Reduz em 15% o custo das próximas tropas nesta fase." },
  recycling: { id: "recycling", label: "Reciclagem", description: "Remoções devolvem 75% da energia paga nesta fase." },
  last_line: { id: "last_line", label: "Última linha", description: "Tropas nas 2 primeiras colunas recebem 25% menos dano nesta fase." },
  field_maintenance: { id: "field_maintenance", label: "Manutenção de campo", description: "Cura 30% do HP máximo das tropas sobreviventes." },
  targeting_systems: { id: "targeting_systems", label: "Sistemas de mira", description: "+15% de alcance à distância até o fim da fase." },
  concussive_impact: { id: "concussive_impact", label: "Impacto concussivo", description: "Explosões empurram inimigos terrestres 50 px nesta fase." },
  aggressive_line: { id: "aggressive_line", label: "Linha agressiva", description: "+20% de dano e alcance; -20% de HP ofensivo nesta fase." },
  war_economy: { id: "war_economy", label: "Economia de guerra", description: "+8 supply; a próxima onda tem 20% mais inimigos." },
};

export const DECISION_LEVELS = {
  1: [
    "emergency_energy", "supply_expansion", "repair_core", "emergency_shield",
    "armor_piercing", "accelerated_training", "first_impact", "rush_wave",
  ],
  2: [
    "resupply", "fast_deployment", "strategic_reserve", "permanent_armor",
    "containment_protocol", "ballistic_specialization", "explosive_specialization", "energy_specialization",
  ],
  3: [
    "efficient_batteries", "recycling", "strategic_reserve", "last_line", "field_maintenance",
    "targeting_systems", "ballistic_specialization", "explosive_specialization", "energy_specialization",
    "concussive_impact", "aggressive_line", "war_economy",
  ],
  4: [
    "emergency_energy", "supply_expansion", "repair_core", "efficient_batteries", "recycling",
    "strategic_reserve", "last_line", "field_maintenance", "targeting_systems", "ballistic_specialization",
    "explosive_specialization", "energy_specialization", "concussive_impact", "aggressive_line", "war_economy",
  ],
};

const wave = (enemies) => ({ enemies });
const enemyFamilies = {
  medu: { strength: "neurax", speed: "oculis", introducedAt: 1 },
  crix: { strength: "vexar", speed: "silex", introducedAt: 1 },
  krulax: { strength: "myrkon", speed: "zhyra", introducedAt: 2 },
  krakhul: { strength: "brakor", speed: "aurakh", introducedAt: 3 },
};
const family = (type, count, phaseIndex) => {
  const variants = enemyFamilies[type];
  if (!variants || phaseIndex < variants.introducedAt) return [{ type, count }];
  const variantCount = Math.floor(count / 4);
  if (!variantCount) return [{ type, count }];
  return [
    { type, count: count - variantCount * 2 },
    { type: variants.strength, count: variantCount },
    { type: variants.speed, count: variantCount },
  ];
};
const replaceBaseEnemy = (enemies, type, replacement, count) => enemies.flatMap((entry) => {
  if (entry.type !== type || entry.variant || count <= 0) return [entry];
  const replaced = Math.min(entry.count, count);
  return [
    ...(entry.count > replaced ? [{ ...entry, count: entry.count - replaced }] : []),
    { type: replacement, count: replaced },
  ];
});
const phase = (id, name, subtitle, energy, cadenceMs, environment, targetDurationMs, waves, extra = {}) => {
  const phaseNumber = Number(id.slice(-2));
  const chapterTwo = phaseNumber > 8;
  return ({
  id, name, subtitle, energy, baseIntegrity: 100, cadenceMs, environment,
  chapterId: chapterTwo ? "chapter_02" : "chapter_01",
  chapterIndex: chapterTwo ? phaseNumber - 9 : phaseNumber - 1,
  supplyLimit: chapterTwo ? 30 : 20,
  loadoutLimit: chapterTwo ? 6 : 5,
  waveCompletionEnergy: phaseNumber >= 2 ? 20 : 0,
  targetDurationMs, waves, ...ARENAS[id], ...extra,
  });
};

const contentThreat = (entry) => (ENEMIES[entry.type]?.threat || 1) * (entry.variant === "alpha" ? 8 : 1);
const BUDGETED_TYPE_CAPS = { magoAbissal: 4 };
const budgetedWave = (target, types, extras = [], typeCaps = {}) => {
  const caps = { ...BUDGETED_TYPE_CAPS, ...typeCaps };
  const remainingTarget = Math.max(0, target - extras.reduce((sum, entry) => sum + contentThreat(entry) * entry.count, 0));
  const entries = types.map((type) => ({
    type,
    count: Math.min(
      caps[type] ?? Infinity,
      Math.max(1, Math.floor(remainingTarget / types.length / contentThreat({ type }))),
    ),
  }));
  const current = entries.reduce((sum, entry) => sum + contentThreat(entry) * entry.count, 0);
  const availableBudget = Math.max(0, remainingTarget - current);
  const additionsByBudget = Array(availableBudget + 1).fill(null);
  additionsByBudget[0] = Array(entries.length).fill(0);
  for (let budget = 0; budget <= availableBudget; budget += 1) {
    const additions = additionsByBudget[budget];
    if (!additions) continue;
    entries.forEach((entry, index) => {
      const nextBudget = budget + contentThreat(entry);
      const cap = caps[entry.type] ?? Infinity;
      if (nextBudget > availableBudget || entry.count + additions[index] >= cap || additionsByBudget[nextBudget]) return;
      const nextAdditions = [...additions];
      nextAdditions[index] += 1;
      additionsByBudget[nextBudget] = nextAdditions;
    });
  }
  let bestBudget = availableBudget;
  while (bestBudget > 0 && !additionsByBudget[bestBudget]) bestBudget -= 1;
  const bestAdditions = additionsByBudget[bestBudget] || [];
  entries.forEach((entry, index) => { entry.count += bestAdditions[index] || 0; });
  if (current + bestBudget < remainingTarget) {
    const smallestAvailable = entries
      .filter((entry) => entry.count < (caps[entry.type] ?? Infinity))
      .sort((left, right) => contentThreat(left) - contentThreat(right))[0];
    if (smallestAvailable) smallestAvailable.count += 1;
  }
  return wave([...entries, ...extras]);
};

const GLASS_ECHO_BASE = { id: "glass_echoes", hpFactor: 0.45, speedFactor: 1.2, damageFactor: 0.6, maxAlive: 12 };
const glassMechanic = (chance) => ({ ...GLASS_ECHO_BASE, chance });

export const PHASES = [
  phase("fase_01", "Perímetro Leste", "Primeiro contato", 80, 4800, "clear", 300000, [
    wave([{ type: "medu", count: 6 }]),
    wave([{ type: "crix", count: 4 }]),
    wave([{ type: "medu", count: 6 }, { type: "crix", count: 2 }]),
    wave([{ type: "medu", count: 8 }, { type: "krulax", count: 2 }]),
  ]),
  phase("fase_02", "Floresta Exterior", "Movimento sob neblina", 90, 4000, "fog", 330000, [
    wave([...family("crix", 6, 1)]),
    wave([...family("medu", 6, 1), ...family("crix", 4, 1)]),
    wave([...family("krulax", 10, 1)]),
    wave([...family("crix", 8, 1), ...family("krulax", 3, 1)]),
  ]),
  phase("fase_03", "Cratera Norte", "Blindados na linha", 100, 3520, "clear", 360000, [
    wave([...family("medu", 10, 2), ...family("crix", 3, 2)]),
    wave([...family("krulax", 12, 2), { type: "parasitaSaltador", count: 2 }]),
    wave([...family("crix", 8, 2), ...family("medu", 6, 2)]),
    wave([...family("krakhul", 3, 2), ...family("krulax", 12, 2), { type: "parasitaSaltador", count: 2 }]),
  ]),
  phase("fase_04", "Ninho Krulax", "Vexar Alfa na muralha", 110, 3040, "clear", 390000, [
    wave([...family("crix", 6, 3), ...family("krulax", 2, 3), ...family("medu", 6, 3)]),
    wave([...family("crix", 12, 3), ...family("medu", 2, 3), { type: "parasitaSaltador", count: 3 }]),
    wave([...family("krulax", 12, 3), ...family("medu", 12, 3)]),
    wave([{ type: "vexar", variant: "alpha", count: 1 }, { type: "crix", count: 2 }, { type: "krakhul", count: 5 }, { type: "parasitaSaltador", count: 3 }]),
  ], { boss: true }),
  phase("fase_05", "Estação Silenciosa", "Oculis Alfa entre as torres", 120, 2720, "dark", 420000, [
    wave([...family("medu", 16, 4), ...family("crix", 9, 4)]),
    wave([...family("krulax", 24, 4), { type: "parasitaSaltador", count: 4 }]),
    wave([...family("krakhul", 10, 4), ...family("crix", 10, 4)]),
    wave([{ type: "oculis", variant: "alpha", count: 1 }, { type: "krakhul", count: 9 }, { type: "krulax", count: 8 }, { type: "parasitaSaltador", count: 4 }]),
  ], { boss: true }),
  phase("fase_06", "Tempestade Iônica", "Zhyra Alfa sob descarga", 130, 2400, "storm", 450000, [
    wave([...family("crix", 24, 5)]),
    wave([...family("krulax", 32, 5), { type: "parasitaSaltador", count: 5 }]),
    wave([...family("medu", 22, 5), ...family("krakhul", 13, 5)]),
    wave([{ type: "zhyra", variant: "alpha", count: 1 }, { type: "crix", count: 18 }, { type: "krakhul", count: 4 }, { type: "medu", count: 2 }, { type: "parasitaSaltador", count: 5 }]),
  ], { boss: true }),
  phase("fase_07", "Portal Ancestral", "Brakor Alfa no portal", 140, 2080, "clear", 480000, [
    wave([...family("krulax", 40, 6)]),
    wave([...replaceBaseEnemy(family("crix", 28, 6), "crix", "magoAbissal", 4), ...family("medu", 8, 6), { type: "parasitaSaltador", count: 6 }]),
    wave([...family("krakhul", 29, 6)]),
    wave([{ type: "brakor", variant: "alpha", count: 1 }, { type: "krakhul", count: 16 }, { type: "medu", count: 12 }, { type: "parasitaSaltador", count: 6 }]),
  ], { boss: true }),
  phase("fase_08", "Coração da Colmeia", "Elimine Aurakh Alfa", 150, 1760, "hive", 540000, [
    wave([...family("medu", 24, 7), ...family("crix", 30, 7)]),
    wave([...family("krulax", 56, 7), { type: "parasitaSaltador", count: 7 }]),
    wave([...family("krakhul", 38, 7)]),
    wave([{ type: "aurakh", variant: "alpha", count: 1 }, { type: "krulax", count: 50 }, { type: "parasitaSaltador", count: 7 }]),
  ], { boss: true }),
  phase("fase_09", "Costa de Obsidiana", "O mar quebrado desperta", 150, 1680, "glass", 600000, [
    budgetedWave(720, ["estilha", "medu", "crix", "parasitaSaltador"]),
    budgetedWave(800, ["estilha", "neurax", "myrkon", "magoAbissal"]),
    budgetedWave(880, ["estilha", "oculis", "zhyra", "parasitaSaltador"]),
    budgetedWave(960, ["estilha", "krulax", "krakhul", "magoAbissal"]),
    budgetedWave(1108, ["estilha", "krulax", "parasitaSaltador"], [{ type: "vexar", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.1) }),
  phase("fase_10", "Dunas Cantantes", "A areia ressoa sob o cerco", 155, 1600, "glass", 630000, [
    budgetedWave(800, ["estilha", "vitrarca", "oculis"]),
    budgetedWave(900, ["estilha", "vitrarca", "silex", "parasitaSaltador"]),
    budgetedWave(1000, ["vitrarca", "zhyra", "magoAbissal"]),
    budgetedWave(1100, ["estilha", "vitrarca", "krakhul", "parasitaSaltador"]),
    budgetedWave(1220, ["vitrarca", "magoAbissal", "krakhul"], [{ type: "oculis", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.12) }),
  phase("fase_11", "Jardim Estilhaçado", "Raízes de cristal cercam a linha", 160, 1520, "glass", 660000, [
    budgetedWave(900, ["estilha", "vitrarca", "silex", "parasitaSaltador"]),
    wave([{ type: "vitrarca", count: 18 }, { type: "obsidonte", count: 6 }, { type: "neurax", count: 50 }]),
    budgetedWave(1100, ["vitrarca", "obsidonte", "magoAbissal"]),
    budgetedWave(1200, ["estilha", "vitrarca", "obsidonte", "parasitaSaltador"]),
    budgetedWave(1354, ["vitrarca", "obsidonte", "magoAbissal"], [{ type: "myrkon", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.14) }),
  phase("fase_12", "Observatório Partido", "O céu devolve nossos sinais", 165, 1440, "glass", 690000, [
    budgetedWave(1000, ["estilha", "vitrarca", "oculis"]),
    budgetedWave(1120, ["estilha", "refrator", "parasitaSaltador", "magoAbissal"]),
    budgetedWave(1240, ["vitrarca", "obsidonte", "refrator"]),
    budgetedWave(1360, ["obsidonte", "refrator", "aurakh", "magoAbissal"]),
    budgetedWave(1500, ["estilha", "refrator", "parasitaSaltador"], [{ type: "zhyra", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.16) }),
  phase("fase_13", "Desfiladeiro Espelhado", "Cada reflexo esconde um avanço", 190, 1360, "glass", 720000, [
    budgetedWave(1120, ["estilha", "vitrarca", "refrator"], [], { vitrarca: 20, refrator: 6 }),
    budgetedWave(1250, ["estilha", "vitrarca", "obsidonte", "parasitaSaltador"]),
    budgetedWave(1300, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1510, ["estilha", "obsidonte", "refrator", "parasitaSaltador"]),
    budgetedWave(1660, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 1 }, { type: "krakhul", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.18) }),
  phase("fase_14", "Catedral Prismática", "A luz tornou-se uma arma", 200, 1280, "glass", 750000, [
    budgetedWave(1250, ["estilha", "vitrarca", "refrator"], [], { vitrarca: 23, refrator: 7 }),
    budgetedWave(1390, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1530, ["estilha", "obsidonte", "parasitaSaltador"]),
    budgetedWave(1670, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1850, ["estilha", "refrator", "parasitaSaltador"], [{ type: "crisalio", count: 1 }, { type: "brakor", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.2) }),
  phase("fase_15", "Olho da Refração", "A tempestade multiplica o inimigo", 180, 1200, "glass", 780000, [
    budgetedWave(1400, ["estilha", "vitrarca", "refrator", "parasitaSaltador"], [], { vitrarca: 20, refrator: 8, parasitaSaltador: 22 }),
    budgetedWave(1550, ["vitrarca", "obsidonte", "refrator"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1700, ["obsidonte", "refrator", "krakhul", "magoAbissal"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1850, ["estilha", "obsidonte", "refrator", "parasitaSaltador"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(2040, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 2 }, { type: "aurakh", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.22) }),
  phase("fase_16", "Trono dos Reflexos", "Quebre o oráculo do Mar de Vidro", 185, 1120, "glass", 810000, [
    budgetedWave(1550, ["estilha", "vitrarca", "refrator", "parasitaSaltador"], [{ type: "crisalio", count: 1 }], { vitrarca: 21, refrator: 9, parasitaSaltador: 23 }),
    budgetedWave(1720, ["vitrarca", "obsidonte", "refrator", "magoAbissal"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(1890, ["estilha", "obsidonte", "refrator", "parasitaSaltador"], [{ type: "crisalio", count: 1 }]),
    budgetedWave(2070, ["vitrarca", "obsidonte", "refrator", "brakor"], [{ type: "crisalio", count: 2 }]),
    budgetedWave(2260, ["estilha", "vitrarca", "obsidonte", "refrator", "parasitaSaltador"], [{ type: "crisalio", count: 2 }, { type: "magoAbissal", variant: "alpha", count: 1 }]),
  ], { boss: true, chapterMechanic: glassMechanic(0.25) }),
];

export const CHAPTERS = [
  {
    id: "chapter_01", number: 1, name: "Cerco da Colmeia", subtitle: "Da fronteira ao coração inimigo",
    phaseIds: PHASES.slice(0, 8).map((entry) => entry.id), coverArenaId: "fase_08",
    palette: { primary: "#22d3ee", accent: "#f43f5e", shadow: "#030712" },
  },
  {
    id: "chapter_02", number: 2, name: "Mar de Vidro", subtitle: "O deserto devolve aquilo que destruímos",
    phaseIds: PHASES.slice(8, 16).map((entry) => entry.id), coverArenaId: "chapter_02",
    exclusiveEnemyIds: ["estilha", "vitrarca", "obsidonte", "refrator", "crisalio"],
    palette: { primary: "#7fffd4", accent: "#8b5cf6", shadow: "#080a12" },
    mechanic: { ...GLASS_ECHO_BASE, label: "Ecos de Vidro", description: "Hostis comuns podem retornar uma vez como reflexos frágeis e velozes." },
  },
];

export const getPhase = (id) => PHASES.find((entry) => entry.id === id) || null;
export const getPhaseIndex = (id) => PHASES.findIndex((entry) => entry.id === id);
export const getChapter = (id) => CHAPTERS.find((entry) => entry.id === id) || null;
export const getChapterForPhase = (phaseOrId) => {
  const phaseEntry = typeof phaseOrId === "string" ? getPhase(phaseOrId) : phaseOrId;
  return phaseEntry ? getChapter(phaseEntry.chapterId) : null;
};
export const getUnlockedTroops = (phaseIndex) => Object.values(TROOPS)
  .filter((troop) => troop.unlockAt <= phaseIndex)
  .sort((left, right) => {
    const leftReactor = left.id === "reator";
    const rightReactor = right.id === "reator";
    if (leftReactor !== rightReactor) return leftReactor ? -1 : 1;
    const leftStructure = left.id === "muralhaReforcada";
    const rightStructure = right.id === "muralhaReforcada";
    if (leftStructure !== rightStructure) return leftStructure ? 1 : -1;
    return left.unlockAt - right.unlockAt;
  });
