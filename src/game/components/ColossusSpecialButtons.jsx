import { FIELD, VIEWPORT } from "../battleModel.js";

/** Derives the small, immutable UI model without exposing a battle session. */
export function getReadyColossusControls(session) {
  if (!session?.waveActive || session.outcome) return [];
  return session.troops.filter((troop) => (
    !troop.dead
    && troop.type === "colossoImpacto"
    && !troop.specialRequested
    && session.elapsed >= troop.specialReadyAt
  )).map(({ id, x, y, row }) => ({ id, x, y, row }));
}

/** React-only contextual controls for the Colosso special. */
export function ColossusSpecialButtons({ controls, session, onActivate }) {
  // Session support is temporary compatibility for direct consumers/tests.
  const readyColossi = controls || getReadyColossusControls(session);
  return readyColossi.map((troop) => (
    <button
      key={troop.id}
      type="button"
      className="colossus-special-button"
      style={{
        left: `${troop.x / FIELD.width * 100}%`,
        top: `${(VIEWPORT.fieldOffsetY + troop.y - 76) / VIEWPORT.height * 100}%`,
      }}
      aria-label={`Ativar Esmagamento Total do Colosso na rota ${troop.row + 1}`}
      onClick={() => onActivate(troop.id)}
    >
      <span>◆</span> ATIVAR ESMAGAMENTO
    </button>
  ));
}

export default ColossusSpecialButtons;
