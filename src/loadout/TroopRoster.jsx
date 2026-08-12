import { useMemo, useRef } from "react";
import TroopCatalogToolbar from "./TroopCatalogToolbar.jsx";
import TroopPortraitTile from "./TroopPortraitTile.jsx";
import { filterCatalogTroops, getCatalogColumns, sortCatalogTroops } from "./troopCatalogConfig.js";

export default function TroopRoster({
  troops, selected, focusedTroopId, hoverTroopId, atLimit, reduceMotion,
  onToggle, onFocusTroop, onHoverTroop, onTypeChange, catalogType, catalogSort, catalogSearch, onSortChange, onSearchChange,
}) {
  const gridRef = useRef(null);
  const buttonRefs = useRef([]);
  const visibleTroops = useMemo(
    () => sortCatalogTroops(filterCatalogTroops(troops, catalogType, catalogSearch), catalogSort),
    [troops, catalogType, catalogSearch, catalogSort],
  );
  const moveFocus = (event, index) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -getCatalogColumns(gridRef.current), ArrowDown: getCatalogColumns(gridRef.current) };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const nextIndex = Math.max(0, Math.min(visibleTroops.length - 1, index + moves[event.key]));
    buttonRefs.current[nextIndex]?.focus();
    onFocusTroop(visibleTroops[nextIndex]?.id);
  };
  return <section className="troop-roster" aria-labelledby="troop-roster-title">
    <header className="troop-roster-heading"><div><span className="eyebrow">ARSENAL AUTORIZADO</span><h2 id="troop-roster-title">Catálogo de tropas</h2></div><span className="catalog-count">{visibleTroops.length}/{troops.length}</span></header>
    <TroopCatalogToolbar type={catalogType} sort={catalogSort} search={catalogSearch} onTypeChange={onTypeChange} onSortChange={onSortChange} onSearchChange={onSearchChange} />
    <div ref={gridRef} className="unit-grid loadout-roster-grid" role="grid" aria-label="Tropas disponíveis">
      {visibleTroops.map((troop, index) => {
        const isSelected = selected.includes(troop.id);
        const selectionNumber = selected.indexOf(troop.id);
        return <TroopPortraitTile
          key={troop.id}
          troop={troop}
          selected={isSelected}
          focused={(hoverTroopId || focusedTroopId) === troop.id}
          unavailable={atLimit && !isSelected}
          selectionNumber={selectionNumber >= 0 ? selectionNumber + 1 : null}
          onToggle={() => { onFocusTroop(troop.id); onToggle(troop.id); }}
          onPreview={() => { onFocusTroop(troop.id); onHoverTroop(troop.id); }}
          onPreviewEnd={() => onHoverTroop(null)}
          buttonRef={(node) => { buttonRefs.current[index] = node; }}
          onKeyDown={(event) => moveFocus(event, index)}
        />;
      })}
    </div>
    {!visibleTroops.length && <p className="catalog-empty">Nenhuma unidade corresponde à busca.</p>}
  </section>;
}
