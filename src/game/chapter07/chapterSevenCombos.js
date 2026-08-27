import { CHAPTER_SEVEN_ENEMIES } from "../chapterSevenEnemies.js";
import { deepFreeze } from "../deepFreeze.js";

export const CHAPTER_SEVEN_INTENTS = Object.freeze({
  PRESSURE: "pressure",
  SWARM: "swarm",
  CONTROL: "control",
  BREACH: "breach",
  ARTILLERY: "artillery",
  FLANK: "flank",
  INFILTRATION: "infiltration",
  ESCORT_HUNTER: "escortHunter",
  CONVOY_ATTACK: "convoyAttack",
  SIEGE: "siege",
  FINISHER: "finisher",
});

const unit = (type, count, delayMs = 0, intervalMs = 220, extra = {}) => ({
  type, count, delayMs, intervalMs, ...extra,
});

const combo = (id, name, intents, units, routeProfile, cooldownMs, constraints = {}, flags = {}) => ({
  id, name, intents, units, routeProfile, cooldownMs,
  constraints: { maxConsecutive: 2, maxUsesPerSector: null, ...constraints },
  flags: { heavy: false, control: false, convoyAttack: false, finisher: false, ...flags },
});

export const CHAPTER_SEVEN_COMBOS = deepFreeze({
  "C7-01": combo("C7-01", "Matilha Ferrívora", ["pressure"], [unit("rastejanteMata", 3, 0, 250)], "focusedInner", 10000),
  "C7-02": combo("C7-02", "Enxame de Raiz-Ferro", ["swarm"], [unit("larvaRaizFerro", 7)], "spread", 14000),
  "C7-03": combo("C7-03", "Escolta Vulnerável", ["pressure", "infiltration"], [unit("rastejanteMata", 2, 0, 250), unit("saltadorAlado", 1, 600)], "weakEscort", 20000),
  "C7-04": combo("C7-04", "Esporos na Matilha", ["pressure", "control"], [unit("rastejanteMata", 2, 0, 250), unit("macacoEsporos", 1, 700)], "focusedInner", 22000, {}, { control: true }),
  "C7-05": combo("C7-05", "Garravinha de Cerco", ["convoyAttack", "infiltration"], [unit("larvaRaizFerro", 6), unit("garravinha", 1, 700)], "convoyPressure", 30000, {}, { convoyAttack: true }),
  "C7-06": combo("C7-06", "Ruptura de Casco", ["breach", "pressure"], [unit("tartaragarra", 1), unit("rastejanteMata", 3, 500, 250)], "breachLane", 32000, {}, { heavy: true }),
  "C7-07": combo("C7-07", "Ruptura com Infiltração", ["breach", "infiltration"], [unit("tartaragarra", 1), unit("rastejanteMata", 2, 400, 250), unit("saltadorAlado", 1, 1100)], "weakEscort", 40000, {}, { heavy: true }),
  "C7-08": combo("C7-08", "Bateria da Mata", ["artillery", "breach"], [unit("tartaragarra", 1), unit("dardifago", 1, 600)], "outerArtillery", 35000, {}, { heavy: true }),
  "C7-09": combo("C7-09", "Cerco de Esporos", ["siege", "artillery", "control"], [unit("tartaragarra", 1), unit("dardifago", 1, 600), unit("macacoEsporos", 1, 1100)], "siege", 55000, {}, { heavy: true, control: true }),
  "C7-10": combo("C7-10", "Garravinha Blindada", ["breach", "convoyAttack"], [unit("tartaragarra", 1), unit("garravinha", 1, 700)], "convoyPressure", 40000, {}, { heavy: true, convoyAttack: true }),
  "C7-11": combo("C7-11", "Enxame de Cerco", ["swarm", "convoyAttack", "siege"], [unit("larvaRaizFerro", 6), unit("garravinha", 2, 700)], "splitConvoy", 60000, {}, { heavy: true, convoyAttack: true }),
  "C7-12": combo("C7-12", "Controle da Escolta", ["control", "convoyAttack"], [unit("rastejanteMata", 2, 0, 250), unit("macacoEsporos", 1, 700), unit("garravinha", 1, 1100)], "controlConvoy", 38000, {}, { control: true, convoyAttack: true }),
  "C7-13": combo("C7-13", "Fogo Cruzado", ["artillery", "flank"], [unit("dardifago", 2, 0, 250), unit("rastejanteMata", 2, 500, 250)], "crossfire", 45000),
  "C7-14": combo("C7-14", "Escolta Dividida", ["infiltration", "control"], [unit("saltadorAlado", 2, 0, 250), unit("macacoEsporos", 1, 700)], "splitEscort", 40000, {}, { control: true }),
  "C7-15": combo("C7-15", "Colapso de Linha", ["breach", "control", "infiltration"], [unit("tartaragarra", 1), unit("rastejanteMata", 2, 400, 250), unit("macacoEsporos", 1, 900), unit("saltadorAlado", 1, 1500)], "collapse", 60000, {}, { heavy: true, control: true }),
  "C7-16": combo("C7-16", "Cerco Final da Colônia", ["siege", "breach", "artillery", "finisher"], [unit("larvaRaizFerro", 4), unit("tartaragarra", 1, 500), unit("macacoEsporos", 1, 1000), unit("dardifago", 1, 1500), unit("garravinha", 1, 2000)], "finalSiege", 90000, { maxUsesPerSector: 1 }, { heavy: true, control: true, convoyAttack: true, finisher: true }),
});

export const CHAPTER_SEVEN_COMBO_POOLS = deepFreeze({
  fase_49: ["C7-01"],
  fase_50: ["C7-01", "C7-02", "C7-03"],
  fase_51: ["C7-01", "C7-02", "C7-04"],
  fase_52: ["C7-01", "C7-02", "C7-04", "C7-05", "C7-12"],
  fase_53: ["C7-01", "C7-02", "C7-04", "C7-05", "C7-06", "C7-10", "C7-12"],
  fase_54: ["C7-02", "C7-05", "C7-08", "C7-10", "C7-14"],
  fase_55: ["C7-01", "C7-02", "C7-03", "C7-04", "C7-05", "C7-06", "C7-07", "C7-08", "C7-09", "C7-10", "C7-11", "C7-12", "C7-13", "C7-14", "C7-15"],
  fase_56: ["C7-01", "C7-02", "C7-03", "C7-04", "C7-05", "C7-06", "C7-07", "C7-08", "C7-09", "C7-10", "C7-11", "C7-12", "C7-13", "C7-14", "C7-15", "C7-16"],
});

export const CHAPTER_SEVEN_OPENING_COMBOS = deepFreeze({
  fase_49: "C7-01", fase_50: "C7-03", fase_51: "C7-04", fase_52: "C7-05",
  fase_53: "C7-06", fase_54: "C7-08", fase_55: "C7-13", fase_56: "C7-16",
});

export function getChapterSevenComboThreat(comboConfig) {
  return (comboConfig?.units || []).reduce((total, entry) => {
    const enemy = CHAPTER_SEVEN_ENEMIES[entry.type];
    return total + (enemy?.threat || 0) * entry.count;
  }, 0);
}

export const CHAPTER_SEVEN_COMBO_IDS = Object.freeze(Object.keys(CHAPTER_SEVEN_COMBOS));
