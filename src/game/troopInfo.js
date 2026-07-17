const ATTACK_LABELS = {
  melee: "Corpo a corpo",
  energy: "Geração de energia",
  bullet: "Projétil",
  none: "Não ataca",
  shotgun: "Escopeta",
  flame: "Jato contínuo",
  ice: "Projétil criogênico",
  laser: "Feixe de energia",
  missile: "Míssil em área",
  fireball: "Projétil incendiário",
  mine: "Armadilha magnética",
};

const formatNumber = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
const formatDuration = (milliseconds) => `${formatNumber(milliseconds / 1000)} s`;

export function getTroopInfo(troop) {
  const doesNotAttack = troop.attack === "none";
  const generatesEnergy = troop.attack === "energy";
  let damage = formatNumber(troop.damage);
  if (doesNotAttack || generatesEnergy) damage = "—";
  else if (troop.burst) damage = `${formatNumber(troop.damage)} por disparo`;
  else if (troop.pellets) damage = `${formatNumber(troop.damage)} por pellet`;
  else if (troop.attack === "flame") damage = `${formatNumber(troop.damage)} por tick`;

  const cadence = doesNotAttack
    ? "Não ataca"
    : generatesEnergy
      ? `${troop.energyPerPulse} energia a cada ${formatDuration(troop.attackEveryMs)}`
      : `A cada ${formatDuration(troop.attackEveryMs)}`;

  const stats = [
    { label: "HP", value: formatNumber(troop.hp) },
    { label: "Energia", value: formatNumber(troop.price) },
    { label: "Supply", value: formatNumber(troop.supply) },
    { label: "Alcance", value: troop.range > 0 ? `${formatNumber(troop.range)} células` : "—" },
    { label: "Ataque", value: ATTACK_LABELS[troop.attack] || troop.attack },
    { label: "Dano", value: damage },
    { label: "Cadência", value: cadence },
    { label: "Cooldown", value: formatDuration(troop.deployCooldownMs) },
  ];

  const specials = [];
  if (troop.burst) specials.push({ label: "Rajada", value: `${troop.burst} tiros · intervalo ${formatDuration(troop.burstIntervalMs)}` });
  if (troop.pellets) specials.push({ label: "Dispersão", value: `${troop.pellets} pellets por ataque` });
  if (troop.radius) specials.push({ label: "Área de impacto", value: `${troop.radius} px` });
  if (troop.slowFactor != null) specials.push({
    label: "Lentidão",
    value: `-${Math.round((1 - troop.slowFactor) * 100)}% por ${formatDuration(troop.slowMs)}`,
  });
  if (troop.maxDeployed) specials.push({ label: "Limite", value: `${troop.maxDeployed} simultâneos` });
  if (troop.waveEnergyBonus) specials.push({ label: "Bônus de onda", value: `+${troop.waveEnergyBonus} energia` });
  if (troop.maxActiveMines) specials.push({ label: "Campo minado", value: `Até ${troop.maxActiveMines} minas por Demolidora` });
  if (troop.closeDamage) specials.push({
    label: "Defesa próxima",
    value: `${formatNumber(troop.closeDamage)} de dano a cada ${formatDuration(troop.closeAttackEveryMs)} · ${formatNumber(troop.closeRange)} células`,
  });

  return { stats, specials };
}
