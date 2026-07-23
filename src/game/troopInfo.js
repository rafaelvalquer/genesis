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
  mortar: "Morteiro indireto",
  fireball: "Projétil incendiário",
  mine: "Armadilha magnética",
  tileMelee: "Impacto no tile",
  arcCombo: "Combo corpo a corpo",
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
  else if (troop.attack === "arcCombo") {
    damage = `${formatNumber(troop.combo1Damage)} → ${formatNumber(troop.combo2Damage)} → ${formatNumber(troop.combo3Damage)}`;
  }

  const cadence = doesNotAttack
    ? "Não ataca"
    : generatesEnergy
      ? `${troop.energyPerPulse} energia a cada ${formatDuration(troop.attackEveryMs)}`
      : troop.attack === "arcCombo"
        ? `${formatDuration(troop.attackVisuals.combo1.recoveryMs)} / ${formatDuration(troop.attackVisuals.combo2.recoveryMs)} / ${formatDuration(troop.attackVisuals.combo3.recoveryMs)}`
        : `A cada ${formatDuration(troop.attackEveryMs)}`;

  const range = troop.minRange != null
    ? `${formatNumber(troop.minRange)}–${formatNumber(troop.range)} células`
    : troop.range > 0 ? `${formatNumber(troop.range)} células` : "—";
  const stats = [
    { label: "HP", value: formatNumber(troop.hp) },
    { label: "Energia", value: formatNumber(troop.price) },
    { label: "Supply", value: formatNumber(troop.supply) },
    { label: "Alcance", value: range },
    { label: "Ataque", value: ATTACK_LABELS[troop.attack] || troop.attack },
    { label: "Dano", value: damage },
    { label: "Cadência", value: cadence },
    { label: "Cooldown", value: formatDuration(troop.deployCooldownMs) },
  ];

  const specials = [];
  if (troop.burst) specials.push({ label: "Rajada", value: `${troop.burst} tiros · intervalo ${formatDuration(troop.burstIntervalMs)}` });
  if (troop.pellets) specials.push({ label: "Dispersão", value: `${troop.pellets} pellets por ataque` });
  if (troop.shotgunMaxTargets && troop.shotgunDamageFactors) specials.push({
    label: "Cone da escopeta",
    value: `${troop.shotgunMaxTargets} alvos · dano ${troop.shotgunDamageFactors
      .slice(0, troop.shotgunMaxTargets)
      .map((factor) => formatNumber(troop.damage * troop.pellets * factor))
      .join(" / ")}`,
  });
  if (troop.flameMaxTargets) specials.push({ label: "Canalização", value: `Até ${troop.flameMaxTargets} alvos simultâneos` });
  if (troop.radius) specials.push({ label: "Área de impacto", value: `${troop.radius} px` });
  if (troop.collateralMultiplier != null) specials.push({
    label: "Dano colateral",
    value: `${Math.round(troop.collateralMultiplier * 100)}% nos demais inimigos do tile`,
  });
  if (troop.combo3CollateralFactor != null) specials.push({
    label: "Finalização",
    value: `${Math.round(troop.combo3CollateralFactor * 100)}% nos demais inimigos do mesmo tile`,
  });
  if (troop.comboWindowMs != null) specials.push({
    label: "Janela do combo",
    value: formatDuration(troop.comboWindowMs),
  });
  if (troop.rangedRange != null && troop.rangedDamage != null) specials.push({
    label: "Corte de Arco",
    value: `${formatNumber(troop.rangedDamage)} de dano a até ${formatNumber(troop.rangedRange)} células · alvo único terrestre`,
  });
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

  if (troop.specialDamage) specials.push({
    label: "Esmagamento Total",
    value: `${formatNumber(troop.specialDamage)} de dano em area no tile · atordoa por ${formatDuration(troop.specialStunMs)} · recarga ${formatDuration(troop.specialEveryMs)}`,
  });
  return { stats, specials };
}
