const enemy = (id, label, role, stats = {}) => ({
  id, label, role, chapterId: "chapter_07", allowAlphaVariant: false,
  hp: 36, speed: 28, damage: 6, attackEveryMs: 1200, baseDamage: 10,
  threat: 16, convoyDamageFactor: .035, color: "#b65a32", scale: 1, previewState: "idle",
  assetStates: ["idle", "walking", "attack"],
  description: "Ameaça Ferruginosa adaptada aos corredores industriais da fronteira.",
  ...stats,
});

export const CHAPTER_SEVEN_ENEMIES = Object.freeze({
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
