import { ENEMIES } from "../game/content.js";
import { enemyThreat } from "../game/domain.js";
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
  if (entry.id === "enguiaRasgamar") return "INFILTRAÇÃO";
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
  phase.waves.forEach((wave, waveIndex) => {
    (wave.enemies || []).forEach((entry) => {
      const key = `${entry.type}:${entry.variant || ""}`;
      const current = records.get(key) || {
        id: entry.type,
        variant: entry.variant,
        count: 0,
        firstWave: waveIndex + 1,
        enemy: ENEMIES[entry.type],
      };
      current.count += Number(entry.count || 0);
      records.set(key, current);
    });
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

export default function EnemyIntel({ phase }) {
  const intel = deriveEnemyIntel(phase);
  const visible = intel.slice(0, 5);
  return <section className="enemy-intel" aria-labelledby="enemy-intel-title">
    <h3 id="enemy-intel-title">Ameaças prioritárias</h3>
    <ul>{visible.map((entry) => <li key={`${entry.id}:${entry.variant || ""}`}>
      <img src={getEnemyPreviewUrl(entry.id)} alt="" />
      <strong className="enemy-intel-count" aria-label={`${entry.count} hostis projetados`}>{entry.count}</strong>
      <span><b>{entry.enemy?.label || entry.id}</b><small>ONDA {entry.firstWave} · ≈ {entry.count} ALVOS</small></span>
      {entry.priorityTag && <em>{entry.priorityTag}</em>}
    </li>)}</ul>
    {intel.length > 5 && <p>+{intel.length - 5} OUTROS REGISTROS</p>}
  </section>;
}
