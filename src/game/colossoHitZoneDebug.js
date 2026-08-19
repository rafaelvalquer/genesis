import { CELL } from "./visualGeometry.js";

export const COLOSSO_HIT_ZONE_LABELS = Object.freeze([
  Object.freeze({ row: 0, part: "LEFT ARM" }),
  Object.freeze({ row: 1, part: "HEAD" }),
  Object.freeze({ row: 2, part: "CORE" }),
  Object.freeze({ row: 3, part: "CORE" }),
  Object.freeze({ row: 4, part: "RIGHT ARM" }),
]);

export function getColossoHitZoneLabels() {
  return COLOSSO_HIT_ZONE_LABELS.map((zone) => ({ ...zone, label: `ROW ${zone.row} · ${zone.part}` }));
}

export function getColossoHitZoneOverlayEntries(anchorY, rowHeight = CELL.height) {
  if (!Number.isFinite(anchorY) || !Number.isFinite(rowHeight)) return [];
  return getColossoHitZoneLabels().map((zone) => ({
    ...zone,
    y: anchorY + (zone.row - 2) * rowHeight,
  }));
}

export function drawColossoHitZoneOverlay(ctx, {
  anchorX,
  anchorY,
  rowHeight = CELL.height,
  fontSize = 12,
} = {}) {
  if (!ctx || !Number.isFinite(anchorX) || !Number.isFinite(anchorY) || !Number.isFinite(rowHeight)) return;
  const labels = getColossoHitZoneOverlayEntries(anchorY, rowHeight);
  ctx.save();
  ctx.font = `800 ${fontSize}px Chakra Petch, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const zone of labels) {
    const { y } = zone;
    const text = zone.label;
    const width = ctx.measureText(text).width + fontSize;
    ctx.fillStyle = "rgba(8, 20, 35, .78)";
    ctx.fillRect(anchorX - width / 2, y - fontSize * .76, width, fontSize * 1.52);
    ctx.strokeStyle = zone.part === "CORE" ? "#fbbf24" : "#67e8f9";
    ctx.lineWidth = 1;
    ctx.strokeRect(anchorX - width / 2, y - fontSize * .76, width, fontSize * 1.52);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(text, anchorX, y);
  }
  ctx.restore();
}
