import { getTroopPreviewUrl } from "../game/assets/troopPreviewCatalog.js";

export default function TroopPortraitTile({
  troop, selected, unavailable, focused, selectionNumber, onToggle, onPreview, onPreviewEnd, buttonRef, onKeyDown,
}) {
  return <article
    className={`troop-portrait-tile ${selected ? "is-selected" : ""} ${focused ? "is-focused" : ""} ${unavailable ? "is-limit-locked" : ""}`}
    style={{ "--troop-color": troop.color }}
    onMouseEnter={onPreview}
    onMouseLeave={onPreviewEnd}
  >
    <button
      ref={buttonRef}
      type="button"
      className="troop-portrait-button"
      aria-pressed={selected}
      aria-label={`${selected ? "Remover" : "Selecionar"} ${troop.label}`}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onFocus={onPreview}
    >
      {selectionNumber && <span className="troop-selection-badge" aria-label={`Posição ${selectionNumber}`}>{selectionNumber}</span>}
      <span className="troop-portrait-image"><img src={getTroopPreviewUrl(troop.id)} alt="" loading="lazy" decoding="async" /></span>
      <span className="troop-portrait-name">{troop.label}</span>
      {unavailable && <span className="troop-limit-mark" aria-hidden="true">×</span>}
    </button>
  </article>;
}
