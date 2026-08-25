import { CELL } from "../visualGeometry.js";

const COLORS = {
  fragile: ["#6f8f58", "#3c5b39", "#7d4b31"],
  ferrivore: ["#83915a", "#405236", "#a84e2d"],
  mineralized: ["#9aa7a1", "#4c5650", "#c65a33"],
  spores: ["#8acb8d", "#345b42", "#63e6d6"],
};

function drawTree(ctx, tree, now, reduceMotion, sprites) {
  const colors = COLORS[tree.type] || COLORS.ferrivore;
  const ratio = tree.hp / Math.max(1, tree.maxHp);
  const damaged = tree.damageStage === "destroyed" ? .05 : Math.max(.35, ratio);
  const shake = reduceMotion || now > tree.hitShakeUntil ? 0 : Math.sin((tree.hitShakeUntil - now) * .1) * 4 * (tree.hitShakeUntil - now) / 130;
  const scale = (tree.scale || 1) * (tree.type === "fragile" ? .72 : tree.type === "mineralized" ? 1.08 : 1);
  const x = tree.x + shake;
  const base = tree.y + CELL.height * .4;
  const stage = tree.damageStage === "healthy" ? "hp100" : tree.damageStage === "damaged75" ? "hp75" : tree.damageStage === "damaged50" ? "hp50" : tree.damageStage === "damaged25" ? "hp25" : "hp0";
  const image = sprites?.[tree.type]?.[stage];
  if (image) {
    const size = (tree.type === "fragile" ? 150 : tree.type === "mineralized" ? 220 : 190) * (tree.scale || 1);
    ctx.save(); ctx.globalAlpha = tree.alive ? 1 : .52; ctx.translate(x, base); ctx.scale(tree.flipX ? -1 : 1, 1);
    ctx.drawImage(image, -size / 2, -size, size, size); ctx.restore();
  } else {
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
  if (tree.alive && Number.isFinite(tree.lastHitAt) && now >= tree.lastHitAt && now - tree.lastHitAt < 1000) {
    const width = 42;
    ctx.fillStyle = "rgba(4,10,8,.8)"; ctx.fillRect(tree.x - width / 2, tree.y - 124, width, 5);
    ctx.fillStyle = "#63e6d6"; ctx.fillRect(tree.x - width / 2, tree.y - 124, width * ratio, 5);
  }
}

export function drawForestObstacles(ctx, session, now = session?.elapsed || 0, settings = {}, assets = null) {
  if (session?.phase?.chapterId !== "chapter_07") return;
  for (const tree of session.forestObstacles || []) drawTree(ctx, tree, now, settings.reduceMotion, assets?.forestObstacles);
}

export function getForestObstacleSpriteStage(tree) {
  return tree?.damageStage || "healthy";
}
