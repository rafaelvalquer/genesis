import { ENEMIES } from "../game/content.js";
import { enemyThreat } from "../game/domain.js";
import { getEnemyUnlockAt } from "../game/enemyInfo.js";
import { getEnemyPreviewUrl } from "../game/assets/enemyPreviewCatalog.js";

const TIDE_MECHANIC_ENEMIES = new Set([
  "enguiaRasgamar",
  "leviathanNereida",
  "carapacaNereida",
  "medusaVeuSalino",
  "mordelume",
]);

const priorityTag = (entry) => {
  if (entry.enemy?.boss) return "CHEFE";
  if (entry.variant === "alpha") return "ALFA";
  if (entry.id === "carapacaNereida") return "ARMADURA";
  if (entry.id === "enguiaRasgamar") return "INFILTRA\u00c7\u00c3O";
  if (entry.id === "medusaVeuSalino") return "DEBUFF";
  if (entry.id === "mordelume") return "ENXAME";
  return null;
};

const isMechanicThreat = (phase, entry) => (
  phase.environmentHazard?.id === "tide_cycle"
    && TIDE_MECHANIC_ENEMIES.has(entry.id)
);

export function deriveEnemyIntel(phase) {
  const records = new Map();
  const addRecord = (entry, waveIndex, count = 0) => {
    const key = `${entry.type}:${entry.variant || ""}`;
    const current = records.get(key) || {
      id: entry.type,
      variant: entry.variant,
      count: 0,
      firstWave: waveIndex + 1,
      enemy: ENEMIES[entry.type],
    };
    current.count += Number(count || 0);
    current.firstWave = Math.min(current.firstWave, waveIndex + 1);
    records.set(key, current);
  };

  phase.waves.forEach((wave, waveIndex) => {
    (wave.enemies || []).forEach((entry) => addRecord(entry, waveIndex, entry.count));
    if (wave.bossEncounter?.type) addRecord(wave.bossEncounter, waveIndex, 1);
  });

  return [...records.values()]
    .map((entry) => ({
      ...entry,
      threatTotal: enemyThreat(entry) * entry.count,
      mechanicThreat: isMechanicThreat(phase, entry),
      priorityTag: priorityTag(entry),
    }))
    .sort((left, right) => (
      Number(Boolean(right.enemy?.boss)) - Number(Boolean(left.enemy?.boss))
      || Number(right.variant === "alpha") - Number(left.variant === "alpha")
      || Number(right.mechanicThreat) - Number(left.mechanicThreat)
      || right.threatTotal - left.threatTotal
      || right.count - left.count
      || left.firstWave - right.firstWave
    ));
}

const isUnlockedBoss = (entry, unlockedPhaseIndex) => {
  if (!entry.enemy?.boss || !Number.isInteger(unlockedPhaseIndex)) return true;
  const unlockAt = getEnemyUnlockAt(entry.id, entry.enemy);
  return unlockAt >= 0 && unlockAt <= unlockedPhaseIndex;
};

export default function EnemyIntel({ phase, unlockedPhaseIndex }) {
  const intel = deriveEnemyIntel(phase);
  const visible = intel.slice(0, 5);
  return <section className="enemy-intel" aria-labelledby="enemy-intel-title">
    <h3 id="enemy-intel-title">{"Amea\u00e7as priorit\u00e1rias"}</h3>
    <ul>{visible.map((entry) => {
      const hiddenBoss = !isUnlockedBoss(entry, unlockedPhaseIndex);
      return <li key={`${entry.id}:${entry.variant || ""}`} className={hiddenBoss ? "enemy-intel-unknown" : ""}>
        {hiddenBoss
          ? <span className="enemy-intel-unknown-mark" aria-hidden="true">?</span>
          : <img src={getEnemyPreviewUrl(entry.id)} alt="" />}
        {!hiddenBoss && <strong className="enemy-intel-count" aria-label={`${entry.count} hostis projetados`}>{entry.count}</strong>}
        <span>
          <b>{hiddenBoss ? "ASSINATURA HOSTIL DESCONHECIDA" : entry.enemy?.label || entry.id}</b>
          <small>{`ONDA ${entry.firstWave}${hiddenBoss ? "" : ` \u00b7 \u2248 ${entry.count} ALVOS`}`}</small>
        </span>
        {entry.priorityTag && <em>{entry.priorityTag}</em>}
      </li>;
    })}</ul>
    {intel.length > 5 && <p>{`+${intel.length - 5} OUTROS REGISTROS`}</p>}
  </section>;
}
