const CATALOG_TYPES = Object.freeze([
  ["all", { label: "Todas", tooltip: "Todas as tropas", glyph: "◇" }],
  ["frontline", { label: "Linha de frente", tooltip: "Tanques e defesa", glyph: "⬢" }],
  ["attack", { label: "Ataque", tooltip: "DPS e precisão", glyph: "✦" }],
  ["area", { label: "Área", tooltip: "Artilharia e anti-enxame", glyph: "✹" }],
  ["control", { label: "Controle", tooltip: "Controle e armadilhas", glyph: "◉" }],
  ["support", { label: "Suporte", tooltip: "Cura, economia e infraestrutura", glyph: "✚" }],
  ["specialist", { label: "Especialista", tooltip: "Funções específicas", glyph: "◈" }],
]);

export const TROOP_CATALOG_TYPES = Object.freeze(
  Object.fromEntries(CATALOG_TYPES),
);

const meta = (type, orderInPhase) => ({ type, orderInPhase });

export const TROOP_CATALOG_META = Object.freeze({
  colono: meta("frontline", 1),
  reator: meta("support", 2),
  droneSentinela: meta("support", 3),
  muralhaReforcada: meta("frontline", 4),
  guarda: meta("attack", 1),
  marine: meta("attack", 1),
  sniper: meta("attack", 1),
  incinerador: meta("area", 2),
  ranger: meta("attack", 1),
  demolidora: meta("control", 1),
  caçador: meta("attack", 2),
  bombardeiro: meta("area", 1),
  krio: meta("control", 1),
  artilheiraMorteiro: meta("area", 2),
  mantis: meta("area", 3),
  executorArco: meta("control", 3),
  colossoImpacto: meta("frontline", 1),
  medicaNanites: meta("support", 1),
  lumiUrsa7: meta("frontline", 1),
  interceptadorIcaro: meta("specialist", 1),
  operadorJano: meta("specialist", 2),
  cacadorLeviatas: meta("specialist", 3),
  bastiaoMare: meta("frontline", 1),
  fuzileiroVoltaico: meta("attack", 2),
  aresT: meta("frontline", 1),
  cryo7: meta("control", 1),
  thermalPlatform: meta("support", 2),
});

export const TROOP_CATALOG_TYPE_ORDER = Object.freeze(
  CATALOG_TYPES.map(([id]) => id),
);

export function getTroopCatalogType(troop) {
  return TROOP_CATALOG_META[troop?.id]?.type || "specialist";
}

export function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterCatalogTroops(troops, type = "all", search = "") {
  const query = normalizeCatalogSearch(search);
  return troops.filter((troop) => {
    if (type !== "all" && getTroopCatalogType(troop) !== type) return false;
    if (!query) return true;
    return [troop.label, troop.title, troop.role]
      .filter(Boolean)
      .some((value) => normalizeCatalogSearch(value).includes(query));
  });
}

export function sortCatalogTroops(troops, sort = "appearance") {
  return [...troops].sort((left, right) => {
    if (sort === "name") return left.label.localeCompare(right.label, "pt-BR");
    if (sort === "energy") return left.price - right.price || left.label.localeCompare(right.label, "pt-BR");
    if (sort === "energyDesc") return right.price - left.price || left.label.localeCompare(right.label, "pt-BR");
    if (sort === "supply") return left.supply - right.supply || left.label.localeCompare(right.label, "pt-BR");
    if (sort === "supplyDesc") return right.supply - left.supply || left.label.localeCompare(right.label, "pt-BR");
    return left.unlockAt - right.unlockAt
      || (TROOP_CATALOG_META[left.id]?.orderInPhase || 99) - (TROOP_CATALOG_META[right.id]?.orderInPhase || 99)
      || left.label.localeCompare(right.label, "pt-BR");
  });
}

export function getCatalogColumns(element) {
  if (!element) return 1;
  const items = [...element.children];
  if (items.length < 2) return Math.max(1, items.length);
  const firstTop = items[0].getBoundingClientRect().top;
  return Math.max(1, items.findIndex((item) => item.getBoundingClientRect().top > firstTop));
}
