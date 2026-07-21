import { ENEMIES, PHASES } from "./content.js";

const formatNumber = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const formatDuration = (milliseconds) => `${formatNumber(milliseconds / 1000)} s`;

export function getEnemyUnlockAt(enemyId, enemy = ENEMIES[enemyId]) {
  const phaseIndex = PHASES.findIndex((phase) => phase.waves.some((wave) => (
    wave.enemies.some((entry) => entry.type === enemyId)
  )));
  if (phaseIndex >= 0) return phaseIndex;
  return Number.isInteger(enemy?.encyclopediaUnlockAt) ? enemy.encyclopediaUnlockAt : -1;
}

export function getEnemyInfo(enemy) {
  const stats = [
    { label: "HP", value: formatNumber(enemy.hp) },
    { label: "Dano", value: formatNumber(enemy.damage) },
    { label: "Cadência", value: `A cada ${formatDuration(enemy.attackEveryMs)}` },
    { label: "Velocidade", value: `${formatNumber(enemy.speed)} px/s` },
    { label: "Dano à base", value: formatNumber(enemy.baseDamage) },
    { label: "Alcance", value: enemy.range ? `${formatNumber(enemy.range)} células` : "Corpo a corpo" },
  ];

  const specials = [];
  if (enemy.airborne) specials.push({ label: "Locomoção", value: "Unidade flutuante" });
  if (enemy.chargeMs) specials.push({ label: "Conjuração", value: `${formatDuration(enemy.chargeMs)} antes do disparo` });
  if (enemy.jumpDurationMs) specials.push({
    label: "Salto parasitário",
    value: `Salta em ${formatDuration(enemy.jumpDurationMs)} e se prende a uma tropa`,
  });
  if (enemy.attackSlowFactor != null) specials.push({
    label: "Interferência",
    value: `Reduz a velocidade de ataque da tropa em ${Math.round((1 - enemy.attackSlowFactor) * 100)}%`,
  });
  if (enemy.shieldPulseEveryMs) specials.push({
    label: "Manto prismático",
    value: `Renova escudos aliados a cada ${formatDuration(enemy.shieldPulseEveryMs)}`,
  });
  if (enemy.shieldBase) specials.push({
    label: "Escudo",
    value: `${enemy.shieldBase} base + ${Math.round(enemy.shieldMaxHpFactor * 100)}% do HP, limite ${enemy.shieldCap}`,
  });
  if (enemy.swarmMinCount && enemy.swarmSpeedFactor) specials.push({
    label: "Impulso de enxame",
    value: `Com ${enemy.swarmMinCount}+ no mesmo tile: +${Math.round((enemy.swarmSpeedFactor - 1) * 100)}% de velocidade`,
  });
  if (enemy.id === "duneRipper") specials.push({
    label: "Grito da Ninhada",
    value: `Até ${enemy.summonCount} Escavadores a cada ${formatDuration(enemy.summonEveryMs)}; máximo de ${enemy.maximumLivingSummons} vivos`,
  });
  if (enemy.chargeDamage) specials.push({
    label: "Investida inicial",
    value: `${formatNumber(enemy.chargeDamage)} de dano após ${formatDuration(enemy.chargePrepMs)}`,
  });
  if (enemy.recoverMs) specials.push({
    label: "Recuperação",
    value: `${formatDuration(enemy.recoverMs)} sem se mover ou atacar`,
  });
  if (enemy.id === "ramBeetle") specials.push({
    label: "Ataque normal",
    value: `${formatNumber(enemy.damage)} de dano a cada ${formatDuration(enemy.attackEveryMs)}`,
  });
  if (enemy.id === "scarabEmperor") {
    specials.push({
      label: "Metamorfose irreversível",
      value: `Fase 2 em ${Math.round(enemy.phase2Threshold * 100)}% de HP; fase 3 em ${Math.round(enemy.phase3Threshold * 100)}% de HP`,
    });
    specials.push({
      label: "Fase 1 · Carapaça Imperial",
      value: `${enemy.phase1.damage} de dano a cada ${formatDuration(enemy.phase1.attackEveryMs)}; reduz ${Math.round((1 - enemy.phase1.frontDamageFactor) * 100)}% do dano frontal`,
    });
    specials.push({
      label: "Fase 2 · Carapaça Rompida",
      value: `${enemy.phase2.damage} de dano a cada ${formatDuration(enemy.phase2.attackEveryMs)}; recebe ${Math.round((enemy.phase2.damageTakenFactor - 1) * 100)}% mais dano`,
    });
    specials.push({
      label: "Fase 3 · Predador Desencouraçado",
      value: `${enemy.phase3.damage} de dano a cada ${formatDuration(enemy.phase3.attackEveryMs)}; recebe ${Math.round((enemy.phase3.damageTakenFactor - 1) * 100)}% mais dano`,
    });
    specials.push({ label: "Imunidade", value: "Não pode ser deslocado por empurrões" });
  }
  if (enemy.id === "workerQueen") {
    specials.push({
      label: "Teia Inibidora",
      value: `${enemy.webDamage} de dano; reduz a cadência em ${Math.round((1 - enemy.webSlowFactor) * 100)}% por ${formatDuration(enemy.webSlowDurationMs)}`,
    });
    specials.push({
      label: "Postura de ovos",
      value: `${enemy.eggsPerLay} ovos a cada ${formatDuration(enemy.eggLayEveryMs)}; eclosão em ${formatDuration(ENEMIES.workerQueenEgg.hatchAfterMs)}`,
    });
    specials.push({
      label: "Limites da ninhada",
      value: `Até ${enemy.maximumLivingEggs} ovos e ${enemy.maximumLivingSummons} Escavadores vinculados`,
    });
    specials.push({
      label: "Mordida da Matriarca",
      value: `${enemy.meleeDamage} de dano a cada ${formatDuration(enemy.meleeAttackEveryMs)} no mesmo tile`,
    });
  }

  return { stats, specials };
}
