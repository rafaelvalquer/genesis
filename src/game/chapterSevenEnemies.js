const enemy = (id, label, role, stats = {}) => ({
  id, label, role, chapterId: "chapter_07", allowAlphaVariant: false,
  hp: 36, speed: 28, damage: 6, attackEveryMs: 1200, baseDamage: 10,
  threat: 16, convoyDamageFactor: .035, color: "#b65a32", scale: 1, previewState: "idle",
  assetStates: ["idle", "walking", "attack"],
  description: "Predador ferrívoro adaptado aos corredores vivos da fronteira.",
  ...stats,
});

export const CHAPTER_SEVEN_ENEMIES = Object.freeze({
  rastejanteMata: enemy("rastejanteMata", "Rastejante da Mata", "Pressão de linha", {
    hp: 38, speed: 29, damage: 5, attackEveryMs: 1200, baseDamage: 10, threat: 14,
    convoyDamageFactor: .035, convoyAttackRangeTiles: 1, canTargetConvoyFromOuterRow: false,
    color: "#8fa83f", attackVisual: { durationMs: 640, impactMs: 320 },
    persistentBite: { multipliers: [1, 1.1, 1.2], maxHitsForScaling: 2, resetOnTargetChange: true, affectsConvoy: false },
    frenzyVisual: { enabled: true, level1Hits: 1, level2Hits: 2 },
    description: "Predador rastejante da mata que intensifica suas mordidas sobre a mesma presa.",
  }),
  saltadorAlado: enemy("saltadorAlado", "Saltador Alado", "Infiltrador / assassino de escolta", {
    hp: 26, speed: 28, damage: 6, attackEveryMs: 1100, baseDamage: 8, threat: 22, scale: .95,
    animationFrameMs: { idle: 120, walking: 90 },
    canAttackConvoy: false, attackRangeTiles: .62, attackVisual: { durationMs: 560, impactMs: 280 },
    canopyJump: { triggerRangeTiles: .72, cooldownMinMs: 5000, cooldownMaxMs: 7000, prepMs: 240, airMs: 420, landMs: 220, landingOffsetTiles: .72, heightTiles: .70 },
    escortInstinct: { permanentAfterFirstJump: true, nearConvoyRadiusTiles: 2.25, huntForwardTiles: 5, targetLockMs: 1400 },
    rasante: { triggerRangeTiles: 1.10, cooldownMs: 3000, prepMs: 140, airMs: 300, landMs: 180, impactMs: 360, heightTiles: .38, escortDamageMultiplier: 1.35 },
    assetStates: ["idle", "walking", "attack", "jumpPrep", "jumpAir", "jumpLand", "rasante"],
    description: "Predador alado que rompe a primeira linha e caça a escolta do comboio.",
  }),
  macacoEsporos: enemy("macacoEsporos", "Macaco de Esporos", "Suporte / controle", {
    hp: 30, speed: 25, damage: 3, attackEveryMs: 1450, baseDamage: 7, threat: 28, scale: .98,
    canAttackConvoy: false, attackRangeTiles: .62, animationFrameMs: { idle: 160, walking: 140 },
    attackVisual: { durationMs: 760, impactMs: 430 },
    sporeFruit: { firstCastDelayMs: 3800, cooldownMs: 9000, interruptCooldownMs: 3000, rangeTiles: 4.25, castDurationMs: 1280, releaseMs: 640, projectileSpeed: 360, radiusTiles: 1.15, confusionMinMs: 1600, confusionMaxMs: 1900, postConfusionImmunityMs: 2800, cloudVisualMs: 950, directDamage: 0, releaseVisual: { frame: 4, offsetX: -50, offsetY: 10 } },
    effectDependencies: ["sporeFruit"],
    assetStates: ["idle", "walking", "attack", "sporeThrow"],
    color: "#23c7bd", description: "Primata alienígena que lança frutos de esporo e confunde a escolta.",
  }),
  tartaragarra: enemy("tartaragarra", "Tartaragarra", "Tanque / Rompedor de linha", {
    hp: 260, speed: 10, damage: 12, attackEveryMs: 2800, baseDamage: 20, threat: 48, scale: 1.32,
    armorClass: "heavy", armorDamageFactor: 1, convoyAttackRangeTiles: 1.05,
    animationFrameMs: { idle: 170, walking: 155, charge: 70 },
    attackVisual: { durationMs: 1200, impactMs: 700 },
    charge: { triggerRangeTiles: 1.2, prepMs: 1000, speed: 300, distanceTiles: .85, damage: 28,
      stunMs: 900, cooldownMs: 8500, recoveryMs: 1200, interruptedCooldownMs: 3000 },
    convoyHeadbutt: { damage: 22, attackEveryMs: 3400, durationMs: 1200, impactMs: 700, underAttackHoldMs: 1800 },
    assetStates: ["idle", "walking", "chargePrep", "charge", "chargeRecover", "attack", "death"],
    color: "#a85d38", previewState: "idle",
    description: "Tanque ancestral de casco fossilizado que abre espaço com uma investida telegráfica.",
  }),
  legionaroFerrugem: enemy("legionaroFerrugem", "Legionário Ferrugem", "Soldado de linha", {
    hp: 38, speed: 29, damage: 5, baseDamage: 10, threat: 14, color: "#c26a3d",
    description: "Infante Ferruginoso disciplinado que avança pelas rotas de combate.",
  }),
  saqueadorEscoria: enemy("saqueadorEscoria", "Saqueador de Escória", "Raider rápido", {
    hp: 24, speed: 47, damage: 4, attackEveryMs: 760, baseDamage: 8, threat: 17, scale: .88, color: "#e8793f",
    description: "Raider veloz que explora lacunas na patrulha móvel.",
  }),
  couracadoHematita: enemy("couracadoHematita", "Couraçado Hematita", "Blindado pesado", {
    hp: 150, speed: 16, damage: 10, attackEveryMs: 1750, baseDamage: 24, threat: 40,
    armorClass: "heavy", armorDamageFactor: .65, scale: 1.28, color: "#7a4b3a",
    description: "Aríete blindado que sustenta pressão prolongada contra a defesa.",
  }),
  cacadorComboio: enemy("cacadorComboio", "Caçador de Comboio", "Especialista antitransporte", {
    hp: 56, speed: 34, damage: 7, attackEveryMs: 1050, baseDamage: 12, threat: 31,
    convoyDamageFactor: .05, convoyAttackRangeTiles: 1.15, color: "#fb7185",
    description: "Predador lateral treinado para imobilizar e destruir transportes logísticos.",
  }),
  sabotadorOxido: enemy("sabotadorOxido", "Sabotador Óxido", "Suporte e sabotagem", {
    hp: 48, speed: 25, damage: 6, attackEveryMs: 1350, baseDamage: 11, threat: 27, color: "#d6a756",
    escortDisruptionMs: 1800,
    description: "Operador hostil que interrompe temporariamente unidades de escolta.",
  }),
  atiradorRavina: enemy("atiradorRavina", "Atirador da Ravina", "Ameaça de rota externa", {
    hp: 44, speed: 21, damage: 6, attackEveryMs: 1550, baseDamage: 13, threat: 29,
    canTargetConvoyFromOuterRow: true, convoyAttackRangeTiles: 1.45, color: "#67e8f9",
    description: "Atirador de flanco capaz de alcançar o transporte a partir das rotas externas.",
  }),
  marechalForja: enemy("marechalForja", "Marechal da Forja", "Chefe Ferruginoso", {
    hp: 1800, speed: 13, damage: 14, attackEveryMs: 1400, baseDamage: 42, threat: 280,
    boss: true, elite: true, armorClass: "heavy", armorDamageFactor: .55, scale: 1.75,
    canTargetConvoyFromOuterRow: true, convoyAttackRangeTiles: 1.6, convoyDamageFactor: .04,
    color: "#facc15", description: "Comandante da evacuação inimiga; convoca reforços enquanto caça o comboio.",
  }),
});

export const CHAPTER_SEVEN_ENEMY_IDS = Object.freeze(Object.keys(CHAPTER_SEVEN_ENEMIES));
