import { FIELD, VIEWPORT, getRouteTelemetry } from "./battleModel.js";
import { getConvoyContainmentStatus } from "./chapter07/convoyContainmentStatus.js";

const staticContainmentCache = new Map();
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rgba(hex, alpha) {
  const clean = String(hex || "#22d3ee").replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean, 16);
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
}

function pseudo(index, seed = 1) {
  let value = Math.imul((seed + index * 131) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function chamferedRect(ctx, x, y, width, height, cut = 5) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + width - cut, y);
  ctx.lineTo(x + width, y + cut);
  ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height);
  ctx.lineTo(x + cut, y + height);
  ctx.lineTo(x, y + height - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

export function getContainmentTheme(phase = {}) {
  const material = phase.battlefieldTheme?.material || "metal";
  const effects = phase.ambientEffects || [];
  const kind = /obsidian|glass/.test(material) || effects.includes("refraction")
    ? "glass"
    : /chitin|organic/.test(material) || effects.includes("veins")
      ? "organic"
      : /earth|rock/.test(material) || effects.includes("spores")
        ? "natural"
        : "industrial";
  return {
    kind,
    material,
    seed: phase.battlefieldTheme?.seed || 1,
    primary: phase.palette?.primary || "#22d3ee",
    accent: phase.palette?.accent || "#67e8f9",
    shadow: phase.palette?.shadow || "#02050a",
    panel: phase.battlefieldTheme?.lane || "#102431",
    panelAlt: phase.battlefieldTheme?.laneAlt || "#173447",
    detail: phase.battlefieldTheme?.detail || phase.palette?.accent || "#67e8f9",
  };
}

export function getContainmentCacheKey(phase, settings = {}) {
  const theme = getContainmentTheme(phase);
  return [
    phase.arenaId || phase.id || "arena",
    theme.material,
    theme.primary,
    theme.accent,
    theme.seed,
    settings.quality || "high",
  ].join(":");
}

export function clearContainmentCache() {
  staticContainmentCache.clear();
}

function createCacheCanvas() {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(VIEWPORT.width, VIEWPORT.fieldOffsetY);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = VIEWPORT.width;
  canvas.height = VIEWPORT.fieldOffsetY;
  return canvas;
}

function drawStructuralPanels(ctx, theme, settings) {
  const height = VIEWPORT.fieldOffsetY;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, theme.shadow);
  background.addColorStop(0.16, rgba(theme.panelAlt, 0.92));
  background.addColorStop(0.48, rgba(theme.panel, 0.98));
  background.addColorStop(0.78, rgba(theme.primary, 0.09));
  background.addColorStop(1, "#02060b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, VIEWPORT.width, height);

  const bayWidth = VIEWPORT.width / 7;
  for (let index = 0; index < 7; index += 1) {
    const x = index * bayWidth + 3;
    const width = bayWidth - 6;
    const plate = ctx.createLinearGradient(x, 5, x + width, 65);
    plate.addColorStop(0, rgba(theme.panelAlt, index % 2 ? 0.2 : 0.34));
    plate.addColorStop(0.5, "rgba(2,8,14,.2)");
    plate.addColorStop(1, rgba(theme.panel, index % 2 ? 0.34 : 0.2));
    chamferedRect(ctx, x, 5, width, 61, 7);
    ctx.fillStyle = plate;
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,.08)";
    ctx.stroke();
    ctx.fillStyle = "rgba(226,232,240,.09)";
    ctx.fillRect(x + 12, 8, width - 24, 1);
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.fillRect(x + 8, 64, width - 16, 2);
  }

  const lineCount = settings.quality === "low" ? 7 : 15;
  for (let index = 0; index < lineCount; index += 1) {
    const y = 8 + pseudo(index, theme.seed) * 57;
    const x = pseudo(index, theme.seed + 4) * VIEWPORT.width;
    const width = 45 + pseudo(index, theme.seed + 8) * 150;
    ctx.fillStyle = index % 3 ? "rgba(226,232,240,.018)" : rgba(theme.primary, 0.025);
    ctx.fillRect(x, y, width, 1);
  }

  ctx.fillStyle = "rgba(1,4,8,.72)";
  ctx.fillRect(0, 18, VIEWPORT.width, 3);
  ctx.fillRect(0, 68, VIEWPORT.width, 4);
  ctx.fillStyle = rgba(theme.primary, 0.12);
  ctx.fillRect(0, 19, VIEWPORT.width, 1);
  ctx.fillRect(0, 68, VIEWPORT.width, 1);

  for (let x = 16; x < VIEWPORT.width; x += 86) {
    const bolt = ctx.createRadialGradient(x, 11, 0, x, 11, 3);
    bolt.addColorStop(0, "rgba(226,232,240,.42)");
    bolt.addColorStop(0.35, "rgba(100,116,139,.4)");
    bolt.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bolt;
    ctx.beginPath();
    ctx.arc(x, 11, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMaterialDetails(ctx, theme, settings) {
  const detailCount = settings.quality === "low" ? 4 : 9;
  ctx.save();
  if (theme.kind === "natural") {
    ctx.strokeStyle = rgba(theme.detail, 0.13);
    ctx.lineWidth = 1.6;
    for (let index = 0; index < 4; index += 1) {
      const x = 80 + index * 310 + pseudo(index, theme.seed) * 70;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 28, 18, x + 34, 42, x - 9, 68);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(theme.accent, 0.2);
    for (let index = 0; index < detailCount; index += 1) {
      ctx.beginPath();
      ctx.arc(35 + pseudo(index, theme.seed + 21) * 1030, 12 + pseudo(index, theme.seed + 22) * 48, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.kind === "organic") {
    ctx.strokeStyle = rgba(theme.accent, 0.12);
    for (let index = 0; index < 6; index += 1) {
      const y = 9 + index * 10;
      ctx.lineWidth = 0.7 + (index % 2) * 0.7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= VIEWPORT.width; x += 90) ctx.lineTo(x, y + Math.sin(x * 0.018 + index) * 5);
      ctx.stroke();
    }
    for (let index = 0; index < detailCount; index += 1) {
      const x = 40 + pseudo(index, theme.seed + 31) * 1020;
      const y = 10 + pseudo(index, theme.seed + 32) * 48;
      ctx.fillStyle = rgba(index % 2 ? theme.primary : theme.accent, 0.16);
      ctx.beginPath();
      ctx.arc(x, y, 2 + pseudo(index, 33) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.kind === "glass") {
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < detailCount; index += 1) {
      const x = pseudo(index, theme.seed + 41) * VIEWPORT.width;
      const width = 50 + pseudo(index, theme.seed + 42) * 100;
      const facet = ctx.createLinearGradient(x, 0, x + width, 70);
      facet.addColorStop(0, "transparent");
      facet.addColorStop(0.5, rgba(index % 2 ? theme.primary : theme.accent, 0.055));
      facet.addColorStop(1, "transparent");
      ctx.fillStyle = facet;
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x + width * 0.38, 4);
      ctx.lineTo(x + width, 68);
      ctx.lineTo(x + width * 0.62, 68);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = rgba(theme.detail, 0.11);
    for (let index = 0; index < 12; index += 1) {
      const x = 22 + index * 93;
      ctx.save();
      ctx.translate(x, 27);
      ctx.rotate(-0.55);
      ctx.fillRect(0, 0, 18, 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderStaticContainment(ctx, phase, settings) {
  const theme = getContainmentTheme(phase);
  ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.fieldOffsetY);
  drawStructuralPanels(ctx, theme, settings);
  drawMaterialDetails(ctx, theme, settings);

  const vignette = ctx.createRadialGradient(VIEWPORT.width / 2, 38, 90, VIEWPORT.width / 2, 38, VIEWPORT.width * 0.62);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.72, "rgba(0,0,0,.06)");
  vignette.addColorStop(1, "rgba(0,0,0,.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.fieldOffsetY);

  const topBevel = ctx.createLinearGradient(0, 0, 0, 7);
  topBevel.addColorStop(0, "rgba(226,232,240,.22)");
  topBevel.addColorStop(0.35, rgba(theme.primary, 0.15));
  topBevel.addColorStop(1, "transparent");
  ctx.fillStyle = topBevel;
  ctx.fillRect(0, 0, VIEWPORT.width, 8);
}

export function getContainmentStaticLayer(phase, settings = {}, surfaceFactory = createCacheCanvas) {
  const key = getContainmentCacheKey(phase, settings);
  if (staticContainmentCache.has(key)) return staticContainmentCache.get(key);
  const canvas = surfaceFactory();
  const context = canvas?.getContext?.("2d");
  if (context) renderStaticContainment(context, phase, settings);
  if (canvas) staticContainmentCache.set(key, canvas);
  return canvas;
}

export function getContainmentVisualState(session, runtime, now) {
  const intensities = session.phase.waveIntensity || [0.3, 0.55, 0.78, 1];
  const waveIntensity = intensities[Math.min(intensities.length - 1, Math.max(0, session.waveIndex))] ?? 1;
  const bossActive = session.enemies.some((enemy) => !enemy.dead && enemy.variant === "alpha");
  const dangerous = !session.preparing && waveIntensity >= 0.72;
  const interference = bossActive || now < (runtime.containmentInterferenceUntil || 0);
  const routeTelemetry = getRouteTelemetry(session);
  if (!runtime.routeTelemetryStates) runtime.routeTelemetryStates = routeTelemetry.map((route) => route.state);
  if (!runtime.routeTelemetryChangedAt) runtime.routeTelemetryChangedAt = Array(FIELD.rows).fill(-Infinity);
  routeTelemetry.forEach((route, row) => {
    if (runtime.routeTelemetryStates[row] !== route.state) {
      runtime.routeTelemetryStates[row] = route.state;
      runtime.routeTelemetryChangedAt[row] = now;
    }
  });
  const routeCharge = routeTelemetry.map((route, row) => (
    now - runtime.routeTelemetryChangedAt[row] < 600 ? 1 - (now - runtime.routeTelemetryChangedAt[row]) / 600 : 0
  ));
  const alertLevel = interference ? 1 : dangerous ? 0.68 : 0;
  const flowIntensity = clamp(0.22 + waveIntensity * 0.32 + alertLevel * 0.28, 0.2, 1);
  return { waveIntensity, bossActive, dangerous, interference, routeCharge, routeTelemetry, alertLevel, flowIntensity };
}

function drawEnergyRails(ctx, theme, state, now, settings) {
  const motionTime = settings.reduceMotion ? 0 : now;
  const alertColor = state.alertLevel ? "#f43f5e" : theme.primary;
  const railGlow = ctx.createLinearGradient(0, 0, VIEWPORT.width, 0);
  railGlow.addColorStop(0, "transparent");
  railGlow.addColorStop(0.1, rgba(alertColor, 0.18));
  railGlow.addColorStop(0.5, rgba(alertColor, 0.5 * state.flowIntensity));
  railGlow.addColorStop(0.9, rgba(alertColor, 0.18));
  railGlow.addColorStop(1, "transparent");
  ctx.fillStyle = railGlow;
  ctx.shadowBlur = settings.quality === "low" ? 3 : 9;
  ctx.shadowColor = alertColor;
  ctx.fillRect(0, 37, VIEWPORT.width, 1);
  ctx.fillRect(0, 68, VIEWPORT.width, 2);
  ctx.shadowBlur = 0;

  const packetCount = settings.quality === "low" ? 2 : settings.quality === "medium" ? 4 : 7;
  for (let index = 0; index < packetCount; index += 1) {
    const direction = index % 2 ? -1 : 1;
    const speed = 0.025 + index * 0.003;
    const raw = pseudo(index, theme.seed + 71) * VIEWPORT.width + motionTime * speed * direction;
    const x = ((raw % (VIEWPORT.width + 80)) + VIEWPORT.width + 80) % (VIEWPORT.width + 80) - 40;
    const y = index % 3 ? 68 : 37;
    const width = 11 + state.flowIntensity * 13;
    const packet = ctx.createLinearGradient(x - width, y, x + width, y);
    packet.addColorStop(0, "transparent");
    packet.addColorStop(0.55, rgba(alertColor, 0.72));
    packet.addColorStop(1, "transparent");
    ctx.fillStyle = packet;
    ctx.fillRect(x - width, y - 1, width * 2, 3);
  }
}

function drawRouteModule(ctx, x, row, theme, state, now, settings) {
  const charge = state.routeCharge[row];
  const route = state.routeTelemetry[row];
  const colors = {
    stable: theme.primary,
    attention: "#fbbf24",
    pressure: "#fb923c",
    critical: "#fb7185",
  };
  const labels = {
    stable: "ESTÁVEL",
    attention: "ATENÇÃO",
    pressure: "PRESSÃO",
    critical: "CRÍTICA",
  };
  const color = colors[route.state];
  const width = 204;
  const height = 48;
  const y = 27;

  ctx.save();
  ctx.shadowBlur = charge > 0 ? 15 * charge : 2;
  ctx.shadowColor = color;
  chamferedRect(ctx, x - width / 2, y, width, height, 4);
  const housing = ctx.createLinearGradient(0, y, 0, y + height);
  housing.addColorStop(0, "rgba(30,41,59,.98)");
  housing.addColorStop(0.28, rgba(theme.panelAlt, 0.9));
  housing.addColorStop(1, "rgba(1,6,12,.98)");
  ctx.fillStyle = housing;
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.3 + charge * 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(theme.primary, 0.96);
  ctx.font = "700 10px 'Chakra Petch', system-ui";
  ctx.fillText(`ROTA ${row + 1}`, x - width / 2 + 9, y + 10);
  ctx.textAlign = "right";
  ctx.fillStyle = color;
  ctx.fillText(labels[route.state], x + width / 2 - 9, y + 10);

  const details = [`${route.activeCount} CAMPO`];
  if (route.nearestThreat) details.push(`APROX ${route.nearestAdvance}%`);
  else if (route.imminentThreat) details.push(`${Math.ceil(route.imminentThreat.startsInMs / 1000)}s`);
  if (route.isAlpha) details.push("ALFA");
  else if (route.isBoss) details.push("CHEFE");
  if (route.fortified) details.push("FORT");
  if (route.environmentalDanger) details.push("AMBIENTE");
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(241,245,249,.92)";
  ctx.font = "600 8px 'Chakra Petch', system-ui";
  ctx.fillText(details.join(" · "), x - width / 2 + 9, y + 25, width - 18);

  const trackX = x - width / 2 + 9;
  const trackY = y + 35;
  const trackWidth = width - 18;
  ctx.fillStyle = "rgba(2,6,12,.9)";
  ctx.fillRect(trackX, trackY, trackWidth, 7);
  ctx.fillStyle = rgba(color, 0.92);
  ctx.fillRect(trackX, trackY, trackWidth * route.pressure / 100, 7);
  ctx.textAlign = "right";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 8px 'Chakra Petch', system-ui";
  ctx.fillText(`${route.pressure}%`, trackX + trackWidth - 3, trackY + 3.5);
  ctx.restore();
}

function drawConvoyRouteModule(ctx, x, theme, status, now, settings) {
  const width = 204; const height = 48; const y = 27;
  const color = status.status === "destroyed" || status.status === "underAttack" || status.status === "grappled" ? (status.critical ? "#ef4444" : "#fb7185") : status.status === "preparation" || status.status === "unescorted" ? "#fbbf24" : "#67e8f9";
  const sectorMarkers = status.sectorMarkers || [.28, .51, .74];
  ctx.save(); ctx.shadowBlur = status.underAttack ? 12 : 3; ctx.shadowColor = color;
  chamferedRect(ctx, x - width / 2, y, width, height, 4); ctx.fillStyle = "rgba(1,6,12,.98)"; ctx.fill();
  ctx.strokeStyle = rgba(color, status.underAttack || status.critical ? .9 : .55); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.textBaseline = "middle"; ctx.font = "700 9px 'Chakra Petch', system-ui"; ctx.textAlign = "left"; ctx.fillStyle = rgba(theme.primary, .96); ctx.fillText("ROTA 3 · TRANSPORTE", x - width / 2 + 8, y + 9);
  const labels = { ready: "PRONTO", entering: "ENTRANDO", starting: "INICIANDO", moving: "EM MOVIMENTO", underAttack: "SOB ATAQUE", grappled: "GARRAVINHA PRESA", checkpoint: "CHECKPOINT", preparation: "PREPARAÇÃO", destroyed: "DESTRUÍDO" };
  ctx.textAlign = "right"; ctx.fillStyle = color; ctx.fillText(labels[status.status] || "TRANSPORTE", x + width / 2 - 8, y + 9);
  ctx.textAlign = "left"; ctx.font = "600 8px 'Chakra Petch', system-ui"; ctx.fillStyle = status.critical ? "#fda4af" : "rgba(241,245,249,.92)";
  ctx.fillText(`🚚 ${status.hp}/${status.hpMax} · S${status.sector}/${status.sectorTotal} · CP${status.checkpointsReached}/${status.checkpointsTotal}`, x - width / 2 + 8, y + 22, width - 16);
  const trackX = x - width / 2 + 8; const trackY = y + 34; const trackWidth = width - 16;
  ctx.fillStyle = "rgba(2,6,12,.9)"; ctx.fillRect(trackX, trackY, trackWidth, 6); ctx.fillStyle = "#67e8f9"; ctx.fillRect(trackX, trackY, trackWidth * status.progress, 6);
  ctx.strokeStyle = "rgba(226,232,240,.72)"; ctx.lineWidth = 1;
  for (const checkpoint of sectorMarkers) { const markerX = trackX + trackWidth * checkpoint; const reached = status.progress >= checkpoint; ctx.fillStyle = reached ? "#67e8f9" : "#64748b"; ctx.beginPath(); ctx.moveTo(markerX, trackY - 2); ctx.lineTo(markerX + 3, trackY + 1); ctx.lineTo(markerX, trackY + 4); ctx.lineTo(markerX - 3, trackY + 1); ctx.closePath(); ctx.fill(); }
  const goalX = trackX + trackWidth; ctx.fillStyle = status.progress >= 1 ? "#a7f3d0" : "#cbd5e1"; ctx.fillRect(goalX - 1, trackY - 2, 2, 10);
  ctx.textAlign = "right"; ctx.fillStyle = "#f8fafc"; ctx.font = "700 8px 'Chakra Petch', system-ui"; ctx.fillText(`${status.progressPercent}%`, x + width / 2 - 8, trackY + 3); ctx.restore();
}

function drawAmbientParticles(ctx, theme, state, now, settings) {
  if (settings.quality === "low") return;
  const motionTime = settings.reduceMotion ? 0 : now;
  const count = settings.quality === "high" ? 10 : 5;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < count; index += 1) {
    const x = (pseudo(index, theme.seed + 91) * VIEWPORT.width + motionTime * (0.006 + index * 0.001)) % VIEWPORT.width;
    const y = 22 + pseudo(index, theme.seed + 92) * 42;
    const alpha = 0.08 + pseudo(index, 93) * 0.16 * state.flowIntensity;
    ctx.fillStyle = rgba(index % 3 ? theme.primary : theme.accent, alpha);
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + pseudo(index, 94) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawContainmentUnderlay(ctx, phase, session, runtime, now, settings = {}) {
  const state = getContainmentVisualState(session, runtime, now);
  const theme = getContainmentTheme(phase);
  const layer = getContainmentStaticLayer(phase, settings);
  if (layer) ctx.drawImage(layer, 0, 0);
  else renderStaticContainment(ctx, phase, settings);

  ctx.save();
  drawEnergyRails(ctx, theme, state, now, settings);
  drawAmbientParticles(ctx, theme, state, now, settings);
  const convoyStatus = getConvoyContainmentStatus(session);
  for (let row = 0; row < FIELD.rows; row += 1) {
    const x = VIEWPORT.width / FIELD.rows * (row + 0.5);
    if (convoyStatus && row === convoyStatus.row) drawConvoyRouteModule(ctx, x, theme, convoyStatus, now, settings);
    else drawRouteModule(ctx, x, row, theme, state, now, settings);
  }

  const scanY = settings.reduceMotion ? 31 : 23 + (now * 0.014 % 21);
  const scan = ctx.createLinearGradient(0, scanY - 4, 0, scanY + 4);
  scan.addColorStop(0, "transparent");
  scan.addColorStop(0.5, rgba(theme.primary, settings.quality === "low" ? 0.025 : 0.055));
  scan.addColorStop(1, "transparent");
  ctx.fillStyle = scan;
  ctx.fillRect(0, scanY - 4, VIEWPORT.width, 8);

  ctx.restore();
}

function drawElectricArc(ctx, arc, now, color, settings) {
  const progress = clamp((now - arc.born) / arc.life);
  const alpha = 1 - progress;
  const segments = settings.quality === "low" ? 4 : 9;
  const spread = arc.alpha ? 104 : 58;
  const centerX = clamp(arc.x, 28, VIEWPORT.width - 28);
  ctx.strokeStyle = rgba(color, alpha * (arc.alpha ? 0.98 : 0.82));
  ctx.lineWidth = arc.alpha ? 2.4 : 1.5;
  ctx.shadowBlur = settings.quality === "low" ? 4 : 14;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const x = centerX - spread / 2 + spread * ratio;
    const jitter = settings.reduceMotion ? 0 : Math.sin(index * 12.7 + now / 21 + arc.row * 5.3) * (index === 0 || index === segments ? 0 : 8);
    const y = 68 + jitter;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRouteShockwaves(ctx, runtime, theme, now, settings) {
  if (settings.reduceMotion) return;
  for (const arc of runtime.containmentArcs) {
    const progress = clamp((now - arc.born) / arc.life);
    if (progress > 0.62) continue;
    const x = 190 + clamp(arc.row, 0, FIELD.rows - 1) * 145;
    const radius = 7 + progress * 24;
    ctx.strokeStyle = rgba(arc.alpha ? "#fb7185" : theme.primary, (1 - progress / 0.62) * 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, 56, radius * 1.7, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawContainmentForeground(ctx, phase, session, runtime, now, settings = {}) {
  const state = getContainmentVisualState(session, runtime, now);
  const theme = getContainmentTheme(phase);
  const alertColor = state.alertLevel ? "#f43f5e" : theme.primary;
  const motionTime = settings.reduceMotion ? 0 : now;
  const pulse = settings.reduceMotion ? 0.5 : (Math.sin(motionTime / (state.interference ? 72 : 260)) + 1) / 2;

  ctx.save();
  const rail = ctx.createLinearGradient(0, 71, 0, 80);
  rail.addColorStop(0, "rgba(148,163,184,.32)");
  rail.addColorStop(0.16, "#1e293b");
  rail.addColorStop(0.48, "#060b12");
  rail.addColorStop(0.78, "#111827");
  rail.addColorStop(1, "rgba(0,0,0,.92)");
  ctx.fillStyle = rail;
  ctx.fillRect(0, 71, VIEWPORT.width, 9);
  ctx.fillStyle = rgba(alertColor, 0.28 + pulse * (state.alertLevel ? 0.55 : 0.2));
  ctx.shadowBlur = settings.quality === "low" ? 3 : 11;
  ctx.shadowColor = alertColor;
  ctx.fillRect(0, 72, VIEWPORT.width, 2);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(226,232,240,.16)";
  for (let x = 18; x < VIEWPORT.width; x += 72) ctx.fillRect(x, 76, 38, 1);
  drawRouteShockwaves(ctx, runtime, theme, now, settings);
  runtime.containmentArcs.forEach((arc) => drawElectricArc(ctx, arc, now, arc.alpha ? "#fb7185" : theme.primary, settings));

  if (state.alertLevel > 0) {
    const chaseCount = settings.quality === "low" ? 4 : 9;
    for (let index = 0; index < chaseCount; index += 1) {
      const x = settings.reduceMotion
        ? index * VIEWPORT.width / chaseCount
        : (index * 137 + motionTime * 0.085) % (VIEWPORT.width + 80) - 40;
      ctx.fillStyle = rgba("#fb7185", 0.16 + pulse * 0.38);
      ctx.fillRect(x, 72, 24, 2);
    }
  }

  if (state.interference && !settings.reduceMotion) {
    ctx.globalCompositeOperation = "screen";
    const glitchY = 7 + (Math.floor(now / 70) * 13 % 54);
    ctx.fillStyle = `rgba(34,211,238,${0.035 + pulse * 0.035})`;
    ctx.fillRect(5, glitchY, VIEWPORT.width - 10, 2);
    ctx.fillStyle = `rgba(244,63,94,${0.04 + pulse * 0.04})`;
    ctx.fillRect(-4, glitchY + 2, VIEWPORT.width, 1);
  }
  ctx.restore();
}
