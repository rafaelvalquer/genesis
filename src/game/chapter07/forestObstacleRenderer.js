import { CELL } from "../visualGeometry.js";

const COLORS = {
  fragile: ["#6f8f58", "#3c5b39", "#7d4b31"],
  ferrivore: ["#83915a", "#405236", "#a84e2d"],
  mineralized: ["#9aa7a1", "#4c5650", "#c65a33"],
  spores: ["#8acb8d", "#345b42", "#63e6d6"],
};

const SIZE_BY_TYPE = { fragile: 150, ferrivore: 190, mineralized: 220, spores: 190 };
const isDevelopment = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export function getForestObstacleVisualGeometry(tree) {
  const size = (SIZE_BY_TYPE[tree?.type] || SIZE_BY_TYPE.ferrivore) * (tree?.scale || 1);
  return {
    width: size,
    height: size,
    baseY: (tree?.y || 0) + CELL.height * .4,
    healthBarWidth: tree?.type === "mineralized" ? 58 : tree?.type === "fragile" ? 42 : 50,
    healthBarOffsetY: 8,
  };
}

function drawTree(ctx, tree, now, reduceMotion, sprites) {
  const colors = COLORS[tree.type] || COLORS.ferrivore;
  const ratio = tree.hp / Math.max(1, tree.maxHp);
  const damaged = tree.damageStage === "destroyed" ? .05 : Math.max(.35, ratio);
  const shake = reduceMotion || now > tree.hitShakeUntil ? 0 : Math.sin((tree.hitShakeUntil - now) * .1) * 4 * (tree.hitShakeUntil - now) / 130;
  const scale = (tree.scale || 1) * (tree.type === "fragile" ? .72 : tree.type === "mineralized" ? 1.08 : 1);
  const x = tree.x + shake;
  const geometry = getForestObstacleVisualGeometry(tree);
  const base = geometry.baseY;
  const stage = tree.damageStage === "healthy" ? "hp100" : tree.damageStage === "damaged75" ? "hp75" : tree.damageStage === "damaged50" ? "hp50" : tree.damageStage === "damaged25" ? "hp25" : "hp0";
  const image = sprites?.[tree.type]?.[stage] || sprites?.ferrivore?.hp100;
  if (image) {
    ctx.save(); ctx.globalAlpha = tree.alive ? 1 : .52; ctx.translate(x, base); ctx.scale(tree.flipX ? -1 : 1, 1);
    ctx.drawImage(image, -geometry.width / 2, -geometry.height, geometry.width, geometry.height); ctx.restore();
  } else if (isDevelopment) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(tree.flipX ? -scale : scale, scale);
  ctx.globalAlpha = tree.alive ? 1 : .52;
  ctx.fillStyle = colors[2];
  ctx.fillRect(-8, -14, 16, 14);
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = tree.type === "mineralized" ? 11 : 7;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -86 * damaged); ctx.stroke();
  if (tree.alive) {
    ctx.fillStyle = colors[0];
    const canopy = tree.type === "fragile" ? 20 : tree.type === "mineralized" ? 34 : 28;
    for (const [dx, dy, r] of [[-18, -68, canopy], [14, -82, canopy * .9], [0, -112, canopy * .78]]) {
      ctx.beginPath(); ctx.arc(dx, dy * damaged, r * damaged, 0, Math.PI * 2); ctx.fill();
    }
    if (tree.type === "spores") {
      ctx.fillStyle = colors[2];
      for (const dx of [-18, 18]) { ctx.beginPath(); ctx.arc(dx, -70 * damaged, 7, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();
  }
  if (tree.alive) {
    const width = geometry.healthBarWidth;
    const barY = geometry.baseY - geometry.height - geometry.healthBarOffsetY;
    ctx.fillStyle = "rgba(4,10,8,.86)"; ctx.fillRect(tree.x - width / 2, barY, width, 6);
    ctx.fillStyle = ratio > .5 ? "#63e6d6" : ratio > .25 ? "#fbbf24" : "#fb7185";
    ctx.fillRect(tree.x - width / 2, barY, width * Math.max(0, Math.min(1, ratio)), 6);
  }
}

export function drawForestObstacles(ctx, session, now = session?.elapsed || 0, settings = {}, assets = null) {
  if (session?.phase?.chapterId !== "chapter_07") return;
  for (const tree of session.forestObstacles || []) drawTree(ctx, tree, now, settings.reduceMotion, assets?.forestObstacles);
}

export function getForestObstacleSpriteStage(tree) {
  return tree?.damageStage || "healthy";
}
