// Compatibility façade. New callers should use BattleScreen directly.
export { BattleScreen as default } from "./BattleScreen.jsx";
export {
  BattleScreen,
  CapsuleInteractionButton,
  ColossusSpecialButtons,
  DecisionModal,
  drawLeviathanBrineJet,
  FREE_HAND_ACTIVATED_MESSAGE,
  FortuneChoiceModal,
  getThermalBannerText,
  getWaveOutroCameraTransform,
  isLeviathanShadowOnly,
  isRasgamarShadowOnly,
  resolveCanvasClickAction,
  resolveInspectedTroopId,
  SandboxPanel,
  WaveOutroOverlay,
} from "./BattleScreen.jsx";
export {
  drawBattleRows,
  drawEnemyEntity,
  drawTroopEntity,
} from "./render/entityRenderer.js";
