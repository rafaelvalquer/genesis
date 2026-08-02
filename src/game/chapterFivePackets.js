export const CHAPTER_FIVE_PACKETS = Object.freeze({
  N1: { id: "skim_school", label: "Cardume Rasante", threat: 48, weight: "light", units: [{ type: "mordelume", count: 3, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 180 }] },
  N2: { id: "rasgamar_ambush", label: "Emboscada Rasgamar", threat: 58, weight: "medium", units: [{ type: "enguiaRasgamar", count: 1, xOffsetTiles: -0.7, spawnDelayMs: 0 }, { type: "mordelume", count: 2, xOffsetTiles: 0.1, spawnDelayMs: 220, spawnIntervalMs: 180 }] },
  N3: { id: "shell_screen", label: "Escudo de Carapaça", threat: 78, weight: "medium", units: [{ type: "carapacaNereida", count: 1, xOffsetTiles: -0.85, spawnDelayMs: 0 }, { type: "mordelume", count: 3, xOffsetTiles: 0.1, spawnDelayMs: 260, spawnIntervalMs: 170 }] },
  N4: { id: "protected_veil", label: "Véu Protegido", threat: 64, weight: "medium", units: [{ type: "carapacaNereida", count: 1, xOffsetTiles: -0.85, spawnDelayMs: 0 }, { type: "medusaVeuSalino", count: 1, xOffsetTiles: 0.7, spawnDelayMs: 260 }] },
  N5: { id: "tide_hunt", label: "Caçada de Maré", threat: 84, weight: "heavy", units: [{ type: "enguiaRasgamar", count: 2, xOffsetTiles: -0.55, spawnDelayMs: 0, spawnIntervalMs: 360 }, { type: "mordelume", count: 2, xOffsetTiles: 0.12, spawnDelayMs: 220, spawnIntervalMs: 180 }] },
  N6: { id: "regenerative_school", label: "Cardume Regenerativo", threat: 114, weight: "heavy", units: [{ type: "mordelume", count: 5, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 180 }, { type: "medusaVeuSalino", count: 1, xOffsetTiles: 0.7, spawnDelayMs: 420 }] },
  N7: { id: "abyssal_column", label: "Coluna Abissal", threat: 126, weight: "heavy", units: [{ type: "carapacaNereida", count: 2, xOffsetTiles: -0.85, spawnDelayMs: 0, spawnIntervalMs: 300 }, { type: "mordelume", count: 2, xOffsetTiles: 0.08, spawnDelayMs: 240, spawnIntervalMs: 180 }, { type: "medusaVeuSalino", count: 1, xOffsetTiles: 0.7, spawnDelayMs: 420 }] },
  N8: { id: "saline_siege", label: "Cerco Salino", threat: 138, weight: "heavy", units: [{ type: "carapacaNereida", count: 1, xOffsetTiles: -0.85, spawnDelayMs: 0 }, { type: "enguiaRasgamar", count: 1, xOffsetTiles: -0.52, spawnDelayMs: 180 }, { type: "mordelume", count: 3, xOffsetTiles: 0.08, spawnDelayMs: 260, spawnIntervalMs: 170 }, { type: "medusaVeuSalino", count: 1, xOffsetTiles: 0.7, spawnDelayMs: 460 }] },
  N9: { id: "nereida_convergence", label: "Convergência de Nereida", threat: 180, weight: "heavy", units: [{ type: "carapacaNereida", count: 1, xOffsetTiles: -0.85, spawnDelayMs: 0 }, { type: "enguiaRasgamar", count: 2, xOffsetTiles: -0.52, spawnDelayMs: 160, spawnIntervalMs: 300 }, { type: "mordelume", count: 4, xOffsetTiles: 0.08, spawnDelayMs: 300, spawnIntervalMs: 170 }, { type: "medusaVeuSalino", count: 1, xOffsetTiles: 0.7, spawnDelayMs: 500 }] },
});

export function instantiateChapterFivePacket(key, index, spawnAtMs, block = "main") {
  const source = CHAPTER_FIVE_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  return { id: `${source.id}_${index + 1}`, key, label: source.label, block, spawnAtMs, units: source.units.map((unit) => ({ ...unit })) };
}
