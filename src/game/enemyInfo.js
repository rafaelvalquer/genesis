import { PHASES } from "./content.js";

const formatNumber = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const formatDuration = (milliseconds) => `${formatNumber(milliseconds / 1000)} s`;

export function getEnemyUnlockAt(enemyId) {
  return PHASES.findIndex((phase) => phase.waves.some((wave) => (
    wave.enemies.some((entry) => entry.type === enemyId)
  )));
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

  return { stats, specials };
}
