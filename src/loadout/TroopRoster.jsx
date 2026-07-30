import { useRef } from "react";
import TroopCard from "./TroopCard.jsx";

export default function TroopRoster({
  troops, selected, focusedTroopId, hoverTroopId, atLimit, reduceMotion,
  onToggle, onFocusTroop, onHoverTroop, onInfo,
}) {
  const buttonRefs = useRef([]);
  const moveFocus = (event, index) => {
    const columns = window.matchMedia?.("(max-width: 760px)")?.matches ? 1 : 2;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const nextIndex = Math.max(0, Math.min(troops.length - 1, index + moves[event.key]));
    buttonRefs.current[nextIndex]?.focus();
    onFocusTroop(troops[nextIndex].id);
  };
  return <section className="troop-roster" aria-labelledby="troop-roster-title">
    <header><span className="eyebrow">ARSENAL AUTORIZADO</span><h2 id="troop-roster-title">Catálogo de tropas</h2></header>
    <div className="unit-grid loadout-roster-grid">
      {troops.map((troop, index) => {
        const isSelected = selected.includes(troop.id);
        return <TroopCard
          key={troop.id}
          troop={troop}
          selected={isSelected}
          focused={(hoverTroopId || focusedTroopId) === troop.id}
          unavailable={atLimit && !isSelected}
          index={index}
          reduceMotion={reduceMotion}
          onToggle={() => { onFocusTroop(troop.id); onToggle(troop.id); }}
          onPreview={() => onHoverTroop(troop.id)}
          onPreviewEnd={() => onHoverTroop(null)}
          onInfo={(event) => onInfo(troop, event.currentTarget)}
          buttonRef={(node) => { buttonRefs.current[index] = node; }}
          onKeyDown={(event) => moveFocus(event, index)}
        />;
      })}
    </div>
  </section>;
}
