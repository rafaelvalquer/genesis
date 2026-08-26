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
  const image = sprites?.[tree.type]?.[stage];
  if (isDevelopment) console.debug("[ForestObstacleSprite]", tree.id, tree.type, stage, Boolean(image));
  if (image) {
    ctx.save(); ctx.globalAlpha = tree.alive ? 1 : .52; ctx.translate(x, base); ctx.scale(tree.flipX ? -1 : 1, 1);
    ctx.drawImage(image, -geometry.width / 2, -geometry.height, geometry.width, geometry.height); ctx.restore();
  } else {
    if (isDevelopment) console.error(`[ForestObstacle] Sprite ausente: ${tree.type}/${stage}`);
    ctx.save();
    ctx.translate(tree.x, base - geometry.height * .5);
    ctx.globalAlpha = .9;
    ctx.fillStyle = "#ff00a8";
    ctx.fillRect(-geometry.width * .38, -18, geometry.width * .76, 36);
    ctx.fillStyle = "#12000d";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TREE ASSET", 0, -2);
    ctx.fillText("MISSING", 0, 13);
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
