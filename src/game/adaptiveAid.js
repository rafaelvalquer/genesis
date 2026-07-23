import { ENEMIES, TROOPS } from "./content.js";
import { CELL, FIELD } from "./visualGeometry.js";

export const ADAPTIVE_AID_EVALUATION_MS = 1000;
export const ADAPTIVE_AID_DIFFICULT_HOLD_MS = 2000;
export const ADAPTIVE_AID_LOSS_WINDOW_MS = 30000;

export function createAdaptiveAidState(enabled = true) {
  return {
    enabled,
    status: "idle",
    triggered: false,
    used: false,
    hardshipScore: 0,
    lastEvaluationAt: -Infinity,
    dangerSince: null,
    availableOptions: [],
    selectedOptionId: null,
    triggerWave: null,
    triggerTier: null,
    capsule: null,
    pendingTarget: null,
    battleNotice: null,
  };
}

export function recordTroopLoss(session, troop, cause = "enemy") {
  if (!session?.recentTroopLosses || !troop) return;
  session.recentTroopLosses.push({
    troopId: troop.id,
    troopType: troop.type,
    row: troop.row,
    col: troop.col,
    maxHp: troop.maxHp,
    energyCost: troop.energyCost,
    supplyCost: troop.supplyCost,
    at: session.elapsed,
    cause,
    entity: { ...troop },
  });
}

export function clearExpiredTroopLosses(session) {
  session.recentTroopLosses = (session.recentTroopLosses || [])
    .filter((loss) => session.elapsed - loss.at <= ADAPTIVE_AID_LOSS_WINDOW_MS);
}

function livingEnemies(session) {
  return session.enemies.filter((enemy) => !enemy.dead);
}

function activeTroops(session) {
  return session.troops.filter((troop) => !troop.dead);
}

export function calculateHardshipScore(session) {
  let score = 0;
  const integrityRatio = session.integrityMax > 0 ? session.integrity / session.integrityMax : 1;
  if (integrityRatio <= 0.5) score += 1;
  if (integrityRatio <= 0.3) score += 2;

  const enemyLosses = (session.recentTroopLosses || []).filter((loss) => loss.cause === "enemy").length;
  if (enemyLosses >= 4) score += 2;
  else if (enemyLosses >= 2) score += 1;

  const enemies = livingEnemies(session);
  const nearBase = enemies.filter((enemy) => enemy.x <= FIELD.baseX + CELL.width * 3).length;
  if (nearBase >= 7) score += 2;
  else if (nearBase >= 4) score += 1;

  const threatenedRows = [...new Set(enemies
    .filter((enemy) => enemy.x <= FIELD.width * 0.5)
    .map((enemy) => enemy.row))];
  const defendedRows = new Set(activeTroops(session).map((troop) => troop.row));
  if (threatenedRows.length >= 2 && threatenedRows.every((row) => !defendedRows.has(row))) score += 1;

  const energyRatio = session.energyMax > 0 ? session.energy / session.energyMax : 1;
  const batteryFactor = session.efficientBatteryCharges > 0 ? 0.8 : 1;
  const contractFactor = session.emergencyContractCharges > 0 ? 0.5 : 1;
  const costFactor = session.modifiers?.energyCost ?? 1;
  const cheapest = session.loadout.reduce((minimum, troopId) => Math.min(
    minimum,
    Math.ceil((TROOPS[troopId]?.price ?? Infinity) * costFactor * batteryFactor * contractFactor),
  ), Infinity);
  if (enemies.length && energyRatio < 0.15 && session.energy < cheapest) score += 1;

  const estimatedWaveMs = Math.max(15000, Number(session.phase.targetDurationMs || 0) / Math.max(1, session.phase.waves.length));
  if (session.waveActive && session.elapsed - session.waveStartedAt > estimatedWaveMs * 1.3) score += 1;
  return Math.min(score, 8);
}

function capsuleCellIsFree(session, row, col) {
  if (activeTroops(session).some((troop) => troop.row === row && troop.col === col)) return false;
  if (session.mines.some((mine) => mine.active && mine.row === row && mine.col === col)) return false;
  if (session.projectiles.some((entry) => entry.active && entry.kind === "mine" && entry.targetRow === row && entry.targetCol === col)) return false;
  return !livingEnemies(session).some((enemy) => enemy.row === row
    && enemy.x >= col * CELL.width && enemy.x < (col + 1) * CELL.width);
}

export function findCapsuleLandingCell(session) {
  const candidates = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = FIELD.firstTroopCol; col <= FIELD.lastTroopCol; col += 1) {
      if (!capsuleCellIsFree(session, row, col)) continue;
      const nearby = livingEnemies(session).filter((enemy) => Math.abs(enemy.row - row) <= 1
        && Math.abs(enemy.x - (col + 0.5) * CELL.width) <= CELL.width * 2).length;
      const rowPressure = livingEnemies(session).filter((enemy) => enemy.row === row).length;
      const centrality = Math.abs(row - (FIELD.rows - 1) / 2);
      candidates.push({ row, col, safety: 100 - col * 5 - nearby * 10 - rowPressure * 3 - centrality });
    }
  }
  return candidates.sort((left, right) => right.safety - left.safety)[0]
    || { row: Math.floor(FIELD.rows / 2), col: Math.max(0, FIELD.firstTroopCol - 1), fallback: true };
}

function hasActiveCooldown(session) {
  return Object.values(session.deployCooldowns).some((until) => until > session.elapsed);
}

function hasWoundedTroops(session) {
  return activeTroops(session).some((troop) => troop.hp < troop.maxHp * 0.95);
}

function eligibleReconstructionLosses(session) {
  const activeByType = new Map();
  activeTroops(session).forEach((troop) => activeByType.set(troop.type, (activeByType.get(troop.type) || 0) + 1));
  return [...(session.recentTroopLosses || [])]
    .filter((loss) => loss.cause === "enemy" && session.elapsed - loss.at <= ADAPTIVE_AID_LOSS_WINDOW_MS && TROOPS[loss.troopType]
      && (activeByType.get(loss.troopType) || 0) < (TROOPS[loss.troopType].maxDeployed ?? 5))
    .sort((left, right) => right.at - left.at);
}

export const ADAPTIVE_AID_OPTIONS = Object.freeze([
  { id: "energy_reserve", rarity: "common", label: "Reserva energética", description: "+20 de energia.", isEligible: (s) => s.energyMax - s.energy >= 5 },
  { id: "contingency_repairs", rarity: "common", label: "Reparos de contingência", description: "+15 de integridade.", isEligible: (s) => s.integrity < s.integrityMax },
  { id: "logistics_sync", rarity: "common", label: "Sincronização logística", description: "Finaliza os cooldowns de implantação.", isEligible: hasActiveCooldown },
  { id: "free_reinforcement", rarity: "rare", label: "Reforço gratuito", description: "A próxima tropa não custa energia.", isEligible: () => true },
  { id: "core_barrier", rarity: "rare", label: "Barreira do núcleo", description: "Bloqueia os próximos dois invasores.", isEligible: () => true },
  { id: "maintenance_drone", rarity: "rare", label: "Drone de manutenção", description: "Recupera 25% do HP perdido das tropas vivas.", isEligible: hasWoundedTroops },
  { id: "containment_pulse", rarity: "rare", label: "Pulso de contenção", description: "Paralisa hostis; Alfas resistem parcialmente e chefes são imunes.", isEligible: (s) => livingEnemies(s).some((enemy) => !ENEMIES[enemy.type]?.boss) },
  { id: "emergency_orbital", rarity: "epic", label: "Ataque orbital de emergência", description: "Escolha uma rota. Hostis recebem dano proporcional.", requiresTarget: true, isEligible: (s) => livingEnemies(s).length > 0 },
  { id: "combat_reconstruction", rarity: "epic", label: "Reconstrução de combate", description: "Reconstrói até duas tropas destruídas por inimigos.", isEligible: (s) => eligibleReconstructionLosses(s).length > 0 },
]);

export function getEligibleAdaptiveAidOptions(session, tier) {
  const rarities = tier === "difficult" ? ["common", "rare"] : ["rare", "epic"];
  return ADAPTIVE_AID_OPTIONS.filter((option) => rarities.includes(option.rarity) && option.isEligible(session));
}

function rarityWeights(tier, score) {
  if (tier === "difficult") return { common: 0.65, rare: 0.35 };
  return score >= 6 ? { rare: 0.4, epic: 0.6 } : { rare: 0.65, epic: 0.35 };
}

function selectOptions(session, tier) {
  const available = getEligibleAdaptiveAidOptions(session, tier);
  if (available.length < 2) return [];
  const selected = [];
  const weights = rarityWeights(tier, session.adaptiveAid.hardshipScore);
  while (selected.length < 2) {
    const remaining = available.filter((option) => !selected.includes(option));
    const roll = session.rng();
    const preferredRarity = roll < (weights.common || 0) ? "common"
      : roll < (weights.common || 0) + (weights.rare || 0) ? "rare" : "epic";
    const pool = remaining.filter((option) => option.rarity === preferredRarity);
    const candidates = pool.length ? pool : remaining;
    selected.push(candidates[Math.floor(session.rng() * candidates.length)]);
  }
  return selected.map(({ isEligible, ...option }) => ({ ...option }));
}

function triggerFortuneEvent(session, events, tier) {
  if (session.adaptiveAid.triggered) return { ok: false, reason: "A ajuda já foi acionada nesta batalha." };
  const options = selectOptions(session, tier);
  if (options.length < 2) return { ok: false, reason: "Não há duas recompensas úteis para este cenário." };
  const landing = findCapsuleLandingCell(session);
  const landingX = landing.col * CELL.width + CELL.width / 2;
  const landingY = landing.row * CELL.height + CELL.height / 2;
  const aid = session.adaptiveAid;
  aid.triggered = true;
  aid.status = "incoming";
  aid.triggerWave = session.waveIndex + 1;
  aid.triggerTier = tier;
  aid.availableOptions = options;
  aid.battleNotice = {
    type: "fortune",
    title: "OPORTUNIDADE TÁTICA",
    message: "Transmissão aliada interceptada. Recursos de emergência disponíveis.",
    until: session.elapsed + 5000,
  };
  aid.capsule = {
    id: `colony_capsule_${session.effectSequence++}`,
    row: landing.row,
    col: landing.col,
    fallback: Boolean(landing.fallback),
    startX: FIELD.width + 160,
    startY: -180,
    controlX: FIELD.width * 0.58,
    controlY: -120,
    landingX,
    landingY,
    x: FIELD.width + 160,
    y: -180,
    state: "falling",
    stateStartedAt: session.elapsed,
    stateEndsAt: session.elapsed + 900,
  };
  session.assistanceTriggered = true;
  events.push({ type: "adaptiveAidTriggered", tier, options });
  events.push({ type: "capsuleIncoming", x: landingX, y: landingY, row: landing.row, col: landing.col, color: "#fbbf24" });
  return { ok: true, tier, options };
}

export function simulateAdaptiveAid(session, tier, events = []) {
  if (!session.sandbox) return { ok: false, reason: "A simulação está disponível apenas no Campo de Provas." };
  if (!['difficult', 'critical'].includes(tier)) return { ok: false, reason: "Nível de ajuda inválido." };
  session.adaptiveAid.hardshipScore = tier === "critical" ? 6 : 3;
  return triggerFortuneEvent(session, events, tier);
}

export function updateAdaptiveAid(session, events = []) {
  const aid = session.adaptiveAid;
  if (!aid) return;
  if (aid.status === "incoming" && session.elapsed >= aid.capsule.stateEndsAt) {
    aid.status = "landed";
    Object.assign(aid.capsule, { state: "idle", x: aid.capsule.landingX, y: aid.capsule.landingY, stateStartedAt: session.elapsed, stateEndsAt: Infinity });
    events.push({ type: "capsuleLanded", x: aid.capsule.x, y: aid.capsule.y, row: aid.capsule.row, col: aid.capsule.col, color: "#fbbf24", shake: 5 });
  } else if (aid.status === "opening" && session.elapsed >= aid.capsule.stateEndsAt) {
    events.push({ type: "capsuleOpened", x: aid.capsule.x, y: aid.capsule.y, color: "#fbbf24" });
    aid.capsule = null;
    aid.status = "choosing";
  }

  if (!aid.enabled || session.sandbox || !session.waveActive || session.outcome || aid.triggered) return;
  if (session.elapsed - aid.lastEvaluationAt < ADAPTIVE_AID_EVALUATION_MS) return;
  aid.lastEvaluationAt = session.elapsed;
  const progress = (session.waveIndex + 1) / Math.max(1, session.phase.waves.length);
  if (progress < 0.5) return;
  clearExpiredTroopLosses(session);
  const score = calculateHardshipScore(session);
  aid.hardshipScore = score;
  if (score >= 5) {
    triggerFortuneEvent(session, events, "critical");
  } else if (score >= 3) {
    if (aid.dangerSince == null) aid.dangerSince = session.elapsed;
    if (session.elapsed - aid.dangerSince >= ADAPTIVE_AID_DIFFICULT_HOLD_MS) triggerFortuneEvent(session, events, "difficult");
  } else {
    aid.dangerSince = null;
  }
}

export function isCapsuleClickable(session) {
  return session.adaptiveAid?.status === "landed" && Boolean(session.adaptiveAid.capsule);
}

export function pointHitsCapsule(capsule, point) {
  if (!capsule || !point) return false;
  return Math.hypot(point.x - capsule.x, point.y - capsule.y) <= Math.min(CELL.width, CELL.height) * 0.48;
}

export function openAdaptiveAidCapsule(session, events = []) {
  if (!isCapsuleClickable(session)) return { ok: false, reason: "A cápsula ainda não pode ser aberta." };
  const capsule = session.adaptiveAid.capsule;
  capsule.state = "opening";
  capsule.stateStartedAt = session.elapsed;
  capsule.stateEndsAt = session.elapsed + 800;
  session.adaptiveAid.status = "opening";
  events.push({ type: "capsuleOpening", x: capsule.x, y: capsule.y, color: "#fbbf24" });
  return { ok: true };
}

function nearestFreeCell(session, row, col) {
  const cells = [];
  for (let r = 0; r < FIELD.rows; r += 1) {
    for (let c = FIELD.firstTroopCol; c <= FIELD.lastTroopCol; c += 1) {
      if (capsuleCellIsFree(session, r, c)) cells.push({ row: r, col: c, distance: Math.abs(r - row) + Math.abs(c - col) });
    }
  }
  return cells.sort((a, b) => a.distance - b.distance)[0] || null;
}

function reconstructTroops(session, events) {
  const losses = eligibleReconstructionLosses(session).slice(0, 2);
  const restored = [];
  for (const loss of losses) {
    const limit = TROOPS[loss.troopType].maxDeployed ?? 5;
    if (activeTroops(session).filter((troop) => troop.type === loss.troopType).length >= limit) continue;
    const cell = capsuleCellIsFree(session, loss.row, loss.col) ? { row: loss.row, col: loss.col } : nearestFreeCell(session, loss.row, loss.col);
    if (!cell) continue;
    const source = loss.entity || {};
    const troop = {
      ...source,
      id: `fortune_reconstructed_${session.effectSequence++}`,
      type: loss.troopType,
      row: cell.row,
      col: cell.col,
      x: cell.col * CELL.width + CELL.width / 2,
      y: cell.row * CELL.height + CELL.height / 2,
      previousRenderX: cell.col * CELL.width + CELL.width / 2,
      previousRenderY: cell.row * CELL.height + CELL.height / 2,
      hp: loss.maxHp * 0.5,
      maxHp: loss.maxHp,
      dead: false,
      state: "idle",
      stateStartedAt: session.elapsed,
      attackReadyAt: session.elapsed,
      pendingImpact: null,
      pendingRepulsorShot: null,
      attachedParasiteId: null,
    };
    session.troops.push(troop);
    restored.push(troop.id);
    events.push({ type: "fortuneReconstruction", x: troop.x, y: troop.y, troopId: troop.id, color: "#fbbf24" });
  }
  return restored.length > 0;
}

function resolveAid(session, option, events) {
  const aid = session.adaptiveAid;
  aid.selectedOptionId = option.id;
  aid.status = "resolved";
  aid.used = true;
  aid.pendingTarget = null;
  session.assistanceUsed = true;
  events.push({ type: "adaptiveAidSelected", optionId: option.id, rarity: option.rarity });
}

export function selectAdaptiveAidOption(session, optionId, target = null, events = [], adapters = {}) {
  const aid = session.adaptiveAid;
  const option = aid?.availableOptions.find((entry) => entry.id === optionId);
  if (!option || !["choosing", "targeting"].includes(aid.status)) return { ok: false, reason: "Recompensa indisponível." };
  if (option.id === "emergency_orbital" && target?.row == null) {
    aid.status = "targeting";
    aid.pendingTarget = option.id;
    return { ok: true, targeting: true };
  }
  let applied = true;
  if (option.id === "energy_reserve") session.energy = Math.min(session.energyMax, session.energy + 20);
  else if (option.id === "contingency_repairs") session.integrity = Math.min(session.integrityMax, session.integrity + 15);
  else if (option.id === "logistics_sync") Object.keys(session.deployCooldowns).forEach((id) => { session.deployCooldowns[id] = session.elapsed; });
  else if (option.id === "free_reinforcement") session.fortuneFreeDeploymentCharges += 1;
  else if (option.id === "core_barrier") session.shieldCharges += 2;
  else if (option.id === "maintenance_drone") activeTroops(session).forEach((troop) => { troop.hp = Math.min(troop.maxHp, troop.hp + (troop.maxHp - troop.hp) * 0.25); });
  else if (option.id === "containment_pulse") livingEnemies(session).forEach((enemy) => {
    if (ENEMIES[enemy.type]?.boss) return;
    adapters.stunEnemy?.(session, enemy, enemy.variant === "alpha" ? 500 : 2000);
  });
  else if (option.id === "emergency_orbital") {
    const row = Number(target.row);
    if (!Number.isInteger(row) || row < 0 || row >= FIELD.rows) return { ok: false, reason: "Rota inválida." };
    livingEnemies(session).filter((enemy) => enemy.row === row).forEach((enemy) => {
      const config = ENEMIES[enemy.type] || {};
      const elite = config.elite || /elite|resistente/i.test(config.role || "");
      const ratio = config.boss ? 0.05 : enemy.variant === "alpha" ? 0.1 : elite ? 0.25 : 0.5;
      adapters.damageEnemy?.(session, enemy, enemy.maxHp * ratio, events, { fortuneOrbital: true });
    });
    events.push({ type: "fortuneOrbitalStrike", row, color: "#fbbf24" });
  } else if (option.id === "combat_reconstruction") applied = reconstructTroops(session, events);
  else applied = false;
  if (!applied) return { ok: false, reason: "Não foi possível aplicar a recompensa." };
  resolveAid(session, option, events);
  events.push({
    type: `fortune${option.id.replace(/(^|_)(\w)/g, (_, __, letter) => letter.toUpperCase())}`,
    optionId: option.id,
    x: FIELD.baseX,
    y: FIELD.height / 2,
    color: "#fbbf24",
  });
  return { ok: true, option };
}

export function adaptiveAidCinematicFactor(session) {
  const aid = session.adaptiveAid;
  if (!aid) return 1;
  if (aid.status === "incoming") return aid.capsule?.stateEndsAt - session.elapsed <= 250 ? 0.25 : 0.35;
  if (aid.status === "opening") return 0.5;
  return 1;
}

export function capsuleReservesCell(session, row, col) {
  const aid = session.adaptiveAid;
  return Boolean(aid?.capsule && aid.status !== "resolved" && aid.capsule.row === row && aid.capsule.col === col);
}
