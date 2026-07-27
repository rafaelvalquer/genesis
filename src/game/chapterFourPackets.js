export const CHAPTER_FOUR_PACKETS = Object.freeze({
  P1: { id: "ionic_swarm", label: "Bando Iônico", threat: 28, weight: "light", units: [
    { type: "voltriz", count: 4, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 260 },
  ] },
  P2: { id: "guarded_wing", label: "Asa Protegida", threat: 54, weight: "medium", units: [
    { type: "voltriz", count: 4, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 260 },
    { type: "nimbarca", count: 1, xOffsetTiles: 0.55, spawnDelayMs: 300 },
  ] },
  P3: { id: "storm_ram", label: "Aríete Celeste", threat: 51, weight: "medium", units: [
    { type: "gorjal", count: 1, xOffsetTiles: -0.85, spawnDelayMs: 0 },
    { type: "voltriz", count: 3, xOffsetTiles: 0, spawnDelayMs: 180, spawnIntervalMs: 260 },
  ] },
  P4: { id: "line_breakers", label: "Quebra-Linha", threat: 52, weight: "medium", units: [
    { type: "gorjal", count: 1, xOffsetTiles: -0.8, spawnDelayMs: 0 },
    { type: "derivante", count: 2, xOffsetTiles: 0.15, spawnDelayMs: 250 },
  ] },
  P5: { id: "conductive_spear", label: "Lança Condutora", threat: 68, weight: "heavy", units: [
    { type: "gorjal", count: 1, xOffsetTiles: -0.9, spawnDelayMs: 0 },
    { type: "voltriz", count: 2, xOffsetTiles: 0, spawnDelayMs: 180, spawnIntervalMs: 260 },
    { type: "raizFulgor", count: 1, xOffsetTiles: 0.8, spawnDelayMs: 500 },
  ] },
  P6: { id: "overload_siege", label: "Cerco de Sobrecarga", threat: 85, weight: "heavy", units: [
    { type: "voltriz", count: 5, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 260 },
    { type: "nimbarca", count: 1, xOffsetTiles: 0.45, spawnDelayMs: 250 },
    { type: "raizFulgor", count: 1, xOffsetTiles: 0.9, spawnDelayMs: 550 },
  ] },
  P7: { id: "broken_route", label: "Rota Quebrada", threat: 90, weight: "heavy", units: [
    { type: "gorjal", count: 1, xOffsetTiles: -0.9, spawnDelayMs: 0 },
    { type: "voltriz", count: 2, xOffsetTiles: 0, spawnDelayMs: 150, spawnIntervalMs: 260 },
    { type: "derivante", count: 2, xOffsetTiles: 0.2, spawnDelayMs: 260 },
    { type: "raizFulgor", count: 1, xOffsetTiles: 0.85, spawnDelayMs: 600 },
  ] },
  P8: { id: "containment_cloud", label: "Nuvem de Contenção", threat: 76, weight: "heavy", units: [
    { type: "voltriz", count: 4, xOffsetTiles: 0, spawnDelayMs: 0, spawnIntervalMs: 260 },
    { type: "derivante", count: 2, xOffsetTiles: 0.1, spawnDelayMs: 200 },
    { type: "nimbarca", count: 1, xOffsetTiles: 0.5, spawnDelayMs: 300 },
  ] },
  P9: { id: "storm_convergence", label: "Convergência Tempestuosa", threat: 130, weight: "heavy", units: [
    { type: "gorjal", count: 1, xOffsetTiles: -1, spawnDelayMs: 0 },
    { type: "voltriz", count: 4, xOffsetTiles: 0, spawnDelayMs: 130, spawnIntervalMs: 260 },
    { type: "derivante", count: 2, xOffsetTiles: 0.15, spawnDelayMs: 220 },
    { type: "nimbarca", count: 1, xOffsetTiles: 0.45, spawnDelayMs: 300 },
    { type: "raizFulgor", count: 1, xOffsetTiles: 0.9, spawnDelayMs: 650 },
  ] },
});

export function instantiateChapterFourPacket(key, index, spawnAtMs, block = "main", variant = null) {
  const source = CHAPTER_FOUR_PACKETS[key];
  if (!source) throw new Error(`Pacote desconhecido: ${key}`);
  const units = source.units.map((unit) => ({ ...unit }));
  if (variant) {
    const target = units.find((unit) => unit.type === variant.type);
    if (target) {
      if (target.count > 1) {
        target.count -= 1;
        units.push({ ...target, count: 1, variant: "alpha" });
      } else target.variant = "alpha";
    }
  }
  return {
    id: `${source.id}_${index + 1}`,
    key,
    label: source.label,
    block,
    spawnAtMs,
    units,
  };
}
