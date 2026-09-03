// Compatibility façade. New callers should use BattleScreen directly.
export { BattleScreen as default } from "./BattleScreen.jsx";
export {
  BattleScreen,
  CapsuleInteractionButton,
  ColossusSpecialButtons,
  DecisionModal,
  drawBattleRows,
  drawEnemyEntity,
  drawLeviathanBrineJet,
  drawTroopEntity,
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
