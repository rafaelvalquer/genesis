const text = (value) => (
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
);

const hasAny = (
  value,
  fragments,
) => {
  const normalized = text(value);
  return fragments.some(
    (fragment) => normalized.includes(fragment),
  );
};

export function getTroopTags(
  config = {},
) {
  const role = text(config.role);
  const title = text(config.title);
  const description = text(
    config.description,
  );

  const combined = [
    role,
    title,
    description,
  ].join(" ");

  const tags = new Set();

  if (
    config.attack === "energy"
    || Number(config.energyPerPulse) > 0
    || hasAny(combined, [
      "economia",
      "energia",
      "reator",
      "gerador",
    ])
  ) {
    tags.add("economy");
  }

  const hp = Number(config.hp) || 0;
  const range = Number(config.range) || 0;

  if (
    range <= 1.25
    || hp >= 55
    || hasAny(combined, [
      "linha de frente",
      "frontline",
      "defesa",
      "muralha",
      "tanque",
      "barreira",
      "bastiao",
    ])
  ) {
    tags.add("frontline");
  }

  if (
    range >= 2
    && config.attack !== "energy"
    && config.attack !== "none"
  ) {
    tags.add("offense");
  }

  if (
    range >= 4
    || hasAny(combined, [
      "longo alcance",
      "precisao",
      "artilharia",
      "sniper",
      "morteiro",
    ])
  ) {
    tags.add("ranged");
  }

  if (
    config.canTargetAir
    || Number(config.airborneDamageFactor) > 1
    || hasAny(combined, [
      "antiaereo",
      "anti-aereo",
      "aereo",
      "interceptador",
    ])
  ) {
    tags.add("antiAir");
  }

  if (
    Number(config.radius) > 0
    || Number(config.explosionRadius) > 0
    || Number(config.burst) > 1
    || Number(config.burstCount) > 1
    || hasAny(combined, [
      "area",
      "explos",
      "morteiro",
      "mina",
      "multiplos",
    ])
    || [
      "mine",
      "mortar",
      "explosive",
      "bomb",
    ].some((fragment) => (
      text(config.attack).includes(fragment)
    ))
  ) {
    tags.add("area");
  }

  if (
    Number(config.slowFactor) > 0
    || Number(config.stunMs) > 0
    || Number(config.knockback) > 0
    || hasAny(combined, [
      "controle",
      "lentidao",
      "congel",
      "paralis",
      "repuls",
      "atordo",
    ])
  ) {
    tags.add("control");
  }

  if (
    config.healEveryMs
    || config.healAmount
    || config.healRangeTiles
    || hasAny(combined, [
      "suporte",
      "cura",
      "medica",
      "nanite",
      "escudo",
    ])
  ) {
    tags.add("support");
  }

  if (
    config.attack === "mine"
    || hasAny(combined, [
      "armadilha",
      "mina",
      "preparacao",
    ])
  ) {
    tags.add("trap");
  }

  if (
    config.amphibious
    || config.canDeployInFloodedCells
    || config.canDeployInDeepWater
    || hasAny(combined, [
      "anfib",
      "mare",
      "agua",
      "aquatic",
    ])
  ) {
    tags.add("amphibious");
  }

  if (
    Number(config.windResistance) > 0
    || hasAny(combined, [
      "vento",
      "ancor",
      "pesado",
    ])
  ) {
    tags.add("windResistant");
  }

  if (
    Number(config.specialEveryMs) > 0
    || config.special
  ) {
    tags.add("special");
  }

  if (!tags.size) {
    tags.add("utility");
  }

  return tags;
}

export function estimateTroopDps(
  config = {},
) {
  const damage = Number(config.damage) || 0;

  const shots = Math.max(
    1,
    Number(config.burst)
      || Number(config.burstCount)
      || Number(config.visualCount)
      || 1,
  );

  const interval = Math.max(
    250,
    Number(config.attackEveryMs)
      || Number(config.closeAttackEveryMs)
      || 1000,
  );

  let dps = (
    damage
    * shots
    * 1000
    / interval
  );

  if (
    config.attack === "energy"
    || config.attack === "none"
  ) {
    dps = 0;
  }

  if (Number(config.radius) > 0) {
    dps *= 1.25;
  }

  return dps;
}

export function estimateTroopEfficiency(
  config = {},
) {
  const dps = estimateTroopDps(config);
  const hp = Number(config.hp) || 0;
  const price = Math.max(
    1,
    Number(config.price) || 1,
  );
  const supply = Math.max(
    1,
    Number(config.supply) || 1,
  );
  const range = Number(config.range) || 0;

  return (
    dps * 2.3
    + hp * .36
    + range * 2.5
  ) / (
    price * .72
    + supply * 1.4
  );
}

export function troopHasTag(
  config,
  tag,
) {
  return getTroopTags(config).has(tag);
}
