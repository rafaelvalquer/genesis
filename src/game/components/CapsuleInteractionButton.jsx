import { FIELD, VIEWPORT } from "../battleModel.js";

export function CapsuleInteractionButton({ capsule, onOpen }) {
  if (!capsule) return null;
  return <button
    type="button"
    className="capsule-interaction-button"
    style={{ left: `${capsule.x / FIELD.width * 100}%`, top: `${(capsule.y + VIEWPORT.fieldOffsetY) / VIEWPORT.height * 100}%` }}
    aria-label="Abrir Cápsula da Colônia"
    onClick={onOpen}
  ><span aria-hidden="true">◇</span></button>;
}

export default CapsuleInteractionButton;
