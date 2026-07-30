import { motion } from "motion/react";
import { getTroopPreviewUrl } from "../game/assetCatalog.js";
import { getLoadoutTroopVisual } from "./loadoutVisualCatalog.js";

export default function TroopCard({
  troop, selected, focused, unavailable, index, reduceMotion,
  onToggle, onPreview, onPreviewEnd, onInfo, buttonRef, onKeyDown,
}) {
  const visual = getLoadoutTroopVisual(troop);
  return <motion.article
    className={`unit-card loadout-troop-card ${selected ? "active" : ""} ${focused ? "focused" : ""} ${unavailable ? "limit-locked" : ""}`}
    style={{ "--troop-color": troop.color }}
    initial={reduceMotion ? false : { opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: reduceMotion ? 0 : Math.min(index * .025, .25) }}
    whileHover={reduceMotion ? undefined : { y: -3 }}
    onMouseEnter={onPreview}
    onMouseLeave={onPreviewEnd}
    onFocusCapture={onPreview}
  >
    <button
      ref={buttonRef}
      type="button"
      className="unit-select"
      aria-pressed={selected}
      aria-label={`${selected ? "Remover" : "Selecionar"} ${troop.label}`}
      aria-describedby={`troop-meta-${troop.id}`}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <span className="unit-check" aria-hidden="true">{selected ? "✓" : "+"}</span>
      <span className={`unit-portrait ${visual.portraitClass} ${visual.flipX ? "flipped-sprite" : ""}`}>
        <img src={getTroopPreviewUrl(troop.id)} alt="" />
      </span>
      <span className="unit-info">
        <span className="eyebrow">{troop.role}</span>
        <h2>{troop.label}</h2>
        {troop.title && <small className="unit-title">{troop.title}</small>}
        <span id={`troop-meta-${troop.id}`} className="unit-summary">
          <span>⚡ {troop.price}</span><span>SUP {troop.supply}</span>
        </span>
      </span>
      {focused && <motion.span layoutId="focused-troop" className="focused-troop-indicator">EM ANÁLISE</motion.span>}
    </button>
    <button type="button" className="unit-info-button" aria-label={`Informações de ${troop.label}`} onClick={onInfo}>i</button>
  </motion.article>;
}
