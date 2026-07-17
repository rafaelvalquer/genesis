import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENEMIES, TROOPS } from "./content.js";
import { getArenaUrl, getEnemyPreviewUrl, getTroopPreviewUrl, loadBattleAssets } from "./assetCatalog.js";
import { getDeployCooldownProgress } from "./cooldownVisual.js";
import {
  drawArenaBackground,
  drawArenaForeground,
  drawArenaUnderlay,
  drawContactShadow,
  drawPlacementRange,
  drawTacticalGrid,
  getPlacementPreviewGeometry,
} from "./arenaRenderer.js";
import { drawFrozenEnemyEffect, drawMines, drawParticles, drawProjectiles, pushEventParticles } from "./projectileRenderer.js";
import {
  getAnchoredSpriteRect, getEnemyAnimation, getEnemyMuzzleWorldPosition, getSpriteRect,
  getTroopAnimation, getTroopFrameAnchor, isEnemyFrozen,
} from "./visualGeometry.js";
import {
  configureHiDPICanvas, consumeGraphicsEvents, createGraphicsRuntime, getCameraOffset,
  getHealthVisual, getHitReaction, interpolateEntity, updateGraphicsRuntime,
} from "./graphicsRuntime.js";
import {
  drawDecals, drawDeploymentEffects, drawDynamicLights, drawPostProcessing,
  drawWetReflections, presentScene,
} from "./graphicsRenderer.js";
import {
  FIELD,
  cellFromPoint,
  clearSandboxEntities,
  createBattleSession,
  getSnapshot,
  placeTroop,
  removeTroop,
  selectDecision,
  setSandboxSettings,
  spawnEnemy,
  startWave,
  stepBattle,
} from "./battleModel.js";
import { loadSettings } from "../campaign/storage.js";

function drawSprite(ctx, image, entity, targetHeight, opacity = 1, filter = "none", anchor = null) {
  if (!image?.width || !image?.height) return false;
  const rect = getAnchoredSpriteRect(entity, targetHeight, image.width / image.height, anchor);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

function getTroopVisualEntity(entity, config) {
  return config.spriteOffsetY ? { ...entity, y: entity.y + config.spriteOffsetY } : entity;
}

function drawAbyssCharge(ctx, enemy, config, elapsed, settings) {
  if (!enemy.casting || config.attack !== "arcane") return;
  const progress = Math.max(0, Math.min(1, (elapsed - enemy.castStartedAt) / Math.max(1, config.chargeMs)));
  const origin = getEnemyMuzzleWorldPosition(enemy, config);
  const pulse = settings.reduceMotion ? 1 : 0.9 + Math.sin(elapsed / 70) * 0.1;
  const radius = (5 + progress * 10) * pulse * (enemy.scale || 1);
  const glow = ctx.createRadialGradient(origin.x - 2, origin.y - 2, 1, origin.x, origin.y, radius * 2.3);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.2, "#e9d5ff");
  glow.addColorStop(0.55, config.color);
  glow.addColorStop(1, "rgba(88,28,135,0)");
  ctx.save();
  ctx.fillStyle = glow;
  ctx.shadowBlur = 16 + progress * 12;
  ctx.shadowColor = config.color;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius * 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5e8ff";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHealth(ctx, entity, runtime, now, width = 54, offset = 47, accent = null) {
  const { ratio, trail } = getHealthVisual(runtime, entity, now);
  const x = entity.x - width / 2;
  const y = entity.y - offset;
  ctx.fillStyle = "rgba(2,6,23,.92)";
  ctx.fillRect(x - 2, y - 2, width + 4, 10);
  ctx.strokeStyle = accent || "rgba(186,230,253,.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, width + 3, 9);
  ctx.fillStyle = "rgba(248,113,113,.72)";
  ctx.fillRect(x + 1, y + 1, (width - 2) * trail, 4);
  ctx.fillStyle = accent || (ratio > 0.55 ? "#34d399" : ratio > 0.25 ? "#fbbf24" : "#fb7185");
  ctx.fillRect(x + 1, y + 1, (width - 2) * ratio, 4);
}

function drawProceduralGlassEnemy(ctx, entity, config, elapsed, filter = "none") {
  if (!config.proceduralKind) return false;
  const scale = entity.scale || 1;
  const pulse = 0.82 + Math.sin(elapsed / 150 + entity.row) * 0.12;
  const glass = ctx.createLinearGradient(-30 * scale, -28 * scale, 34 * scale, 25 * scale);
  glass.addColorStop(0, "#07111a");
  glass.addColorStop(0.48, config.color);
  glass.addColorStop(1, "#8b5cf6");
  const polygon = (points, fill = glass, stroke = "#c7fff0") => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(0.8, 1.15 * scale);
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.filter = filter;
  ctx.shadowBlur = 12 * scale;
  ctx.shadowColor = config.color;
  if (config.proceduralKind === "estilha") {
    polygon([[-30, -4], [-13, -20], [18, -17], [31, 1], [10, 17], [-20, 13]], "#101128");
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? "#7fffd4" : "#8b5cf6";
      ctx.lineWidth = 4 * scale;
      [-17, 0, 17].forEach((offset, index) => {
        ctx.beginPath();
        ctx.moveTo(offset * scale, (4 + index * 2) * scale);
        ctx.lineTo((offset + side * (17 + index * 3)) * scale, (20 + index * 3) * scale);
        ctx.lineTo((offset + side * (23 + index * 4)) * scale, 27 * scale);
        ctx.stroke();
      });
    }
    polygon([[-24, -12], [-9, -31], [0, -10]], "#211247");
    ctx.fillStyle = "#ffcf70";
    ctx.fillRect(-34 * scale, -2 * scale, 11 * scale, 3.5 * scale);
  } else if (config.proceduralKind === "vitrarca") {
    polygon([[-19, -42], [0, -58], [19, -42], [15, 3], [0, 20], [-15, 3]], "#0a1220");
    polygon([[-22, -37], [-44, -18], [-27, 4], [-8, -19]], "#102f35");
    polygon([[22, -37], [44, -18], [27, 4], [8, -19]], "#28164c");
    ctx.strokeStyle = "#7fffd4";
    ctx.lineWidth = 7 * scale;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 18 * scale, -15 * scale);
      ctx.quadraticCurveTo(side * 48 * scale, 5 * scale, side * 33 * scale, 38 * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * 8 * scale, 8 * scale);
      ctx.lineTo(side * 20 * scale, 42 * scale);
      ctx.stroke();
    }
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(0, -38 * scale, 5 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (config.proceduralKind === "obsidonte") {
    polygon([[-42, -43], [-10, -61], [34, -49], [49, -15], [35, 11], [-35, 12], [-53, -16]], "#080a12", "#7fffd4");
    polygon([[-42, -26], [-61, -7], [-54, 30], [-32, 20], [-21, -9]], "#111522");
    polygon([[39, -29], [60, -8], [55, 32], [31, 22], [20, -8]], "#111522");
    polygon([[-27, 7], [-18, 39], [-4, 39], [-1, 8]], "#080a12");
    polygon([[27, 7], [18, 39], [4, 39], [1, 8]], "#080a12");
    ctx.fillStyle = "#ffcf70";
    ctx.shadowColor = "#ffcf70";
    ctx.beginPath();
    ctx.arc(0, -18 * scale, 10 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (config.proceduralKind === "refrator") {
    polygon([[0, -43], [17, -18], [10, 18], [0, 33], [-10, 18], [-17, -18]], "#090b18");
    polygon([[-8, -19], [-51, -39], [-39, 6], [-15, 20]], "rgba(127,255,212,.44)");
    polygon([[8, -19], [51, -39], [39, 6], [15, 20]], "rgba(127,255,212,.44)");
    ctx.strokeStyle = "#ffcf70";
    ctx.lineWidth = 3 * scale;
    for (let index = 0; index < 3; index += 1) {
      const angle = elapsed / 520 + index * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 9 * scale, (-13 + Math.sin(angle) * 9) * scale);
      ctx.lineTo(Math.cos(angle) * 19 * scale, (-13 + Math.sin(angle) * 19) * scale);
      ctx.stroke();
    }
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(0, -13 * scale, 9 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return true;
}

export function DecisionModal({ level, options, onChoose }) {
  return <div className="modal-backdrop"><div className="decision-modal"><span className="eyebrow amber">Decisão · Nível {level}</span><h2>Escolha uma vantagem tática</h2><p>Escolha obrigatória antes da próxima onda. A duração está indicada em cada efeito.</p><div className="decision-grid">{options.map((option) => <button key={option.id} onClick={() => onChoose(option)}><b>{option.label}</b><span>{option.description}</span></button>)}</div></div></div>;
}

function drawDeathVisuals(ctx, runtime, assets, now, phase) {
  for (const death of runtime.deaths) {
    const progress = Math.min(1, (now - death.born) / death.life);
    const entity = death.entity;
    const config = death.kind === "troop" ? TROOPS[entity.type] : ENEMIES[entity.type];
    const groups = death.kind === "troop" ? assets.troops[entity.type] : assets.enemies[entity.type];
    const frames = groups?.attack || groups?.walking || groups?.idle || groups?.defense || [];
    const image = frames[Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)))] || frames[0];
    const height = death.kind === "troop" ? config?.attackVisual?.height || 126 : 128 * (entity.scale || 1);
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate((death.kind === "enemy" ? .22 : -.18) * progress);
    const deathEntity = death.kind === "troop"
      ? getTroopVisualEntity({ ...entity, x: 0, y: progress * 9 }, config)
      : {
        ...entity,
        x: 0,
        y: progress * 9 + (config?.spriteOffsetY || 0) * (entity.scale || 1),
      };
    drawSprite(ctx, image, deathEntity, height, Math.max(0, 1 - progress * progress), `grayscale(${progress * .6}) drop-shadow(0 0 5px ${phase.palette.accent})`);
    ctx.restore();
  }
}

function drawTroopPlacementPreview(ctx, assets, selectedTroop, preview, elapsed, settings) {
  if (!preview || !selectedTroop) return;
  const config = TROOPS[selectedTroop];
  const troopAssets = assets.troops[selectedTroop] || {};
  const entity = {
    ...preview,
    type: selectedTroop,
    hp: config.hp,
    maxHp: config.hp,
    lastAttackAt: -Infinity,
  };
  const visualEntity = getTroopVisualEntity(entity, config);
  const animation = getTroopAnimation(entity, config, elapsed, {
    idle: troopAssets.idle?.length,
    attack: troopAssets.attack?.length,
    attackMine: troopAssets.attackMine?.length,
    attackGun: troopAssets.attackGun?.length,
    defense: troopAssets.defense?.length,
  });
  const frames = troopAssets[animation.state] || troopAssets.idle || troopAssets.defense || [];
  const image = frames[animation.frame % Math.max(1, frames.length)];
  const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
  const height = config.attackVisual?.height || (selectedTroop === "muralhaReforcada" ? 112 : 126);

  ctx.save();
  ctx.globalAlpha = preview.valid ? 0.32 : 0.18;
  drawContactShadow(ctx, entity, 1, settings);
  ctx.restore();

  const opacity = preview.valid ? 0.45 : 0.27;
  const filter = preview.valid
    ? `brightness(1.15) drop-shadow(0 0 8px ${config.color})`
    : "grayscale(.55) sepia(1) saturate(6) hue-rotate(310deg) brightness(.95) drop-shadow(0 0 7px #fb7185)";
  if (!drawSprite(ctx, image, visualEntity, height, opacity, filter, frameAnchor)) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = preview.color;
    ctx.fillRect(visualEntity.x - 24, visualEntity.y - 34, 48, 68);
    ctx.restore();
  }
}

function drawBattle(ctx, session, assets, particlesRef, runtime, selectedTroop, removeMode, hoveredCell, settings, now, interpolation) {
  drawArenaBackground(ctx, session.phase, settings);
  drawArenaUnderlay(ctx, session.phase, settings, session, now);
  const placementPreview = getPlacementPreviewGeometry(session, selectedTroop, hoveredCell, removeMode);
  drawTacticalGrid(ctx, session, selectedTroop, removeMode, hoveredCell);
  drawPlacementRange(ctx, placementPreview);
  drawDecals(ctx, runtime, settings);

  const baseGradient = ctx.createLinearGradient(0, 0, 48, 0);
  baseGradient.addColorStop(0, `${session.phase.palette.primary}55`);
  baseGradient.addColorStop(1, "transparent");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, 58, FIELD.height);

  const mineAssets = assets.troops.demolidora || {};
  drawMines(ctx, session.mines, mineAssets.mine?.[0], session.elapsed);
  drawProjectiles(ctx, [
    ...session.projectiles.map((entity) => interpolateEntity(entity, interpolation)),
    ...session.enemyProjectiles.map((entity) => interpolateEntity(entity, interpolation)),
  ], settings, mineAssets);

  const sorted = [
    ...session.troops.map((entity) => ({ kind: "troop", entity })),
    ...session.enemies.map((entity) => ({ kind: "enemy", entity: interpolateEntity(entity, interpolation) })),
  ].sort((left, right) => left.entity.row - right.entity.row || left.entity.x - right.entity.x);
  drawWetReflections(ctx, session.phase, sorted.map((item) => item.entity), settings);

  for (const item of sorted) {
    const logicalEntity = item.kind === "troop" ? item.entity : session.enemies.find((entry) => entry.id === item.entity.id) || item.entity;
    const reaction = getHitReaction(runtime, item.entity.id, now);
    const entity = { ...item.entity, x: item.entity.x + reaction.offsetX };
    if (item.kind !== "enemy" || !entity.attachedToTroopId) {
      drawContactShadow(ctx, entity, item.kind === "enemy" ? entity.scale : 1, settings);
    }
    if (item.kind === "troop") {
      const config = TROOPS[entity.type];
      const troopAssets = assets.troops[entity.type] || {};
      const animation = getTroopAnimation(entity, config, session.elapsed, {
        idle: troopAssets.idle?.length, attack: troopAssets.attack?.length,
        attackMine: troopAssets.attackMine?.length, attackGun: troopAssets.attackGun?.length,
        defense: troopAssets.defense?.length,
      });
      const frames = troopAssets[animation.state] || troopAssets.idle || [];
      const image = frames[animation.frame % Math.max(1, frames.length)];
      const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
      const visualEntity = getTroopVisualEntity(entity, config);
      const troopFilter = `drop-shadow(0 0 ${3 + reaction.flash * 5}px ${session.phase.palette.primary}) brightness(${1 + reaction.flash * .65})`;
      if (!drawSprite(ctx, image, visualEntity, config.attackVisual?.height || (entity.type === "muralhaReforcada" ? 112 : 126), 1, troopFilter, frameAnchor)) {
        ctx.fillStyle = config.color;
        ctx.fillRect(visualEntity.x - 24, visualEntity.y - 34, 48, 68);
      }
      drawHealth(ctx, logicalEntity, runtime, now, 54, 52);
    } else {
      const config = ENEMIES[entity.type];
      let visualEntity = config.spriteOffsetY
        ? { ...entity, y: entity.y + config.spriteOffsetY * entity.scale }
        : entity;
      if (entity.attachedToTroopId) {
        visualEntity = { ...visualEntity, y: visualEntity.y + (config.attachmentOffsetY || 0) };
      } else if (entity.jumping) {
        const progress = Math.max(0, Math.min(1, Number(entity.jumpProgress) || 0));
        visualEntity = { ...visualEntity, y: visualEntity.y - config.jumpArcHeight * 4 * progress * (1 - progress) };
      }
      const frozen = isEnemyFrozen(entity, session.elapsed);
      const enemyAssets = assets.enemies[entity.type] || {};
      const animation = getEnemyAnimation(entity, config, session.elapsed, {
        idle: enemyAssets.idle?.length, walking: enemyAssets.walking?.length,
        attack: enemyAssets.attack?.length, jump: enemyAssets.jump?.length,
      });
      const frames = enemyAssets[animation.state] || enemyAssets.walking || enemyAssets.idle || [];
      const image = frames[animation.frame % Math.max(1, frames.length)];
      const enemyHeight = 128 * entity.scale;
      const bossShift = entity.variant === "alpha" ? ` hue-rotate(${entity.bossPhase * 24}deg) saturate(${1.05 + entity.bossPhase * .18})` : "";
      const echoFilter = entity.isEcho ? " saturate(.65) brightness(1.28) hue-rotate(34deg) contrast(1.08)" : "";
      const baseFilter = frozen ? "saturate(.55) brightness(1.16)" : `brightness(${1 + reaction.flash * .75})${bossShift}${echoFilter}`;
      let spriteDrawn = drawSprite(ctx, image, visualEntity, enemyHeight, entity.isEcho ? 0.72 : 1, `${baseFilter} drop-shadow(0 0 ${entity.isEcho ? 11 : 3 + reaction.flash * 6}px ${entity.isEcho ? "#7fffd4" : session.phase.palette.accent})`);
      if (!spriteDrawn) spriteDrawn = drawProceduralGlassEnemy(ctx, visualEntity, config, session.elapsed, baseFilter);
      if (frozen && spriteDrawn) {
        drawSprite(ctx, image, visualEntity, enemyHeight, 0.38, "brightness(0) saturate(100%) invert(82%) sepia(46%) saturate(1134%) hue-rotate(156deg) brightness(104%) contrast(102%)");
      }
      if (!spriteDrawn) {
        ctx.fillStyle = frozen ? "#38bdf8" : config.color;
        ctx.beginPath();
        ctx.arc(visualEntity.x, visualEntity.y, 24 * entity.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      drawAbyssCharge(ctx, entity, config, session.elapsed, settings);
      if (frozen) drawFrozenEnemyEffect(ctx, visualEntity, session.elapsed, settings);
      if (entity.isEcho) {
        const radius = 31 * entity.scale;
        ctx.save();
        ctx.strokeStyle = "rgba(127,255,212,.72)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#8b5cf6";
        ctx.beginPath();
        ctx.moveTo(visualEntity.x, visualEntity.y - radius);
        ctx.lineTo(visualEntity.x + radius * .72, visualEntity.y);
        ctx.lineTo(visualEntity.x, visualEntity.y + radius * .45);
        ctx.lineTo(visualEntity.x - radius * .72, visualEntity.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      drawHealth(ctx, logicalEntity, runtime, now, entity.variant === "alpha" ? 100 : 58, 58 * entity.scale, entity.isEcho ? "#7fffd4" : null);
      if (entity.variant === "alpha") {
        ctx.fillStyle = "#fecdd3";
        ctx.font = "700 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`${config.label.toUpperCase()} ALFA`, entity.x, entity.y - 76 * entity.scale);
      }
    }
  }

  drawTroopPlacementPreview(ctx, assets, selectedTroop, placementPreview, now, settings);
  drawDeathVisuals(ctx, runtime, assets, now, session.phase);
  drawDeploymentEffects(ctx, runtime, now, settings);
  drawDynamicLights(ctx, runtime, now, settings);
  drawArenaForeground(ctx, session.phase, settings, session, now);
  particlesRef.current = drawParticles(ctx, particlesRef.current, now, settings);
  drawPostProcessing(ctx, session.phase, settings, session, now);
}

function SandboxPanel({
  selectedEnemy, onSelectEnemy, row, onRow, count, onCount, alpha, onAlpha,
  settings, onSetting, onRulesMode, onSpawn, onClear, onReset,
}) {
  const selected = ENEMIES[selectedEnemy];
  const slider = (key, label, min, max) => <label className="sandbox-slider" key={key}>
    <span><b>{label}</b><output>{Math.round(settings[key] * 100)}%</output></span>
    <input type="range" min={min} max={max} step="0.25" value={settings[key]} onChange={(event) => onSetting(key, Number(event.target.value))} />
  </label>;
  return <aside className="sandbox-panel" aria-label="Controles do laboratório">
    <div className="sandbox-panel-heading"><div><span className="eyebrow">LABORATÓRIO</span><h2>Gerador de hostis</h2></div><button className="sandbox-reset" onClick={onReset}>Reiniciar</button></div>
    <div className="sandbox-mode-toggle" aria-label="Regras da arena">
      <button className={settings.rulesMode === "free" ? "active" : ""} onClick={() => onRulesMode("free")}>Livre</button>
      <button className={settings.rulesMode === "real" ? "active" : ""} onClick={() => onRulesMode("real")}>Regras reais</button>
    </div>
    <div className="enemy-catalog" aria-label="Catálogo de inimigos">{Object.values(ENEMIES).map((enemy) => <button
      key={enemy.id}
      className={selectedEnemy === enemy.id ? "selected" : ""}
      style={{ "--enemy-color": enemy.color }}
      onClick={() => onSelectEnemy(enemy.id)}
      title={`${enemy.label}: ${enemy.hp} HP, ${enemy.damage} dano`}
    ><img src={getEnemyPreviewUrl(enemy.id)} alt="" /><span>{enemy.label}</span></button>)}</div>
    <section className="sandbox-spawn-card">
      <header><div><span>HOSTIL SELECIONADO</span><b>{selected.label}</b></div><dl><div><dt>HP</dt><dd>{selected.hp}</dd></div><div><dt>VEL</dt><dd>{selected.speed}</dd></div><div><dt>DMG</dt><dd>{selected.damage}</dd></div></dl></header>
      <div className="sandbox-choice"><span>Rota</span><div>{[0, 1, 2, 3, 4].map((value) => <button key={value} className={row === value ? "active" : ""} onClick={() => onRow(value)}>{value + 1}</button>)}</div></div>
      <div className="sandbox-choice"><span>Quantidade</span><div>{[1, 5, 10].map((value) => <button key={value} className={count === value ? "active" : ""} onClick={() => onCount(value)}>{value}</button>)}</div></div>
      <label className="sandbox-check"><span><b>Variante Alpha</b><small>8× HP, maior escala e dano</small></span><input type="checkbox" checked={alpha} onChange={(event) => onAlpha(event.target.checked)} /></label>
          <button className="sandbox-spawn-button" onClick={onSpawn}>
            {count > 1 ? `GERAR ${count} HOSTIS` : "GERAR 1 HOSTIL"}
          </button>
    </section>
    <details className="sandbox-balance" open>
      <summary>Balanceamento temporário</summary>
      {slider("enemyHpMultiplier", "HP inimigo", 0.25, 4)}
      {slider("enemySpeedMultiplier", "Velocidade inimigo", 0, 3)}
      {slider("enemyDamageMultiplier", "Dano inimigo", 0, 3)}
      {slider("troopDamageMultiplier", "Dano das tropas", 0.25, 3)}
      <label className="sandbox-check"><span><b>Base invulnerável</b><small>Rupturas não reduzem integridade</small></span><input type="checkbox" checked={settings.invulnerableBase} onChange={(event) => onSetting("invulnerableBase", event.target.checked)} /></label>
    </details>
    <div className="sandbox-cleanup"><button onClick={() => onClear("enemies")}>Limpar hostis</button><button onClick={() => onClear("troops")}>Limpar tropas</button></div>
  </aside>;
}

export default function GameCanvas({ phase, unlockedTroops, onFinish, onExit, sandbox = false }) {
  const loadout = useMemo(() => unlockedTroops.map((entry) => typeof entry === "string" ? entry : entry.id), [unlockedTroops]);
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);
  const sessionRef = useRef(null);
  const particlesRef = useRef([]);
  const graphicsRef = useRef(createGraphicsRuntime());
  const hoveredCellRef = useRef(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const finishSentRef = useRef(false);
  const audioRef = useRef({});
  if (!sessionRef.current) sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox });

  const [loading, setLoading] = useState({ ready: false, percent: 0 });
  const [snapshot, setSnapshot] = useState(() => getSnapshot(sessionRef.current));
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sandboxSettingsState, setSandboxSettingsState] = useState(() => ({ ...sessionRef.current.sandboxSettings }));
  const [selectedEnemy, setSelectedEnemy] = useState(() => Object.keys(ENEMIES)[0]);
  const [spawnRow, setSpawnRow] = useState(0);
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnAlpha, setSpawnAlpha] = useState(false);
  const [selectedTroop, setSelectedTroop] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [graphicsMetrics, setGraphicsMetrics] = useState(null);
  const showGraphicsMetrics = useMemo(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("gfxstats"), []);
  const [message, setMessage] = useState("Selecione uma unidade e posicione-a no campo.");
  const [banner, setBanner] = useState(sandbox
    ? "LABORATÓRIO · CAMPO DE PROVAS"
    : phase.chapterMechanic?.id === "glass_echoes"
      ? `◇ ECOS DE VIDRO ${Math.round(phase.chapterMechanic.chance * 100)}% · FASE ${Number(phase.id.slice(-2))}`
      : `FASE ${Number(phase.id.slice(-2))} · ${phase.name}`);
  const settings = useMemo(loadSettings, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const configureAudio = useCallback((assets) => {
    const build = (name, loop = false) => {
      const url = assets.audio[name];
      if (!url) return null;
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.loop = loop;
      return audio;
    };
    audioRef.current = {
      theme: build("wave_theme.ogg", true),
      alert: build("wave_alert.ogg"),
      deploy: build("deploy.ogg"),
      shoot: [1, 2, 3, 4].map((index) => build(`shoot_ball_${index}.wav`)).filter(Boolean),
      melee: [1, 2, 3, 4].map((index) => build(`melee_${index}.wav`)).filter(Boolean),
    };
  }, []);

  const play = useCallback((channel, intensity = 1) => {
    const source = Array.isArray(audioRef.current[channel])
      ? audioRef.current[channel][Math.floor(Math.random() * audioRef.current[channel].length)]
      : audioRef.current[channel];
    if (!source) return;
    const instance = channel === "theme" ? source : source.cloneNode();
    const group = channel === "theme" ? settings.musicVolume : settings.effectsVolume;
    instance.volume = Math.max(0, Math.min(1, settings.masterVolume * group * intensity));
    instance.play().catch(() => {});
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    loadBattleAssets(
      phase,
      loadout,
      ({ percent }) => !cancelled && setLoading({ ready: false, percent }),
      sandbox ? { enemyIds: Object.keys(ENEMIES) } : {},
    )
      .then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        configureAudio(assets);
        setLoading({ ready: true, percent: 100 });
      });
    return () => {
      cancelled = true;
      audioRef.current.theme?.pause();
    };
  }, [configureAudio, loadout, phase]);

  useEffect(() => {
    if (!loading.ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const renderScale = configureHiDPICanvas(canvas, settings, window.devicePixelRatio || 1);
    const scene = document.createElement("canvas");
    scene.width = FIELD.width;
    scene.height = FIELD.height;
    const sceneCtx = scene.getContext("2d");
    let animationId;
    let previous = performance.now();
    let accumulator = 0;
    let lastUi = 0;
    const loop = (now) => {
      const frameDelta = Math.min(100, now - previous);
      previous = now;
      if (!pausedRef.current) accumulator += frameDelta * speedRef.current;
      while (accumulator >= 32) {
        const events = stepBattle(sessionRef.current, 32);
        pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, settings);
        consumeGraphicsEvents(graphicsRef.current, events, sessionRef.current.elapsed, settings);
        if (events.some((event) => event.type === "spawn")) play("alert", 0.08);
        if (events.some((event) => event.type === "shoot")) play("shoot", 0.18);
        if (events.some((event) => event.type === "melee")) play("melee", 0.2);
        const phaseEvent = events.find((event) => event.type === "bossPhase");
        if (phaseEvent) {
          const alpha = sessionRef.current.enemies.find((enemy) => enemy.variant === "alpha");
          const alphaName = ENEMIES[alpha?.type]?.label?.toUpperCase() || "ALFA";
          setBanner(`⚠ ${alphaName} ALFA · FASE ${phaseEvent.phase + 1}`);
        }
        if (events.some((event) => event.type === "waveComplete")) {
          audioRef.current.theme?.pause();
          setBanner("ONDA CONCLUÍDA · REORGANIZE A DEFESA");
        }
        accumulator -= 32;
      }
      const interpolation = Math.min(1, accumulator / 32);
      updateGraphicsRuntime(graphicsRef.current, sessionRef.current.elapsed, frameDelta, { particles: particlesRef.current.length });
      drawBattle(sceneCtx, sessionRef.current, assetsRef.current, particlesRef, graphicsRef.current, selectedTroop, removeMode, hoveredCellRef.current, settings, sessionRef.current.elapsed, interpolation);
      presentScene(ctx, scene, renderScale, getCameraOffset(graphicsRef.current, sessionRef.current.elapsed, settings), settings);
      if (now - lastUi > 100) {
        lastUi = now;
        setSnapshot(getSnapshot(sessionRef.current));
        if (showGraphicsMetrics) setGraphicsMetrics({ ...graphicsRef.current.metrics });
      }
      if (sessionRef.current.result && !finishSentRef.current) {
        finishSentRef.current = true;
        audioRef.current.theme?.pause();
        onFinish?.(sessionRef.current.result);
      }
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [loading.ready, onFinish, play, removeMode, selectedTroop, settings, showGraphicsMetrics]);

  const pointFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return cellFromPoint((event.clientX - rect.left) * FIELD.width / rect.width, (event.clientY - rect.top) * FIELD.height / rect.height);
  };

  const handleCanvasMove = (event) => {
    hoveredCellRef.current = pointFromPointer(event);
  };

  const handleCanvasClick = (event) => {
    if (snapshot.outcome) return;
    const point = pointFromPointer(event);
    if (removeMode) {
      const result = removeTroop(sessionRef.current, point.row, point.col);
      setMessage(result.ok ? `Unidade removida · +${result.refund} energia.` : result.reason);
      if (result.ok) {
        consumeGraphicsEvents(graphicsRef.current, [result.event], sessionRef.current.elapsed, settings);
        pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, settings);
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (!selectedTroop) return;
    const result = placeTroop(sessionRef.current, selectedTroop, point.row, point.col);
    setMessage(result.ok ? `${TROOPS[selectedTroop].label} implantado.` : result.reason);
    if (result.ok) {
      play("deploy", 0.55);
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, settings);
      consumeGraphicsEvents(graphicsRef.current, [result.event], sessionRef.current.elapsed, settings);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleStartWave = () => {
    if (startWave(sessionRef.current)) {
      consumeGraphicsEvents(graphicsRef.current, [{ type: "waveStart" }], sessionRef.current.elapsed, settings);
      setBanner(`ONDA ${sessionRef.current.waveIndex + 1} · CONTATO`);
      setMessage("Onda em andamento. Novas implantações entram em cooldown.");
      play("alert", 0.75);
      play("theme", 0.75);
      setSnapshot(getSnapshot(sessionRef.current));
    }
  };

  const handleDecision = (option) => {
    if (selectDecision(sessionRef.current, option)) {
      setMessage(`${option.label}: efeito aplicado.`);
      setSnapshot(getSnapshot(sessionRef.current));
    } else {
      setMessage("Não foi possível aplicar essa decisão.");
    }
  };

  const resetSandbox = (nextSettings = sandboxSettingsState) => {
    if (!sandbox) return;
    sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox: true, sandboxSettings: nextSettings });
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    hoveredCellRef.current = null;
    setSelectedTroop(null);
    setRemoveMode(false);
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner("LABORATÓRIO · CAMPO DE PROVAS");
    setMessage("Arena reiniciada. Selecione uma tropa ou gere hostis.");
  };

  const updateSandboxSetting = (key, value) => {
    const next = { ...sandboxSettingsState, [key]: value };
    setSandboxSettingsState(next);
    setSandboxSettings(sessionRef.current, { [key]: value });
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const changeRulesMode = (rulesMode) => {
    const next = { ...sandboxSettingsState, rulesMode };
    setSandboxSettingsState(next);
    resetSandbox(next);
  };

  const handleSpawnEnemy = () => {
    const result = spawnEnemy(sessionRef.current, {
      type: selectedEnemy,
      row: spawnRow,
      count: spawnCount,
      variant: spawnAlpha ? "alpha" : undefined,
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, settings);
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner(`${ENEMIES[selectedEnemy].label.toUpperCase()}${spawnAlpha ? " ALFA" : ""} · ROTA ${spawnRow + 1}`);
    setMessage(`${spawnCount} ${ENEMIES[selectedEnemy].label}${spawnCount > 1 ? "s" : ""} gerado${spawnCount > 1 ? "s" : ""} na rota ${spawnRow + 1}.`);
  };

  const handleClear = (target) => {
    clearSandboxEntities(sessionRef.current, target);
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(target === "enemies" ? "Todos os hostis foram removidos." : "Todas as tropas foram removidas.");
  };

  if (!loading.ready) {
    return <div className="battle-loader" style={{ "--arena-image": `url(${getArenaUrl(phase.arenaId)})`, "--arena-primary": phase.palette.primary }}><div className="loader-scrim" /><div className="loader-content"><div className="loader-mark">GD</div><span className="eyebrow">{phase.name}</span><h2>Preparando campo tático</h2><div className="progress-track"><span style={{ width: `${loading.percent}%` }} /></div><p>{loading.percent}% · sincronizando arena, loadout e hostis</p></div></div>;
  }

  return (
    <section className={`battle-shell environment-${phase.environment} ${phase.chapterId === "chapter_02" ? "chapter-2-battle" : ""} ${sandbox ? "sandbox-battle" : ""}`}>
      <header className="battle-topbar">
        <div><span className="eyebrow">{phase.subtitle}</span><h1>{phase.name}</h1></div>
        <div className="battle-stats">
          <div className={snapshot.energyPulse ? "energy-pulse" : ""}><span>Energia</span><strong className="cyan">{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.energy}/${snapshot.energyMax}`}</strong></div>
          <div><span>Supply</span><strong>{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.supply}/${snapshot.supplyMax}`}</strong></div>
          <div><span>Integridade</span><strong className={snapshot.integrity / snapshot.integrityMax <= 0.4 ? "danger" : "success"}>{snapshot.integrity}/{snapshot.integrityMax}</strong></div>
          <div><span>{sandbox ? "Modo" : "Onda"}</span><strong>{sandbox ? (sandboxSettingsState.rulesMode === "free" ? "LIVRE" : "REAL") : `${snapshot.wave}/${snapshot.totalWaves}`}</strong></div>
          <div><span>Hostis</span><strong>{snapshot.enemies + snapshot.queued}</strong></div>
        </div>
        <div className="battle-actions">
          <button className="icon-button" onClick={() => setPaused((value) => !value)}>{paused ? "▶" : "Ⅱ"}</button>
          <button className="speed-button" disabled={paused} onClick={() => setSpeed((value) => {
            const speeds = sandbox ? [0.5, 1, 2, 4] : [1, 2];
            return speeds[(speeds.indexOf(value) + 1) % speeds.length];
          })}>{speed}×</button>
          <button className="ghost-button" onClick={onExit}>Sair</button>
        </div>
      </header>

      <div className="battle-main">
        <aside className="troop-rail">
          <div className="rail-heading"><span>LOADOUT</span><small>Selecione e posicione</small></div>
          {loadout.map((troopId) => {
            const troop = TROOPS[troopId];
            const deployment = snapshot.deploymentStats[troopId];
            const cooldown = snapshot.cooldowns[troopId] || 0;
            const coolingDown = cooldown > 0;
            const cooldownEnding = coolingDown && cooldown <= 800;
            const lacksEnergy = snapshot.energy < deployment.price;
            const lacksSupply = snapshot.supply < troop.supply;
            const freeMode = sandbox && sandboxSettingsState.rulesMode === "free";
            const disabled = !freeMode && (lacksEnergy || lacksSupply || coolingDown);
            const cooldownProgress = getDeployCooldownProgress(cooldown, deployment.deployCooldownMs);
            const cooldownSeconds = (cooldown / 1000).toFixed(1);
            const unavailableReason = freeMode ? "" : lacksEnergy ? "energia insuficiente" : lacksSupply ? "supply insuficiente" : "";
            const slotLabel = coolingDown
              ? `${troop.label}, recarregando, ${cooldownSeconds} segundos restantes`
              : unavailableReason ? `${troop.label}, ${unavailableReason}` : `${troop.label}, disponível para implantação`;
            return <button key={troopId} className={`troop-slot ${selectedTroop === troopId && !removeMode ? "selected" : ""} ${coolingDown ? "cooling-down" : ""} ${cooldownEnding ? "cooldown-ending" : ""} ${unavailableReason ? "resource-locked" : ""}`} style={{ "--troop-color": troop.color }} disabled={disabled} aria-label={slotLabel} onClick={() => { setRemoveMode(false); setSelectedTroop(troopId); }}>
              <span className="troop-portrait" style={{ "--cooldown-progress": `${cooldownProgress * 360}deg` }}>
                <img src={getTroopPreviewUrl(troopId)} alt="" aria-hidden="true" />
                {coolingDown && <span className="cooldown-sweep" aria-hidden="true" />}
              </span>
              <span className="troop-details"><b>{troop.label}</b><small>{troop.role}</small></span>
              <span className="slot-cost">{freeMode ? "∞" : `⚡${deployment.price}`}<small aria-hidden={coolingDown ? undefined : "true"}>{freeMode ? "LIVRE" : coolingDown ? `${cooldownSeconds}s` : `S${troop.supply}`}</small></span>
            </button>;
          })}
          <button className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}%</button>
          <div className="rail-tip">{message}</div>
        </aside>

        <div className="canvas-wrap">
          <div className="wave-banner">{banner}</div>
          <canvas ref={canvasRef} width={FIELD.width} height={FIELD.height} onClick={handleCanvasClick} onMouseMove={handleCanvasMove} onMouseLeave={() => { hoveredCellRef.current = null; }} aria-label="Campo de batalha em cinco rotas" />
          {graphicsMetrics && <div className="graphics-metrics"><b>{graphicsMetrics.fps.toFixed(0)} FPS</b><span>{graphicsMetrics.frameMs.toFixed(1)} ms</span><span>P {graphicsMetrics.particles}</span><span>D {graphicsMetrics.decals}</span><span>V {graphicsMetrics.visualEntities}</span></div>}
          {paused && <div className="pause-overlay"><span>SIMULAÇÃO PAUSADA</span><button onClick={() => setPaused(false)}>Continuar</button></div>}
          {!sandbox && snapshot.preparing && !snapshot.pendingDecision && !snapshot.outcome && <button className="start-wave" onClick={handleStartWave}>INICIAR ONDA {snapshot.wave}<span>Ameaça detectada · {phase.waves[snapshot.wave - 1].enemies.reduce((sum, entry) => sum + Math.ceil(entry.count * snapshot.nextWaveEnemyCountFactor), 0)} assinaturas</span></button>}
        </div>

        {sandbox && <SandboxPanel
          selectedEnemy={selectedEnemy}
          onSelectEnemy={setSelectedEnemy}
          row={spawnRow}
          onRow={setSpawnRow}
          count={spawnCount}
          onCount={setSpawnCount}
          alpha={spawnAlpha}
          onAlpha={setSpawnAlpha}
          settings={sandboxSettingsState}
          onSetting={updateSandboxSetting}
          onRulesMode={changeRulesMode}
          onSpawn={handleSpawnEnemy}
          onClear={handleClear}
          onReset={() => resetSandbox()}
        />}
      </div>

      {snapshot.pendingDecision && <DecisionModal level={snapshot.pendingDecisionLevel} options={snapshot.pendingDecision} onChoose={handleDecision} />}
    </section>
  );
}
